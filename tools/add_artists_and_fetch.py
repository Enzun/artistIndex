# -*- coding: utf-8 -*-
"""
add_artists_and_fetch.py
1. artists.json に合計200組になるよう新規アーティストを追加
2. IDが未取得（24文字のUC始まりでない）のものを yt-dlp + API で一括取得
"""

import json, subprocess, sys, time, os, urllib.request, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

API_KEY = os.environ.get("YOUTUBE_API_KEY", "AIzaSyAMo62DnKd6hZGgIMsLstpUZEM6rc_obfQ")
ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

NEW_ARTISTS = [
    # 女性ソロ・シンガーソングライター
    "milet", "Aimer", "さユり", "ReoNa", "ASCA", "美波", "JUJU", "Superfly", "AI",
    "きゃりーぱみゅぱみゅ", "MISIA", "安室奈美恵", "浜崎あゆみ", "倖田來未", "中島美嘉", 
    "aiko", "椎名林檎", "YUKI", "Chara", "Cocco", 
    
    # バンド・グループ
    "Perfume", "BABYMETAL", "KANA-BOON", "BLUE ENCOUNT", "04 Limited Sazabys",
    "THE ORAL CIGARETTES", "KEYTALK", "フレデリック", "Nulbarich", "Suchmos",
    "MAN WITH A MISSION", "マキシマム ザ ホルモン", "coldrain", "Crossfaith", "SiM",
    "HEY-SMITH", "ELLEGARDEN", "Hi-STANDARD", "Ken Yokoyama", "BRAHMAN",
    "Dragon Ash", "L'Arc~en~Ciel", "GLAY", "X JAPAN", "LUNA SEA", "B'z",
    "サザンオールスターズ", "いきものがかり", "ポルノグラフィティ", "スキマスイッチ",
    
    # ヒップホップ・R&B
    "ZORN", "AK-69", "KOHH", "KREVA", "三浦大知", "RHYMESTER", "RIP SLYME", 
    "KICK THE CAN CREW", "m-flo", "Def Tech",
    
    # アイドル・ボーイズグループ
    "NiziU", "JO1", "INI", "Da-iCE", "DISH//", "AKB48", "モーニング娘。",
    "ももいろクローバーZ", "BiSH", 
    
    # 懐メロ・レジェンド
    "松任谷由実", "竹内まりや", "山下達郎", "松原みき", "THE YELLOW MONKEY", "ユニコーン",
    "エレファントカシマシ", "くるり", "NUMBER GIRL", "ZAZEN BOYS",
    
    # K-POP
    "EXO", "NCT 127", "NCT DREAM", "Red Velvet", "aespa", "ITZY", "NMIXX", 
    "ENHYPEN", "TOMORROW X TOGETHER", "TREASURE", "BIGBANG", "2NE1", "少女時代",
    "SHINee", "Super Junior", "東方神起", "KARA", "BoA", "IU", "Taeyeon",
    
    # VTuber
    "兎田ぺこら", "白上フブキ", "戌神ころね", "さくらみこ", "湊あくあ", "白銀ノエル",
    "不知火フレア", "雪花ラミィ", "獅白ぼたん", "尾丸ポルカ", "桃鈴ねね", "沙花叉クロヱ",
    "叶", "剣持刀也", "月ノ美兎", "壱百満天原サロメ"
]

def get_handle_via_ytdlp(artist_name: str):
    """yt-dlpを使って検索し、@ハンドル名を取得する"""
    # 精度を上げるため "official channel" 等のキーワードを付与
    query = f"ytsearch1:{artist_name} official channel"
    cmd = ["yt-dlp", query, "--print", "%(uploader_id)s", "--no-warnings"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=30)
        handle = r.stdout.strip()
        if handle and handle.startswith("@"):
            return handle
        return None
    except Exception:
        return None

def get_channel_id_via_api(handle: str):
    """APIを使って @ハンドル名 から channel_id を取得"""
    safe_handle = urllib.parse.quote(handle)
    url = f"https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle={safe_handle}&key={API_KEY}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode())
            if res_json.get("items"):
                return res_json["items"][0]["id"], res_json["items"][0]["snippet"]["title"]
    except Exception as e:
        pass
    return None, "Not found"

def main():
    if not os.path.exists(ARTISTS_JSON):
        artists = []
    else:
        with open(ARTISTS_JSON, encoding="utf-8") as f:
            artists = json.load(f)

    # 重複を排除しながら新規追加
    existing_names = set([a["name"] for a in artists])
    added_count = 0
    for new_name in NEW_ARTISTS:
        if new_name not in existing_names:
            artists.append({"name": new_name, "channel_id": ""})
            existing_names.add(new_name)
            added_count += 1
            
            # 目標の200組に達したらストップ
            if len(artists) >= 200:
                break

    print(f"\n[INFO] {added_count}組を追加し、合計 {len(artists)} 組になりました。")

    # 未取得（24文字のUC始まりでない）のものを抽出
    missing_targets = []
    for a in artists:
        cid = a.get("channel_id", "")
        if not (cid.startswith("UC") and len(cid) == 24):
            missing_targets.append(a)

    print(f"[START] {len(missing_targets)} 件のチャンネルIDを取得します...")
    
    for i, artist in enumerate(missing_targets, 1):
        name = artist["name"]
        handle = get_handle_via_ytdlp(name)
        
        if not handle:
            print(f"[NG] {i:>3}/{len(missing_targets)}: {name:<20} → ハンドル取得失敗")
            continue
            
        ch_id, title = get_channel_id_via_api(handle)
        if ch_id:
            artist["channel_id"] = ch_id
            print(f"[OK] {i:>3}/{len(missing_targets)}: {name:<20} → {handle:<20} → {ch_id} ({title[:20]})")
        else:
            print(f"[NG] {i:>3}/{len(missing_targets)}: {name:<20} → {handle:<20} → API取得失敗")
            
        time.sleep(1.0) 

    # 保存
    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(artists, f, ensure_ascii=False, indent=4)

    print("\n[DONE] data/artists.json を更新しました\n")

if __name__ == "__main__":
    main()
