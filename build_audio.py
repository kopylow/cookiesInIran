"""Audiobook manifest generator.

Sibling to build.py (the print/web generator). This script builds the static
artifact the on-site audiobook player needs:

  web-landing-page/audio/manifest.json   — consumed by the on-site player (audiobook.js)

It is derived from:

  * chapter titles  <- locales/{lang}/manuscript.md  (the `# H1` lines, same parse as build.py)
  * audio bytes     <- os.path.getsize on the local narration masters
  * audio duration  <- ffprobe on the local narration masters

Narration masters live OUTSIDE the repo (they are ~1 GB) under:

  audio_src/{lang}/ch-00.mp3 … ch-NN.mp3      (zero-padded, index matches chapter order)
  audio_src/{lang}/<Title>_Audiobook.zip      (optional "download all" bundle)

The masters themselves are uploaded to the R2 bucket and served from BASE_URL; only the
small generated manifest is committed. If audio_src/ is missing or partial the script still
runs and simply emits whatever chapters do have audio (empty is fine), so it is safe to run
before any recording exists.

Run:  python3 build_audio.py
"""

import json
import os
import subprocess
from pathlib import Path

# Reuse paths + per-language metadata from the main build script (DRY).
# build.py guards its work behind `if __name__ == "__main__"`, so importing is side-effect free.
from build import ROOT, LOCALES_DIR, WEB_DIR, TITLE_MAP, AUTHOR_MAP

# --- Configuration ---------------------------------------------------------

# Public origin the audio is served from (R2 bucket on a custom domain).
# Keep in sync with the `media-src` entry in web-landing-page/_headers.
# Override with AUDIO_BASE_URL=... for local testing against same-origin files.
BASE_URL = os.environ.get("AUDIO_BASE_URL", "https://audio.cookiesiniran.com")

# Local narration masters (NOT committed; uploaded to R2 separately).
AUDIO_SRC = ROOT / "audio_src"

# Farsi is intentionally excluded (matches ALLOWED_LANGS / no RTL player support).
AUDIO_LANGS = ["de", "en", "ru"]


# --- Helpers ---------------------------------------------------------------

def parse_chapter_titles(lang: str) -> list[str]:
    """Return chapter titles in order, parsed exactly like build.py's md_to_html."""
    md_file = LOCALES_DIR / lang / "manuscript.md"
    if not md_file.exists():
        return []
    titles = []
    for raw in md_file.read_text(encoding="utf-8").splitlines():
        # Match build.py's md_to_html: strip NBSP only, never collapse real spaces,
        # otherwise "# Title" becomes "#Title" and stops matching the H1 prefix.
        line = raw.strip().replace('\u00a0', '').strip()
        if line.startswith("# "):
            titles.append(line[2:].strip())
    return titles


def probe_duration(path: Path) -> float | None:
    """Duration in seconds via ffprobe, or None if ffprobe/file is unavailable."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, check=True,
        )
        return round(float(out.stdout.strip()), 1)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        return None


def collect_chapters(lang: str) -> list[dict]:
    """One entry per chapter that has a matching audio master on disk."""
    titles = parse_chapter_titles(lang)
    chapters = []
    for index, title in enumerate(titles):
        rel = f"{lang}/ch-{index:02d}.mp3"
        master = AUDIO_SRC / lang / f"ch-{index:02d}.mp3"
        if not master.exists():
            continue
        chapters.append({
            "index": index,
            "title": title,
            "file": rel,
            "bytes": master.stat().st_size,
            "duration": probe_duration(master),
        })
    return chapters


def find_zip(lang: str) -> str | None:
    """Optional 'download all' bundle: audio_src/{lang}/<Title>_Audiobook.zip."""
    slug = TITLE_MAP.get(lang, "Cookies in Iran").replace(" ", "_")
    candidate = AUDIO_SRC / lang / f"{slug}_Audiobook.zip"
    return f"{lang}/{candidate.name}" if candidate.exists() else None


# --- Main ------------------------------------------------------------------

def main():
    print("--- Audiobook manifest ---")
    audio_out_dir = WEB_DIR / "audio"
    audio_out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"baseUrl": BASE_URL, "langs": {}}

    for lang in AUDIO_LANGS:
        chapters = collect_chapters(lang)
        manifest["langs"][lang] = {
            "title": TITLE_MAP.get(lang, "Cookies in Iran"),
            "author": AUTHOR_MAP.get(lang, "Anton Kopylow"),
            "zip": find_zip(lang),
            "chapters": chapters,
        }
        have = len(chapters)
        total = len(parse_chapter_titles(lang))
        print(f"  [{lang.upper()}] {have}/{total} chapters with audio")

    (audio_out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("  manifest -> web-landing-page/audio/manifest.json")
    print("Done.")


if __name__ == "__main__":
    main()
