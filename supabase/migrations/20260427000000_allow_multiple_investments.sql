-- Remove the already_invested restriction to allow multiple card purchases per artist
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
  select free_points into v_free_points
  from users
  where id = p_user_id
  for update;

  if v_free_points < p_points then
    raise exception 'insufficient_points';
  end if;

  update users
  set free_points = free_points - p_points
  where id = p_user_id;

  insert into investments (user_id, artist_id, points_invested, index_at_entry, status)
  values (p_user_id, p_artist_id, p_points, p_current_index, 'active');
end;
$$;
