# -*- coding: utf-8 -*-
"""
fetch_missing_ids.py
data/artists.json の中で channel_id が空（または不正）のものを
yt-dlp と YouTube Data API を組み合わせて自動検索し、IDを埋めるスクリプトです。
"""

import json, subprocess, sys, time, os, urllib.request, io

# Windowsコンソール文字化け対策
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

def load_env():
    """ .env ファイルを簡易的に読み込んで環境変数にセットする """
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip("'\"")

load_env()
API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

def get_channel_info_via_ytdlp(artist_name: str):
    """yt-dlpを使って検索し、直接 channel_id と uploader名 を取得する"""
    query = f"ytsearch1:{artist_name}"
    cmd = ["yt-dlp", query, "--print", "%(channel_id)s|%(uploader)s", "--no-warnings", "--playlist-items", "1"]
    try:
        r = subprocess.run(cmd, capture_output=True)
        lines = r.stdout.decode('utf-8', errors='replace').strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and line.startswith("UC") and "|" in line:
                ch_id, title = line.split("|", 1)
                return ch_id, title
    except Exception:
        pass
    return None, None

def main():
    if not API_KEY:
        print("[ERROR] YOUTUBE_API_KEY が設定されていません。(.env を確認してください)")
        return

    with open(ARTISTS_JSON, encoding="utf-8") as f:
        artists = json.load(f)

    # 24文字のUC始まりのIDを持っていないものを抽出
    missing_targets = [a for a in artists if not (a.get("channel_id", "").startswith("UC") and len(a.get("channel_id", "")) == 24)]
    
    if not missing_targets:
        print("[INFO] 取得が必要なアーティストはいませんでした。(全て24文字の正しいIDが設定済みです)", flush=True)
        return

    print(f"[START] {len(missing_targets)} 件のチャンネルIDを自動取得します...", flush=True)
    
    for i, artist in enumerate(missing_targets, 1):
        name = artist["name"]
        ch_id, title = get_channel_info_via_ytdlp(name)
        
        if ch_id:
            artist["channel_id"] = ch_id
            print(f"[OK] {i:>2}/{len(missing_targets)}: {name:<20} → {ch_id} ({title[:20]})", flush=True)
        else:
            print(f"[NG] {i:>2}/{len(missing_targets)}: {name:<20} → 取得失敗", flush=True)
            
        time.sleep(1.0) # 負荷回避

    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(artists, f, ensure_ascii=False, indent=4)
        
    print("\n[DONE] data/artists.json を更新しました", flush=True)

if __name__ == "__main__":
    main()
