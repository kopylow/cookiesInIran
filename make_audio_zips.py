"""Bundle each language's chapter MP3s into a single 'download all' ZIP.

Sibling to build_audio.py / upload_audio.py. Produces the optional bundle that
build_audio.py's find_zip() looks for and the on-site player surfaces as the
"Download all chapters (ZIP)" link at the top of the audio drawer:

    audio_src/{lang}/<Title>_Audiobook.zip

Why a ZIP and not "fire 23 downloads at once": browsers block multi-file
downloads, and the `download` attribute is ignored cross-origin (audio is on the
R2 origin, not the page origin), so JS-triggered bulk downloads are unreliable.
One ZIP is a single reliable download that modern phones (iOS Files / Android
Files) extract natively.

Track names inside the ZIP match the per-chapter download names exactly (reusing
upload_audio.disposition_for), so an extracted folder is ordered + titled:

    Kekse im Iran - 01 - Who you gonna call?.mp3
    Kekse im Iran - 02 - Gehe nicht ueber Los.mp3
    ...

MP3 is already compressed, so we store (ZIP_STORED) rather than re-deflate: far
faster and the size is essentially identical.

Run:  python3 make_audio_zips.py   (then build_audio.py to pick up the zip)
"""

import sys
import zipfile
from pathlib import Path

from build import TITLE_MAP
from build_audio import AUDIO_SRC, AUDIO_LANGS, collect_chapters
# Reuse the exact naming used for single-chapter downloads so names never drift.
from upload_audio import disposition_for


def zip_path(lang: str) -> Path:
    slug = TITLE_MAP.get(lang, "Cookies in Iran").replace(" ", "_")
    return AUDIO_SRC / lang / f"{slug}_Audiobook.zip"


def main() -> int:
    made = 0
    for lang in AUDIO_LANGS:
        chapters = collect_chapters(lang)
        if not chapters:
            print(f"  [{lang.upper()}] no masters, skipping")
            continue

        book = TITLE_MAP.get(lang, "Cookies in Iran")
        out = zip_path(lang)
        # ZIP_STORED: mp3 is already compressed; deflating wastes time for ~0 gain.
        with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as zf:
            for ch in chapters:
                src = AUDIO_SRC / ch["file"]
                arcname, _ = disposition_for(book, ch["index"], ch["title"])
                zf.write(src, arcname=arcname)
        size_mb = out.stat().st_size / (1024 * 1024)
        print(f"  [{lang.upper()}] {len(chapters)} chapters -> {out.name} ({size_mb:.0f} MB)")
        made += 1

    print(f"\nBuilt {made} zip(s). Now run: python3 build_audio.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
