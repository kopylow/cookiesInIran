"""Upload narration masters to the R2 bucket with friendly download filenames.

Sibling to build_audio.py. Run build_audio.py FIRST (it writes the manifest this
script reads), then run this to push the actual mp3 bytes to R2.

Why this exists: the on-site player links downloads straight at the R2 origin
(audio.cookiesiniran.com), which is a DIFFERENT origin than the page, so the HTML
`download="nice-name.mp3"` attribute is ignored by browsers. The only cross-origin
way to control the saved filename is a per-object `Content-Disposition` header on R2.
We bake that here, derived from the same manifest the player and feeds use, so the
download name can never drift from the chapter list.

Saved name format:  "{Book Title} - {NN} - {Chapter Title}.mp3"  (NN = 1-based track).

Non-ASCII titles (Cyrillic, umlauts) are encoded per RFC 5987:
    Content-Disposition: attachment; filename="<ascii fallback>"; filename*=UTF-8''<pct>

Streaming is unaffected: the <audio> element ignores Content-Disposition on resource
loads, so playback/seek still work; only explicit downloads pick up the name.

Run:  python3 build_audio.py && python3 upload_audio.py
Needs: wrangler authenticated to the Cloudflare account that owns the bucket.
"""

import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
AUDIO_SRC = ROOT / "audio_src"
MANIFEST = ROOT / "web-landing-page" / "audio" / "manifest.json"
BUCKET = "cookies-in-iran-audio"

# Characters illegal in filenames / HTTP header quoted-strings -> dropped or spaced.
_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n\t]')


def safe_title(s: str) -> str:
    """Make a chapter/book title safe to embed in a filename."""
    s = _ILLEGAL.sub("", s)          # strip path/header-hostile chars
    s = re.sub(r"\s+", " ", s)       # collapse whitespace
    return s.strip().rstrip(".")      # no trailing dots (Windows)


def ascii_fallback(s: str) -> str:
    """Best-effort ASCII version for the legacy `filename=` parameter."""
    nfkd = unicodedata.normalize("NFKD", s)
    out = nfkd.encode("ascii", "ignore").decode("ascii")
    out = re.sub(r"\s+", " ", out).strip()
    return out or "chapter"          # never emit an empty fallback


def disposition_for(book: str, index: int, title: str):
    """Return (download_filename, content_disposition_header)."""
    track = f"{index + 1:02d}"
    name = f"{safe_title(book)} - {track} - {safe_title(title)}.mp3"
    ascii_name = ascii_fallback(name)
    if not ascii_name.lower().endswith(".mp3"):
        ascii_name += ".mp3"
    pct = quote(name, safe="")       # RFC 5987 wants percent-encoded UTF-8
    header = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{pct}"
    return name, header


def bundle_disposition(book: str, ext: str):
    """(download_filename, content_disposition) for a 'download all' bundle.

    Same cross-origin filename logic as chapters (the player links straight at R2, a
    different origin, so the HTML download attr is ignored — only this header counts),
    but no track number: '<Book> Audiobook.<ext>'.
    """
    name = f"{safe_title(book)} Audiobook.{ext}"
    ascii_name = ascii_fallback(name)
    if not ascii_name.lower().endswith(f".{ext}"):
        ascii_name += f".{ext}"
    pct = quote(name, safe="")
    return name, f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{pct}"


def put_object(key: str, local: Path, content_type: str, cd: str):
    """One `wrangler r2 object put --remote`. Returns (ok, stderr)."""
    cmd = [
        "npx", "wrangler", "r2", "object", "put",
        f"{BUCKET}/{key}",
        "--file", str(local),
        "--content-type", content_type,
        "--content-disposition", cd,
        "--remote",                       # MUST: without it, only local dev state is written
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode == 0, res.stderr.strip()[:300]


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    ok = fail = 0
    for lang, block in manifest["langs"].items():
        book = block.get("title", "Audiobook")
        for ch in block["chapters"]:
            key = ch["file"]                     # e.g. "en/ch-00.mp3"
            local = AUDIO_SRC / key
            if not local.exists():
                print(f"  SKIP {key} (no local master)")
                continue
            name, cd = disposition_for(book, ch["index"], ch["title"])
            success, err = put_object(key, local, "audio/mpeg", cd)
            if success:
                ok += 1
                print(f"  ok   {key}  ->  {name}")
            else:
                fail += 1
                print(f"  FAIL {key}\n{err}")

        # 'Download all' bundles (optional; built by build_audio_bundles.py).
        for ext, ctype in (("zip", "application/zip"), ("mp3", "audio/mpeg")):
            entry = block.get("zip" if ext == "zip" else "full")
            if not entry:
                continue
            key = entry["file"]                  # e.g. "en/Cookies_in_Iran_Audiobook.zip"
            local = AUDIO_SRC / key
            if not local.exists():
                print(f"  SKIP {key} (no local bundle)")
                continue
            name, cd = bundle_disposition(book, ext)
            success, err = put_object(key, local, ctype, cd)
            if success:
                ok += 1
                print(f"  ok   {key}  ->  {name}")
            else:
                fail += 1
                print(f"  FAIL {key}\n{err}")

    print(f"\nUploaded {ok}, failed {fail}.")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
