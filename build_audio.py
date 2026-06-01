"""Audiobook manifest + podcast-feed generator.

Sibling to build.py (the print/web generator). This script builds the two static
artifacts the audiobook feature needs:

  web-landing-page/audio/manifest.json   — consumed by the on-site player (audiobook.js)
  web-landing-page/podcast_{lang}.xml    — RSS 2.0 + iTunes feeds for Spotify/Apple

Both are derived from the SAME inputs so the on-site player and the podcast platforms
can never drift apart:

  * chapter titles  <- locales/{lang}/manuscript.md  (the `# H1` lines, same parse as build.py)
  * audio bytes     <- os.path.getsize on the local narration masters
  * audio duration  <- ffprobe on the local narration masters

Narration masters live OUTSIDE the repo (they are ~1 GB) under:

  audio_src/{lang}/ch-00.mp3 … ch-NN.mp3      (zero-padded, index matches chapter order)
  audio_src/{lang}/<Title>_Audiobook.zip      (optional "download all" bundle)

The masters themselves are uploaded to the R2 bucket and served from BASE_URL; only the
small generated manifest + feeds are committed. If audio_src/ is missing or partial the
script still runs and simply emits whatever chapters do have audio (empty is fine), so it
is safe to run before any recording exists.

Run:  python3 build_audio.py
"""

import json
import os
import subprocess
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

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

# Site origin (for feed <link>, GUIDs, cover art URL).
SITE_URL = "https://cookiesiniran.com"
COVER_PATH = "Pics/podcast-cover.jpg"  # square >=1400x1400, relative to SITE_URL

# Farsi is intentionally excluded (matches ALLOWED_LANGS / no RTL player support).
AUDIO_LANGS = ["de", "en", "ru"]

# Per-language podcast channel copy.
DESC_MAP = {
    "de": "Das Hörbuch zu \"Kekse im Iran\" von Anton Kopylow: eine Geschichte über Raketen, Kekse und bittere Tränen.",
    "en": "The audiobook of \"Cookies in Iran\" by Anton Kopylow: a story about rockets, cookies and bitter tears.",
    "ru": "Аудиокнига \"Печенье в Иране\" Антона Копылова: история о ракетах, печенье и горьких слезах.",
}
RSS_LANG_MAP = {"de": "de-DE", "en": "en-US", "ru": "ru-RU"}
OWNER_EMAIL = "cookiesiniran@mailbox.org"
ITUNES_CATEGORY = "Arts"
ITUNES_SUBCATEGORY = "Books"

# Stable base date for <pubDate>; chapter N publishes N days after this so order is fixed.
PUBDATE_BASE = datetime(2026, 1, 1, 9, 0, 0, tzinfo=timezone.utc)

ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd"


# --- Helpers ---------------------------------------------------------------

def parse_chapter_titles(lang: str) -> list[str]:
    """Return chapter titles in order, parsed exactly like build.py's md_to_html."""
    md_file = LOCALES_DIR / lang / "manuscript.md"
    if not md_file.exists():
        return []
    titles = []
    for raw in md_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip().replace(" ", "").strip()
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


def fmt_hms(seconds: float | None) -> str:
    """Seconds -> HH:MM:SS for <itunes:duration>."""
    if not seconds:
        return "00:00:00"
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


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


# --- Feed rendering --------------------------------------------------------

def render_feed(lang: str, lang_block: dict) -> str:
    title = lang_block["title"]
    author = lang_block["author"]
    desc = DESC_MAP.get(lang, "")
    cover_url = f"{SITE_URL}/{COVER_PATH}"
    feed_url = f"{SITE_URL}/podcast_{lang}.xml"

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<rss version="2.0" xmlns:itunes="{ITUNES_NS}" '
        'xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        f'    <title>{xml_escape(title)}</title>',
        f'    <link>{SITE_URL}/</link>',
        f'    <language>{RSS_LANG_MAP.get(lang, "en-US")}</language>',
        f'    <description>{xml_escape(desc)}</description>',
        f'    <itunes:author>{xml_escape(author)}</itunes:author>',
        f'    <itunes:summary>{xml_escape(desc)}</itunes:summary>',
        '    <itunes:explicit>false</itunes:explicit>',
        '    <itunes:type>serial</itunes:type>',
        f'    <itunes:image href="{xml_escape(cover_url)}"/>',
        f'    <image><url>{xml_escape(cover_url)}</url>'
        f'<title>{xml_escape(title)}</title><link>{SITE_URL}/</link></image>',
        f'    <itunes:category text="{ITUNES_CATEGORY}">'
        f'<itunes:category text="{ITUNES_SUBCATEGORY}"/></itunes:category>',
        '    <itunes:owner>'
        f'<itunes:name>{xml_escape(author)}</itunes:name>'
        f'<itunes:email>{OWNER_EMAIL}</itunes:email></itunes:owner>',
        f'    <atom:link href="{xml_escape(feed_url)}" rel="self" type="application/rss+xml"/>',
    ]

    for ch in lang_block["chapters"]:
        pub = format_datetime(PUBDATE_BASE + timedelta(days=ch["index"]))
        url = f'{BASE_URL}/{ch["file"]}'
        lines += [
            '    <item>',
            f'      <title>{xml_escape(ch["title"])}</title>',
            f'      <itunes:episode>{ch["index"] + 1}</itunes:episode>',
            f'      <itunes:author>{xml_escape(author)}</itunes:author>',
            f'      <enclosure url="{xml_escape(url)}" length="{ch["bytes"]}" type="audio/mpeg"/>',
            f'      <guid isPermaLink="false">cii-{lang}-ch{ch["index"]:02d}</guid>',
            f'      <pubDate>{pub}</pubDate>',
            f'      <itunes:duration>{fmt_hms(ch["duration"])}</itunes:duration>',
            '      <itunes:explicit>false</itunes:explicit>',
            '    </item>',
        ]

    lines += ['  </channel>', '</rss>', '']
    return "\n".join(lines)


# --- Main ------------------------------------------------------------------

def main():
    print("--- Audiobook manifest + feeds ---")
    audio_out_dir = WEB_DIR / "audio"
    audio_out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"baseUrl": BASE_URL, "cover": COVER_PATH, "langs": {}}

    for lang in AUDIO_LANGS:
        chapters = collect_chapters(lang)
        block = {
            "title": TITLE_MAP.get(lang, "Cookies in Iran"),
            "author": AUTHOR_MAP.get(lang, "Anton Kopylow"),
            "feed": f"podcast_{lang}.xml",
            "zip": find_zip(lang),
            "chapters": chapters,
        }
        manifest["langs"][lang] = block

        (WEB_DIR / f"podcast_{lang}.xml").write_text(render_feed(lang, block), encoding="utf-8")
        have = len(chapters)
        total = len(parse_chapter_titles(lang))
        print(f"  [{lang.upper()}] {have}/{total} chapters with audio -> podcast_{lang}.xml")

    (audio_out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("  manifest -> web-landing-page/audio/manifest.json")
    print("Done.")


if __name__ == "__main__":
    main()
