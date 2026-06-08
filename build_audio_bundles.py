"""Build the two 'download all' bundles per language for the audiobook player.

Sibling to build_audio.py. The on-site player offers a Download menu with two
choices (see audiobook.js); this script produces the artifacts behind them, into
the (un-committed) masters tree:

  audio_src/{lang}/<Title>_Audiobook.zip   <- every chapter master, friendly names
  audio_src/{lang}/<Title>_Audiobook.mp3   <- all chapters concatenated into one file

Both sit OUTSIDE the ch-NN numbering, exactly like intro.mp3, so they never renumber
real chapters. They are large (~150 MB each) and NEVER committed; build_audio.py only
records their path + byte size in manifest.json, and upload_audio.py pushes the bytes
to R2.

Order matches the player: the optional author intro (index -1) first, then ch-00..ch-NN.

  * ZIP        — Python zipfile, stored (ZIP_STORED) because MP3 is already compressed;
                 deflating would burn CPU for ~0% gain. Inner names mirror the per-chapter
                 download names from upload_audio.py: "{NN} - {Title}.mp3".
  * single MP3 — ffmpeg concat demuxer with `-c copy`: lossless and fast (no re-encode),
                 since all masters share the same codec/bitrate from one recording pipeline.
                 The first file's ID3 tags + embedded cover carry into the result.

Run order:  python3 build_audio_bundles.py && python3 build_audio.py && python3 upload_audio.py
Needs: ffmpeg on PATH. Safe to run with partial/missing masters (skips a language with none).
"""

import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from build import TITLE_MAP
from build_audio import AUDIO_SRC, AUDIO_LANGS, collect_chapters
from upload_audio import safe_title


def bundle_basename(lang: str) -> str:
    """'<Title>_Audiobook' — shared stem for both the .zip and the .mp3."""
    slug = TITLE_MAP.get(lang, "Cookies in Iran").replace(" ", "_")
    return f"{slug}_Audiobook"


def inner_name(index: int, title: str) -> str:
    """Track filename inside the ZIP: '{NN} - {Title}.mp3' (NN = 1-based, intro -> 00)."""
    return f"{index + 1:02d} - {safe_title(title)}.mp3"


def build_zip(lang: str, chapters: list[dict], out: Path) -> bool:
    """Zip every chapter master under a friendly per-track name. Returns True on success."""
    tmp = out.with_suffix(".zip.tmp")
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as zf:
        for ch in chapters:
            master = AUDIO_SRC / ch["file"]
            if not master.exists():
                continue
            zf.write(master, arcname=inner_name(ch["index"], ch["title"]))
    tmp.replace(out)
    return True


def build_concat(lang: str, chapters: list[dict], out: Path) -> bool:
    """Concatenate all chapter masters into one MP3 (lossless `-c copy`). True on success."""
    paths = [AUDIO_SRC / ch["file"] for ch in chapters]
    paths = [p for p in paths if p.exists()]
    if not paths:
        return False
    # ffmpeg concat demuxer needs a list file; paths are quoted, single-quotes escaped.
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as lf:
        for p in paths:
            safe = str(p).replace("'", "'\\''")
            lf.write(f"file '{safe}'\n")
        list_path = lf.name
    tmp = out.with_suffix(".mp3.tmp")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", list_path, "-c", "copy",
        "-f", "mp3", str(tmp),   # force muxer: the '.mp3.tmp' temp name isn't auto-detected
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    Path(list_path).unlink(missing_ok=True)
    if res.returncode != 0:
        print(f"  FAIL concat [{lang}]\n{res.stderr.strip()[-400:]}")
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(out)
    return True


def main() -> int:
    print("--- Audiobook download bundles ---")
    failures = 0
    for lang in AUDIO_LANGS:
        chapters = collect_chapters(lang)
        if not chapters:
            print(f"  [{lang.upper()}] no masters, skipping")
            continue
        stem = bundle_basename(lang)
        zip_out = AUDIO_SRC / lang / f"{stem}.zip"
        mp3_out = AUDIO_SRC / lang / f"{stem}.mp3"

        # Exclude the bundles themselves from the chapter list (collect_chapters only
        # returns intro + ch-NN, so this is already clean — just being explicit).
        build_zip(lang, chapters, zip_out)
        mb = zip_out.stat().st_size / 1e6
        print(f"  [{lang.upper()}] zip -> {zip_out.name}  ({mb:.0f} MB, {len(chapters)} tracks)")

        if build_concat(lang, chapters, mp3_out):
            mb = mp3_out.stat().st_size / 1e6
            print(f"  [{lang.upper()}] mp3 -> {mp3_out.name}  ({mb:.0f} MB)")
        else:
            failures += 1

    print("Done. Next: python3 build_audio.py && python3 upload_audio.py")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
