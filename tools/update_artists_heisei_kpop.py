# -*- coding: utf-8 -*-
"""
update_artists_heisei_kpop.py
1. VTuberを削除
2. 平成の歌姫・最新KPOPを追加
3. ID未取得のものを一括取得
"""

import json, subprocess, sys, time, os, urllib.request, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

API_KEY = os.environ.get("YOUTUBE_API_KEY", "AIzaSyAMo62DnKd6hZGgIMsLstpUZEM6rc_obfQ")
ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

VTUBERS_TO_REMOVE = [
    "兎田ぺこら", "白上フブキ", "戌神ころね", "さくらみこ", "湊あくあ", "白銀ノエル",
    "不知火フレア", "雪花ラミィ", "獅白ぼたん", "尾丸ポルカ", "桃鈴ねね", "沙花叉クロヱ",
    "叶", "剣持刀也", "月ノ美兎", "壱百満天原サロメ",
    "星街すいせい", "宝鐘マリン", "葛葉", "Mori Calliope" # 初期にいたVTuberも念のため削除
]

NEW_ARTISTS = [
    # 平成の歌姫・グループ
    "西野カナ", "YUI", "miwa", "絢香", "大塚 愛", "木村カエラ", "加藤ミリヤ", "青山テルマ", 
    "倉木麻衣", "ZARD", "globe", "SPEED", "家入レオ", "大黒摩季", "広瀬香美", "PUFFY", 
    "Every Little Thing", "My Little Lover", "BoA", "倖田來未", "浜崎あゆみ", "安室奈美恵", # 一部はすでに追加済みだが重複は弾かれる
    
    # 最新バズ・K-POP・オーディション発
    "IVE", "Kep1er", "ILLIT", "BABYMONSTER", "XG", "ME:I", "IS:SUE",
    "RIIZE", "BOYNEXTDOOR", "TWS", "ZEROBASEONE", "KISS OF LIFE", "STAYC",
    "NiziU", "JO1", "INI", "BE:FIRST", "Number_i" 
]

def get_handle_via_ytdlp(artist_name: str):
    query = f"ytsearch1:{artist_name} official channel"
    cmd = ["yt-dlp", query, "--print", "%(uploader_id)s", "--no-warnings"]
    try:
        r = subprocess.run(cmd, capture_output=True)
        handle = r.stdout.decode('utf-8', errors='replace').strip()
        if handle and handle.startswith("@"):
            return handle
    except Exception:
        pass
    return None

def get_channel_id_via_api(handle: str):
    safe_handle = urllib.parse.quote(handle)
    url = f"https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle={safe_handle}&key={API_KEY}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode())
            if res_json.get("items"):
                return res_json["items"][0]["id"], res_json["items"][0]["snippet"]["title"]
    except Exception:
        pass
    return None, "Not found"

def main():
    with open(ARTISTS_JSON, encoding="utf-8") as f:
        artists = json.load(f)

    # VTuberの削除
    initial_count = len(artists)
    artists = [a for a in artists if a["name"] not in VTUBERS_TO_REMOVE]
    removed_count = initial_count - len(artists)

    # 新規追加
    existing_names = set([a["name"] for a in artists])
    added_count = 0
    for new_name in NEW_ARTISTS:
        if new_name not in existing_names:
            artists.append({"name": new_name, "channel_id": ""})
            existing_names.add(new_name)
            added_count += 1

    print(f"\n[INFO] {removed_count}組のVTuberを削除し、新たに {added_count}組 を追加しました。（現在 {len(artists)}組）")

    # 未取得ターゲットの抽出
    missing_targets = [a for a in artists if not (a.get("channel_id", "").startswith("UC") and len(a.get("channel_id", "")) == 24)]
    
    if not missing_targets:
        print("[INFO] 取得が必要なアーティストはいませんでした。")
    else:
        print(f"[START] {len(missing_targets)} 件のチャンネルIDを取得します...")
        
        for i, artist in enumerate(missing_targets, 1):
            name = artist["name"]
            handle = get_handle_via_ytdlp(name)
            
            if not handle:
                print(f"[NG] {i:>2}/{len(missing_targets)}: {name:<20} → ハンドル取得失敗")
                continue
                
            ch_id, title = get_channel_id_via_api(handle)
            if ch_id:
                artist["channel_id"] = ch_id
                print(f"[OK] {i:>2}/{len(missing_targets)}: {name:<20} → {handle:<20} → {ch_id} ({title[:20]})")
            else:
                print(f"[NG] {i:>2}/{len(missing_targets)}: {name:<20} → {handle:<20} → API取得失敗")
                
            time.sleep(1.0)

    # 保存
    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(artists, f, ensure_ascii=False, indent=4)
        
    print("\n[DONE] data/artists.json を更新しました\n")

if __name__ == "__main__":
    main()
