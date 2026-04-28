# -*- coding: utf-8 -*-
"""
fetch_ids_combined.py
ユーザーの提案による最強コンボ：
1. yt-dlp ytsearch1 で動画を一瞬だけ検索し「@ハンドル名」を無料で取得（API 0ユニット）
2. YouTube Data API の channels.list?forHandle= に渡し、正確な 24文字の channel_id を取得（API 1ユニット）
"""

import json, subprocess, sys, time, os, urllib.request, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

API_KEY = os.environ.get("YOUTUBE_API_KEY", "AIzaSyAMo62DnKd6hZGgIMsLstpUZEM6rc_obfQ")
ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

# 前回失敗した残り41件
FAILED_ARTISTS = [
    "YOASOBI", "Ado", "King Gnu", "あいみょん", "宇多田ヒカル", "ヨルシカ", "優里",
    "TOMOO", "羊文学", "Chilli Beans.", "カネコアヤノ", "SIRUP", "tuki.", "WurtS",
    "SHISHAMO", "Creepy Nuts", "Number_i", "imase", "My Hair is Bad", "10-FEET",
    "RADWIMPS", "スピッツ", "Saucy Dog", "マカロニえんぴつ", "sumika", "Omoinotake",
    "back number", "UVERworld", "ASIAN KUNG-FU GENERATION", "King & Prince",
    "Snow Man", "乃木坂46", "櫻坂46", "日向坂46", "BE:FIRST", "水曜日のカンパネラ",
    "yama", "キタニタツヤ", "宝鐘マリン", "葛葉", "SEVENTEEN"
]

def get_handle_via_ytdlp(artist_name: str):
    """yt-dlpを使って検索し、@ハンドル名を取得する"""
    query = f"ytsearch1:{artist_name} official"
    cmd = ["yt-dlp", query, "--print", "%(uploader_id)s", "--no-warnings"]
    try:
        r = subprocess.run(cmd, capture_output=True)
        # バイト列で受け取り、強引にデコードしてエラー回避
        stdout_str = r.stdout.decode('utf-8', errors='replace')
        handle = stdout_str.strip()
        if handle and handle.startswith("@"):
            return handle
        return None
    except Exception:
        return None

def get_channel_id_via_api(handle: str):
    """APIを使って @ハンドル名 から channel_id を取得 (1ユニット)"""
    safe_handle = urllib.parse.quote(handle)
    url = f"https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle={safe_handle}&key={API_KEY}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode())
            if res_json.get("items"):
                return res_json["items"][0]["id"], res_json["items"][0]["snippet"]["title"]
    except Exception as e:
        return None, str(e)
    return None, "Not found"

def main():
    print(f"\n[START] yt-dlp + API 合わせ技で残り {len(FAILED_ARTISTS)} 件を取得します")
    
    with open(ARTISTS_JSON, encoding="utf-8") as f:
        artists = json.load(f)

    for i, artist in enumerate(artists, 1):
        name = artist["name"]
        if name in FAILED_ARTISTS:
            handle = get_handle_via_ytdlp(name)
            if not handle:
                print(f"[NG] {name:<26} → ハンドル取得失敗")
                continue
                
            ch_id, title = get_channel_id_via_api(handle)
            if ch_id:
                artist["channel_id"] = ch_id
                print(f"[OK] {name:<26} → {handle:<20} → {ch_id} ({title})")
            else:
                print(f"[NG] {name:<26} → {handle:<20} → API取得失敗({title})")
                
            time.sleep(1.0) # API制限とyt-dlp負荷回避

    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(artists, f, ensure_ascii=False, indent=4)

    print("\n[DONE] data/artists.json を更新しました\n")

if __name__ == "__main__":
    main()
