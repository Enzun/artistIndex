# -*- coding: utf-8 -*-
"""
fetch_channel_ids_ytdlp.py
yt-dlp を使って YouTube Channel ID を取得し、data/artists.json を更新する。

方法: https://www.youtube.com/@handle/videos の先頭1件から channel_id を抽出
APIユニット消費: 0

実行: python tools/fetch_channel_ids_ytdlp.py
"""

import json, subprocess, sys, time, os, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ARTISTS_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'artists.json')

# ──────────────────────────────────────────────────────────────────────────────
# @handle リスト（YouTube の @ハンドル名）
# handle が None の場合はスキップ（手動確認が必要）
# ──────────────────────────────────────────────────────────────────────────────
HANDLES = {
    "YOASOBI":                    "YOASOBI_staff",
    "米津玄師":                       "KenshiYonezu",
    "Official髭男dism":              "OfficialHIGEDANdism",
    "Ado":                          "Ado1024game",
    "藤井 風":                        "FujiiKaze",
    "King Gnu":                     "kinggnuSMEJ",
    "あいみょん":                        "aimyonofficial",
    "Vaundy":                       "Vaundy",
    "宇多田ヒカル":                       "HikaruUtada",
    "Eve":                          "ooo0eve0ooo",
    "Mrs. GREEN APPLE":             "mrsgreenapple_official",
    "ずっと真夜中でいいのに。":               "zutomayo",
    "ヨルシカ":                         "yorushika",
    "優里":                           "yuuri_music",
    "TOMOO":                        "TOMOO_music",
    "羊文学":                          "hitsujibungaku",
    "SUPER BEAVER":                 "SUPERBEAVER",
    "サカナクション":                      "sakanaction",
    "Chilli Beans.":                "ChilliBeansOfficial",
    "カネコアヤノ":                       "kaneko_ayano",
    "Tempalay":                     "Tempalay",
    "Lucky Kilimanjaro":            "luckykilimanjaro",
    "Kroi":                         "Kroi_Official",
    "SIRUP":                        "SIRUPofficial",
    "tuki.":                        "tuki_music",
    "WurtS":                        "WurtS_Official",
    "SHISHAMO":                     "SHISHAMO_OFFICIAL",
    "Creepy Nuts":                  "CreepyNuts_official",
    "Number_i":                     "Number_i",
    "Tani Yuuki":                   "TaniYuuki",
    "imase":                        "imaseofficial",
    "My Hair is Bad":               "myHairis_Bad",
    "10-FEET":                      "10FEET_official",
    "RADWIMPS":                     "RADWIMPS",
    "BUMP OF CHICKEN":              "BUMPOFCHICKEN",
    "ONE OK ROCK":                  "ONEOKROCK",
    "スピッツ":                         "SpitzOfficial",
    "Mr.Children":                  "mrchildren",
    "SEKAI NO OWARI":               "SEKAINOOWARI",
    "星野源":                          "GenHoshino",
    "Saucy Dog":                    "saucydog_official",
    "マカロニえんぴつ":                     "macaronienpitsu",
    "緑黄色社会":                        "RyokuoushokuShakai",
    "sumika":                       "sumika_info",
    "Omoinotake":                   "omoinotake_official",
    "back number":                  "backnumber_official",
    "UVERworld":                    "UVERworld",
    "ASIAN KUNG-FU GENERATION":     "ASIANKUNGFUGENERATION",
    "King & Prince":                "KingandPrince_official",
    "SixTONES":                     "SixTONES_official",
    "Snow Man":                     "SnowMan_official",
    "乃木坂46":                        "nogizaka46",
    "櫻坂46":                         "Sakurazaka46",
    "日向坂46":                        "hinatazaka46",
    "BE:FIRST":                     "BEFIRST_official",
    "水曜日のカンパネラ":                    "suiyoubinocampanella",
    "yama":                         "yama_m2020",
    "キタニタツヤ":                       "KitaniTatsuya",
    "星街すいせい":                       "suisei_hoshimachi",
    "宝鐘マリン":                        "MarineHoushou",
    "葛葉":                           "Kuzuha_Channel",
    "Mori Calliope":                "moricalliope",
    "新しい学校のリーダーズ":                  "atarashiigakko",
    "BTS":                          "BTS",
    "BLACKPINK":                    "BLACKPINK",
    "TWICE":                        "TWICE",
    "NewJeans":                     "NewJeans_official",
    "Stray Kids":                   "StrayKids",
    "SEVENTEEN":                    "SEVENTEEN",
    "LE SSERAFIM":                  "LE_SSERAFIM",
    "Taylor Swift":                 "TaylorSwift",
    "Ed Sheeran":                   "EdSheeran",
    "THE FIRST TAKE":               "THE_FIRST_TAKE",
    "avex":                         "avex",
    "SMTOWN":                       "SMTOWN",
    "HYBE LABELS":                  "HYBELABELS",
    "JYP Entertainment":            "jypentertainment",
    "YG ENTERTAINMENT":             "ygentertainment",
    "Justin Bieber":                "justinbieber",
    "Ariana Grande":                "ArianaGrande",
    "The Weeknd":                   "TheWeeknd",
    "Uru":                          "uru_official",
    "LiSA":                         "LiSAofficial",
}


def get_channel_id(handle: str) -> tuple[str | None, str | None]:
    """@handle/videos のプレイリスト情報から channel_id と channel名を取得"""
    url = f"https://www.youtube.com/@{handle}/videos"
    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        "--playlist-items", "1",
        url,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=30)
        if r.returncode != 0 or not r.stdout.strip():
            return None, None
        data = json.loads(r.stdout)
        # チャンネルページのプレイリストJSONは top-level に channel_id がある
        channel_id   = data.get("channel_id") or data.get("uploader_id")
        channel_name = data.get("channel") or data.get("uploader", "")
        return channel_id, channel_name
    except Exception as e:
        return None, f"ERROR:{e}"



def main():
    with open(ARTISTS_JSON, encoding="utf-8") as f:
        artists = json.load(f)

    total = len(artists)
    print(f"\n対象: {total} 件  (APIユニット消費: 0)\n")
    print(f"{'#':<5} {'アーティスト':<28} {'チャンネルID':<26} チャンネル名")
    print("-" * 90)

    updated = []
    review  = []
    failed  = []

    for i, artist in enumerate(artists, 1):
        name   = artist["name"]
        handle = HANDLES.get(name)

        if not handle:
            print(f"[--] {i:<3} {name:<28} {'(handleなし)':<26}")
            failed.append(name)
            updated.append({"name": name, "channel_id": artist.get("channel_id", "")})
            continue

        channel_id, channel_name = get_channel_id(handle)

        if not channel_id:
            print(f"[NG] {i:<3} {name:<28} {'---':<26} (handle: @{handle})")
            failed.append(name)
            updated.append({"name": name, "channel_id": artist.get("channel_id", "")})
        else:
            # チャンネル名の簡易チェック
            name_core = name.lower().replace(" ", "").replace(".", "")
            ch_core   = (channel_name or "").lower().replace(" ", "").replace(".", "")
            match_ok  = name_core[:4] in ch_core or ch_core[:4] in name_core
            status    = "[OK]" if match_ok else "[??]"
            if not match_ok:
                review.append({"name": name, "channel_id": channel_id, "found": channel_name})
            updated.append({"name": name, "channel_id": channel_id})
            ch_display = (channel_name or "")[:28]
            print(f"{status} {i:<3} {name:<28} {channel_id:<26} {ch_display}")

        time.sleep(1.0)

    # JSON 書き込み
    with open(ARTISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(updated, f, ensure_ascii=False, indent=4)

    print("\n" + "=" * 90)
    print(f"[DONE] data/artists.json を更新しました ({total} 件)")

    if review:
        print(f"\n[??] 要確認 ({len(review)} 件) -- チャンネル名が想定と異なる:")
        for r in review:
            print(f"   {r['name']:<30} {r['channel_id']}  (取得: {r['found']})")

    if failed:
        print(f"\n[NG] 取得失敗 ({len(failed)} 件) -- 手動確認が必要:")
        for n in failed:
            print(f"   {n}")


if __name__ == "__main__":
    main()
