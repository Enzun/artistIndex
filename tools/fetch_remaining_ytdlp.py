# -*- coding: utf-8 -*-
"""
fetch_remaining_ytdlp.py
yt-dlp の検索機能(ytsearch1)を使って、まだチャンネルIDが取れていないアーティストのIDを取得します。
APIユニット消費: 0
"""

import json, subprocess, sys, time, os, io

# Windowsコンソールの文字化け対策
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

def search_channel(artist_name: str):
    """
    yt-dlp で '{name} official' を検索し、ヒットした動画から channel_id を取得。
    """
    query = f"ytsearch1:{artist_name} official"
    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--no-warnings",
        "--no-playlist",
        query,
    ]
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

    # まだ正しくチャンネルIDが取れていない（AIが出力した不正なIDや空のまま）ものを抽出
    # 本物のIDは24文字でUCから始まる
    remaining = [a for a in artists if not (a.get("channel_id", "").startswith("UC") and len(a.get("channel_id", "")) == 24)]
    
    print(f"\n残り {len(remaining)} 件を検索します (APIユニット消費: 0)\n")
    print(f"{'#':<5} {'アーティスト':<28} {'取得チャンネルID':<26} チャンネル名")
    print("-" * 90)

    for i, artist in enumerate(remaining, 1):
        name = artist["name"]
        channel_id, channel_name = search_channel(name)

        if not channel_id:
            print(f"[NG]  {i:<3} {name:<28} {'---':<26} (検索失敗)")
        else:
            artist["channel_id"] = channel_id
            ch_display = (channel_name or "")[:28]
            print(f"[OK]  {i:<3} {name:<28} {channel_id:<26} {ch_display}")

        time.sleep(2.0)  # YouTubeに負荷をかけないよう少し待つ

    # JSONを上書き保存
    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(artists, f, ensure_ascii=False, indent=4)

    print("\n" + "=" * 90)
    print(f"[DONE] data/artists.json を更新しました")

if __name__ == "__main__":
    main()
