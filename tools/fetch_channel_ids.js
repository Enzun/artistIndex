/**
 * fetch_channel_ids.js
 * YouTube Data API v3 で channel_id を取得するスクリプト
 *
 * 戦略:
 *   1. channels.list?forHandle=@xxx → 1ユニット/件（ハンドルが正確なら即解決）
 *   2. 失敗した場合 → search.list?q=name&type=channel → 100ユニット（自動フォールバック）
 *
 * 使い方: node tools/fetch_channel_ids.js
 */

const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAMo62DnKd6hZGgIMsLstpUZEM6rc_obfQ';

// handle: null にするとフォールバック検索のみ使用
const TEST_ARTISTS = [
  { name: 'YOASOBI',              handle: 'YOASOBI_staff' },
  { name: '米津玄師',              handle: 'KenshiYonezu' },
  { name: 'Official髭男dism',      handle: 'OfficialHIGEDANdism' },
  { name: 'Ado',                  handle: 'Ado1024game' },
  { name: '藤井 風',              handle: 'FujiiKaze' },
  { name: 'King Gnu',             handle: 'kinggnuSMEJ' },
  { name: 'あいみょん',            handle: 'aimyonofficial' },
  { name: 'Vaundy',               handle: 'Vaundy' },
  { name: 'Mrs. GREEN APPLE',     handle: 'mrsgreenapple_official' },
  { name: 'ずっと真夜中でいいのに。', handle: 'zutomayo' },
];

// ─── Step 1: channels.list?forHandle= (1ユニット) ─────────────────────────────
async function fetchByHandle(handle) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(handle)}&key=${API_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  if (!json.items?.length) return null;
  return { channelId: json.items[0].id, title: json.items[0].snippet?.title };
}

// ─── Step 2: search.list?type=channel (100ユニット) フォールバック ──────────────
async function fetchBySearch(artistName) {
  const q   = encodeURIComponent(`${artistName} official`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${q}&maxResults=3&key=${API_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  if (!json.items?.length) return null;

  // 結果が複数ある場合、チャンネル名が最も似ているものを選ぶ
  const best = json.items[0];
  return {
    channelId: best.id.channelId,
    title: best.snippet?.title,
    searchFallback: true,
  };
}

// ─── メイン取得ロジック ────────────────────────────────────────────────────────
async function fetchChannelId(artist) {
  let units = 0;
  try {
    // Step 1: ハンドルで試す
    if (artist.handle) {
      units += 1;
      const r = await fetchByHandle(artist.handle);
      if (r) return { ...artist, ...r, units, error: null };
    }

    // Step 2: 名前で検索（フォールバック）
    console.log(`  ↩ ハンドル不一致 → search.list で検索中...（+100ユニット）`);
    units += 100;
    const r = await fetchBySearch(artist.name);
    if (r) return { ...artist, ...r, units, error: null };

    return { ...artist, channelId: null, units, error: '見つかりません' };
  } catch (e) {
    return { ...artist, channelId: null, units, error: e.message };
  }
}

// ─── エントリーポイント ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n対象 ${TEST_ARTISTS.length} 件を検索します\n`);

  const results   = [];
  let totalUnits  = 0;

  for (const artist of TEST_ARTISTS) {
    const result = await fetchChannelId(artist);
    results.push(result);
    totalUnits += result.units ?? 0;

    const icon  = result.error ? '❌' : (result.searchFallback ? '🔍' : '✅');
    const units = `(${result.units}u)`;
    if (result.error) {
      console.log(`${icon} ${result.name.padEnd(26)} ${units.padEnd(6)} → ${result.error}`);
    } else {
      const flag = result.searchFallback ? ' [検索フォールバック・要確認]' : '';
      console.log(`${icon} ${result.name.padEnd(26)} ${units.padEnd(6)} → ${result.channelId}  "${result.title}"${flag}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n消費ユニット合計: ${totalUnits} / 10,000`);
  console.log('凡例: ✅=ハンドル一致(1u)  🔍=検索フォールバック(100u)  ❌=取得失敗\n');

  // artists.json 用 JSON 出力
  console.log('--- JSON出力 (artists.json 更新用) ---');
  const found = results.filter(r => r.channelId);
  console.log(JSON.stringify(found.map(r => ({ name: r.name, channel_id: r.channelId })), null, 2));

  // 未解決のもの
  const failed = results.filter(r => !r.channelId);
  if (failed.length) {
    console.log(`\n--- 未解決 ${failed.length} 件 ---`);
    failed.forEach(r => console.log(`  - ${r.name}  (handle: ${r.handle ?? 'null'})`));
  }
}

main();

