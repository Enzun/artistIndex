# -*- coding: utf-8 -*-
import json, subprocess, sys, time, os, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

FAILED_ARTISTS = [
    "YOASOBI", "Ado", "King Gnu", "あいみょん", "宇多田ヒカル", "ヨルシカ", "優里",
    "TOMOO", "羊文学", "Chilli Beans.", "カネコアヤノ", "SIRUP", "tuki.", "WurtS",
    "SHISHAMO", "Creepy Nuts", "Number_i", "imase", "My Hair is Bad", "10-FEET",
    "RADWIMPS", "スピッツ", "Saucy Dog", "マカロニえんぴつ", "sumika", "Omoinotake",
    "back number", "UVERworld", "ASIAN KUNG-FU GENERATION", "King & Prince",
    "Snow Man", "乃木坂46", "櫻坂46", "日向坂46", "BE:FIRST", "水曜日のカンパネラ",
    "yama", "キタニタツヤ", "宝鐘マリン", "葛葉", "SEVENTEEN"
]

def search_channel(artist_name: str):
    query = f"ytsearch1:{artist_name} official"
    cmd = ["yt-dlp", "--dump-single-json", "--no-warnings", "--no-playlist", query]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=40)
        if r.returncode != 0 or not r.stdout.strip():
            return None, None
        data = json.loads(r.stdout)
        return data.get("channel_id"), data.get("channel") or data.get("uploader", "")
    except Exception as e:
        return None, f"ERROR:{e}"

def main():
    with open(ARTISTS_JSON, encoding="utf-8") as f:
        artists = json.load(f)

    print(f"\n残り {len(FAILED_ARTISTS)} 件を強制検索します (APIユニット消費: 0)\n")
    print(f"{'#':<5} {'アーティスト':<28} {'取得チャンネルID':<26} チャンネル名")
    print("-" * 90)

    for i, artist in enumerate(artists, 1):
        name = artist["name"]
        if name in FAILED_ARTISTS:
            ch_id, ch_name = search_channel(name)
            if ch_id:
                artist["channel_id"] = ch_id
                print(f"[OK]  {i:<3} {name:<28} {ch_id:<26} {(ch_name or '')[:28]}")
            else:
                print(f"[NG]  {i:<3} {name:<28} {'---':<26} (検索失敗)")
            time.sleep(1.5)

    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(artists, f, ensure_ascii=False, indent=4)

    print(f"\n[DONE] data/artists.json を更新しました\n")

if __name__ == "__main__":
    main()
