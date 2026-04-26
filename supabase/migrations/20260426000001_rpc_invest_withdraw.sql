-- invest: deduct free_points and create investment record atomically
create or replace function invest(
  p_user_id uuid,
  p_artist_id uuid,
  p_points integer,
  p_current_index numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_free_points integer;
begin
  -- lock user row
  select free_points into v_free_points
  from users
  where id = p_user_id
  for update;

  if v_free_points < p_points then
    raise exception 'insufficient_points';
  end if;

  -- check no active investment for this artist
  if exists (
    select 1 from investments
    where user_id = p_user_id
      and artist_id = p_artist_id
      and status = 'active'
  ) then
    raise exception 'already_invested';
  end if;

  -- deduct points
  update users
  set free_points = free_points - p_points
  where id = p_user_id;

  -- create investment
  insert into investments (user_id, artist_id, points_invested, index_at_entry, status)
  values (p_user_id, p_artist_id, p_points, p_current_index, 'active');
end;
$$;

-- withdraw: calculate return, mark withdrawn, add points back atomically
create or replace function withdraw(
  p_user_id uuid,
  p_investment_id uuid
)
returns integer
language plpgsql
security definer
as $$
declare
  v_points_invested integer;
  v_index_at_entry numeric;
  v_current_index numeric;
  v_return_pts integer;
begin
  -- lock investment row
  select inv.points_invested, inv.index_at_entry, a.current_index
  into v_points_invested, v_index_at_entry, v_current_index
  from investments inv
  join artists a on a.id = inv.artist_id
  where inv.id = p_investment_id
    and inv.user_id = p_user_id
    and inv.status = 'active'
  for update;

  if not found then
    raise exception 'investment_not_found';
  end if;

  v_return_pts := round(v_points_invested * (v_current_index / v_index_at_entry));

  -- mark withdrawn
  update investments
  set status = 'withdrawn',
      points_returned = v_return_pts,
      withdrawn_at = now()
  where id = p_investment_id;

  -- add points to user
  update users
  set free_points = free_points + v_return_pts
  where id = p_user_id;

  return v_return_pts;
end;
$$;
