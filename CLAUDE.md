# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A memoir ("Kekse im Iran" / "Cookies in Iran" by Anton Kopylow) localized into 4 languages (DE, EN, RU, FA) with two outputs: print PDFs (LaTeX) and a static web landing page. Content project, not software — no test suite, no linter, no CI.

## Build

```bash
python3 build.py
```

One script does everything: parses `locales/{lang}/manuscript.md`, generates LaTeX via `md_to_latex`, compiles PDFs with `xelatex` (twice, for TOC), generates HTML fragments via `md_to_html` into `web-landing-page/manuscript_{lang}.html`, then cleans temp `.aux/.log/.out/.toc/.tex` files. Output PDFs are renamed to the localized title (e.g. `Kekse_im_Iran.pdf`).

Requirements: `xelatex` with `polyglossia`, `fontspec`, and (for Farsi) `xepersian`. DE/EN use Latin Modern OTF fonts; RU/FA use DejaVu Sans.

To rebuild a single language quickly, edit the `for lang in [...]` list at `build.py:230`.

## Web landing page dev

No bundler. Open `web-landing-page/index.html` directly or serve the folder (e.g. `python3 -m http.server` from `web-landing-page/`). `fetch('manuscript_{lang}.html')` requires HTTP, so file:// will not work — always use a local server.

`test-drawer.js` is an ad-hoc jsdom smoke test for the drawer interaction (`node test-drawer.js` from repo root). It is not a real test suite.

## Architecture: the two pipelines

Both pipelines read the same Markdown and diverge based on the same per-language config (`LANG_MAP`, `TITLE_MAP`, `AUTHOR_MAP`, `COPYRIGHT_MAP`, `DISCUSS_MAP` at `build.py:18-48`). When adding a language, all five maps must be updated together, plus the loop list in `main()`.

**LaTeX pipeline** (`build_pdf`, `build.py:150`): loads `tex-book/main.tex` as a template, then strips `fontenc`/`inputenc`/`babel`/`lmodern` via regex before injecting `polyglossia` + language-specific font setup. Do NOT add those stripped packages back to `main.tex` — the strip is load-bearing because `xelatex` + `polyglossia` is incompatible with them. Title/author/copyright placeholders (`[AUTHOR_NAME]`, `[COPYRIGHT_TEXT]`, and the literal string `"Cookies in Iran"`) are substituted at build time.

**HTML pipeline** (`md_to_html`, `build.py:101`): wraps each `# Chapter` in `<section class="chapter" data-tense="...">`. The `data-tense` attribute drives the client-side UI state machine (cold/claustrophobic for `present`, warm/fluid for `past`) — see `kekse_im_iran_ux_blueprint.md`. The list of present-tense chapters is hardcoded as `present_indices` at `build.py:107` and must be kept in sync with `Zeitenanalyse.md`. Between chapters, "airlock" `<div>`s render `Pics/{2..25}.jpg` as full-bleed background images; chapter 0 has no preceding airlock.

**SEO fallback** (`inject_seo_fallback`, `build.py`): the book text is fetched client-side, so the initial HTML is otherwise an empty shell — bad for indexing. After generating the DE fragment, the build mirrors it (airlock/discuss divs stripped) into the `<!-- SEO-FALLBACK-START … END -->` `<noscript>` block in `index.html`. **That block is auto-generated — never edit it by hand**, and keep the marker comments intact or the injection silently skips. Only DE is mirrored (the canonical/default language).

**Frontend state** (`web-landing-page/main.js`): all client-side. Language switching re-fetches the appropriate `manuscript_{lang}.html`. RTL is toggled on `<html>` for Farsi. Theme is light/dark via `data-theme` on body, initialized from `prefers-color-scheme`. A scroll listener at `main.js:162` reads the current chapter's `data-tense` and writes it to `body[data-state]`, which CSS uses to morph the page mood.

## Comments system

A third pipeline on top of the two above: a per-language, per-chapter comment thread with optional email-claim of names, lives entirely on Cloudflare. **One deploy** (CF Pages) serves both the static site and the API; no CORS, no separate worker for the request path.

### Stack and files

- **Backend**: Pages Functions in `functions/api/*.js` (file-routed). Storage: D1 (`functions/api/_schema.sql`) for durable rows, KV for sessions and rate-limit counters. Shared helpers in `functions/api/_lib/` (`http.js`, `hash.js`, `validation.js`, `ratelimit.js`, `turnstile.js`, `session.js`, `email.js`, `admin.js`).
- **Frontend**: `web-landing-page/comments.js` — plain script (not ES module) that exposes `window.CommentsUI` with `.init()`, `.open(chapterIndex)`, `.setLang(lang)`. Mounted into the existing `#drawer-comments` shell. `main.js` calls `CommentsUI.init()` once after DOM-ready, and wires `setupDiscussButtons()` + the language toggle to it.
- **Admin panel**: standalone `web-landing-page/admin.html` with vanilla JS, gated in prod by Cloudflare Access on `/admin*`; gated in dev by `ADMIN_DEV_BYPASS=1` in `.dev.vars`.
- **Privacy pages**: `web-landing-page/privacy-{de,en,ru}.html`, linked from the comment-form footer via `privacyHref` in `comments.js`. Edit these directly; they are not generated.
- **Config**: `wrangler.toml` (D1 + KV bindings, non-secret vars like `ALLOWED_LANGS = "de,en,ru"`, `MAX_CHAPTER_INDEX = "25"`). FA is **excluded** from `ALLOWED_LANGS` because the frontend doesn't currently support Farsi comments — keep these in sync if the language list changes.

### Thread IDs and identity

- Threads are addressed as `main:{lang}` (top-level) or `ch:{n}:{lang}` (per chapter, `n` validated against `MAX_CHAPTER_INDEX`). The server rejects anything else — clients can't invent thread IDs.
- Identity is **badge, not lock**: an anonymous post under "Anton" doesn't reserve the name. Only a successful email-code verify creates a row in `identities` and marks future posts with `verified: true` (✓). A second person can still post as "Anton" anonymously without a badge. Conflict messages are intentionally generic so we never leak "this email is registered".
- Verified users get an `HttpOnly; SameSite=Lax` session cookie `cii_sid` (1-year TTL) so they keep posting without re-entering codes. JS never sees the cookie — call `/api/whoami` for status. Wipe the cookie to test the re-verify flow.

### Local dev

```bash
npx wrangler pages dev web-landing-page --d1=DB --kv=KV_SESSIONS --kv=KV_RATELIMIT
```

Then http://127.0.0.1:8788. Dev-mode shortcuts (active when secrets are absent): Turnstile is skipped; Resend emails are logged to the wrangler terminal as `[email-dev] to=… code=NNNNNN`; admin requires no SSO.

**Wrangler D1 quirk**: `wrangler d1 execute DB --local` and `wrangler pages dev` write to *different* sqlite files under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`. If endpoints return `no such table: comments`, apply the schema directly to the file `pages dev` is actually using:

```bash
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite < functions/api/_schema.sql
```

Pick the most-recently-modified `*.sqlite` after starting `pages dev`. The `wrangler d1 execute --local` path looks correct but silently writes to a different DB; do not rely on it for pages-dev tests.

### Production deployment

The site is live at `https://cookiesiniran.com` and `https://cookies-in-iran.pages.dev`.

**Deploys are automatic on push to `main`.** `.github/workflows/deploy.yml` runs
`cloudflare/pages-action@v1` on every push to `main` (and on manual `workflow_dispatch`),
deploying the `web-landing-page/` directory to the `cookies-in-iran` Pages project. It needs repo
secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. So the normal release flow is just
`git push` — confirm a run landed with `npx wrangler pages deployment list --project-name cookies-in-iran`
(the `Source` column shows the deployed commit SHA). The manual `npx wrangler pages deploy …`
command below is the fallback (no GitHub, account bootstrap, or out-of-band deploy). Because every
push ships to prod, the `?v=` cache-bust discipline (see below) must be honored on each push, not
just on manual deploys.

**First-time deploy to a new Cloudflare account:**

```bash
npx wrangler pages project create cookies-in-iran --production-branch main
npx wrangler pages deploy web-landing-page --project-name cookies-in-iran --commit-dirty=true
```

**After every fresh production deploy, apply the D1 schema** (tables are not created automatically):

```bash
npx wrangler d1 execute cookies-in-iran-comments --remote --file=functions/api/_schema.sql
```

This is separate from the local dev schema step. Forgetting it causes silent HTTP 500s on all `/api/comments` requests (Cloudflare error 1101).

### Email sending

Outbound email uses [Resend](https://resend.com) (EU region, required for DSGVO). The sending domain `cookiesiniran.com` is verified in Resend via its Cloudflare DNS integration — do not remove or alter the DKIM/SPF records it manages. DNS records also in place: apex CNAME `cookiesiniran.com → cookies-in-iran.pages.dev` (proxied), DMARC `_dmarc.cookiesiniran.com`.

- **From**: `Cookies in Iran <noreply@cookiesiniran.com>` (set in `wrangler.toml [vars]`)
- **Reply-To**: `cookiesiniran@mailbox.org` (set in `wrangler.toml [vars]` as `RESEND_REPLY_TO`)
- Both email sends in `functions/api/_lib/email.js` include `reply_to` so user replies land in the mailbox.org inbox, not bounce.
- Dev mode (no `RESEND_API_KEY`): codes are logged to the wrangler terminal, no mail sent.

### Production secrets

`.dev.vars` holds dummy local values. For prod set with `npx wrangler pages secret put NAME`.

**All secrets set in production:**
- `RESEND_API_KEY` — Resend sending key (EU region account)
- `TURNSTILE_SECRET` — Cloudflare Turnstile secret
- `EMAIL_ENC_KEY` — 32-byte base64 for AES-GCM encryption of stored email addresses
- `EMAIL_HASH_SALT` — stable salt for email hashing (do NOT rotate — changing it orphans all existing identities)
- `IP_HASH_SALT_CURRENT` + `IP_HASH_SALT_PREVIOUS` — rotated quarterly with overlap window
- `CRON_SECRET` — bearer token for the external cron trigger
- `ADMIN_PASSWORD` — admin panel password

**Still needed:**
- `CF_ACCESS_AUD` — Cloudflare Access AUD tag, gates the `/admin*` path (currently using ADMIN_PASSWORD fallback)

Also set `TURNSTILE_SITE_KEY` in `wrangler.toml [vars]` and mirror it in the `<meta name="turnstile-site-key">` tag in `index.html`.

### Cron (Pages Functions have no native cron)

`functions/api/admin/cron-tick.js` purges expired `pending_verifications`, resolved `reports` older than 90 days, and expired `bans`. Authenticated by `Authorization: Bearer ${CRON_SECRET}`. This is wired up via **`.github/workflows/cron.yml`**: a GitHub Actions schedule (`0 3 * * *`, 03:00 UTC daily, plus manual `workflow_dispatch`) that `curl`s `https://cookiesiniran.com/api/admin/cron-tick` with the `CRON_SECRET` repo secret as the bearer token.

## Audiobook (streaming + download)

A third output alongside the print PDFs and web page, for DE/EN/RU narration (no Farsi). It
is **immutable static content**, so unlike the comments system it needs **no Pages Function,
no D1, no API** — just R2 for the audio bytes plus generated static files.

### Generator: `build_audio.py`

Sibling to `build.py`. Reads chapter `# H1` titles from `locales/{lang}/manuscript.md` (same
parse as `build.py`) and, for each `audio_src/{lang}/ch-NN.mp3` master, records byte-size
(`os.path.getsize`) + duration (`ffprobe`). Emits one artifact that is the single source of
truth for the on-site player:

- `web-landing-page/audio/manifest.json` — chapter list (index, title, file, bytes, duration)
  per language, plus `baseUrl`, optional `zip`. Consumed by `audiobook.js`.

Run `python3 build_audio.py`. It degrades gracefully: with no masters it still writes an empty
manifest, so it is safe to run before any recording exists. `requirements`:
`ffprobe` (from ffmpeg) for durations.

### Masters and R2

- Narration masters live **outside the repo** under `audio_src/{lang}/ch-NN.mp3` (zero-padded,
  index = chapter order) and optionally `audio_src/{lang}/<Title>_Audiobook.zip` for "download
  all". They are ~1 GB total — never commit them (would bloat the ~62 MB repo).
- Audio is served from an R2 bucket on a custom domain: `https://audio.cookiesiniran.com/{lang}/ch-NN.mp3`.
  R2 gives free egress + native HTTP range (streaming/seek) + CDN caching. This subdomain is the
  only external origin in the CSP `media-src` (`web-landing-page/_headers`) — keep the two in sync.
  Set up: `npx wrangler r2 bucket create cookies-in-iran-audio`, then connect the custom domain in
  the bucket's Settings → Public access, then upload masters with `python3 upload_audio.py` (see
  "Cover art, upload, and deploy" below — do **not** hand-roll `npx wrangler r2 object put`, the
  script bakes the download filenames).
- For local UI testing without R2, regenerate with `AUDIO_BASE_URL=` (empty/same-origin) and drop
  test mp3s where the page can fetch them.

### Cover art, upload, and deploy

The masters and the live site are refreshed in a fixed order — **R2 holds the bytes, Pages holds
the manifest/UI, and both must be refreshed for a change to go live**. A half-finished run
where R2 has the audio but Pages still serves the old `manifest.json` makes chapters silently
invisible in the player (the player reads the manifest from Pages, never from R2).

1. **Embed cover art into the masters** (optional, one-time per recording). Each `audio_src/{lang}/`
   has an `img.png` book-cover photo; bake a compact JPEG and embed it as an ID3v2.3 `APIC` frame,
   copying audio losslessly so narration bytes are untouched:
   ```bash
   ffmpeg -y -i "$lang/img.png" -vf "scale='min(1600,iw)':-2" -q:v 3 "$lang/cover.jpg"
   ffmpeg -y -i in.mp3 -i "$lang/cover.jpg" -map 0:a -map 1:v -c:a copy -c:v copy \
     -id3v2_version 3 -disposition:v:0 attached_pic out.mp3
   ```
   The 8 MB PNGs are too heavy to embed raw (×23 chapters ×3 langs); the ~330 KB JPEG keeps files
   small. Streaming is unaffected — the `<audio>` element ignores embedded art on resource loads.
2. **`python3 build_audio.py`** — regenerate `manifest.json`. Re-run this *after* embedding
   art, because embedding changes every file's byte size and the manifest bakes `os.path.getsize` in.
3. **`python3 upload_audio.py`** — uploads every master in the manifest to R2 with `--remote` and a
   per-object `Content-Disposition: attachment; filename*=…` so downloads save as
   `"{Book} - NN - {Title}.mp3"` instead of `ch-NN.mp3`. This is required because the player links
   downloads straight at the R2 origin (`audio.cookiesiniran.com`), a *different* origin than the
   page, so the HTML `download="…"` attribute is ignored — only the R2 header controls the name.
   Non-ASCII titles (Cyrillic, umlauts) use RFC 5987 `filename*`. **`--remote` is load-bearing**:
   without it the put only writes local dev state and public requests 404.
4. **Publish the new manifest** — this is the step that actually surfaces new chapters in the
   player. `manifest.json` lives under `web-landing-page/`, so committing it and pushing to `main`
   auto-deploys it via the Pages GitHub Action (see "Production deployment"). To publish without a
   commit (e.g. a quick out-of-band manifest refresh), run the manual fallback:
   `npx wrangler pages deploy web-landing-page --project-name cookies-in-iran --commit-dirty=true`.

**CDN cache gotcha**: R2-on-custom-domain sits behind Cloudflare's CDN (per-PoP). Any object you
`GET` *before* re-uploading caches the old response at that edge; a fresh `put` does not purge it.
Symptom: one object serves a stale/missing `Content-Disposition` (`cf-cache-status: HIT`) while the
rest are correct. Fix: purge that URL in the dashboard (Caching → Purge Cache → Custom), or "Purge
Everything" since the audio is immutable. The OAuth wrangler token is `zone (read)` only and cannot
purge via API — that needs a scoped Cache-Purge API token.

### Frontend

- `web-landing-page/audiobook.js` — plain script exposing `window.AudioPlayer` with
  `.init()/.open()/.setLang()`, mirroring `comments.js`'s `window.CommentsUI`. Renders the chapter
  list + per-chapter download links into `#drawer-audio`, and drives a persistent `#mini-player`
  (play/pause/seek/speed/prev-next) that survives drawer open/close. Last position per language is
  the only durable state (localStorage `audioPos_{lang}`).
- `main.js` mounts it exactly like comments: `AudioPlayer.init()` after DOM-ready, `openAudioDrawer()`
  wired to the "Hörbuch/Audiobook" nav buttons, and `AudioPlayer.setLang()` called from the language
  toggle. Styles live in the "Audiobook" section of `styles.css`.

## Support / donations drawer

A donation page that lives entirely in the existing `#drawer-support` (the **Support** nav button
already opens it). Like the audiobook, it is **static, no backend, no API, no CSP change** because
every payment is a plain outbound `<a href>` link or a copyable address plus a self-hosted QR
image; nothing is sent or stored.

- **Frontend**: `web-landing-page/support.js` — plain script exposing `window.SupportUI` with
  `.init({drawerEl, getCurrentLang})`, `.open()`, `.setLang(lang)`, mirroring `audiobook.js`.
  `main.js` mounts it exactly like the audio player (init after DOM-ready, `open()` from
  `openSupportDrawer()`, `setLang()` from the language toggle). Holds a de/en/ru `I18N` block and a
  `PAYMENTS` config (Revolut link+IBAN, PayPal.me link, BTC/ETH/SOL addresses, per-market Amazon
  links). Renders: why-support + the 5-5000 € ask + a "leave your contact in the payment reference"
  line, the Spendenstand progress bar, Amazon buy buttons, and Revolut/PayPal/crypto methods with
  copy-to-clipboard and **one-at-a-time QR toggles** (opening one QR collapses any other, so phones
  never see two codes at once). Styles live in the "Support" section of `styles.css`.
- **Donation total**: `web-landing-page/donations.json` (`{raised, goal, currency, updated}`) is the
  single source of truth, edited every Monday and pushed (auto-deploys via the Pages Action). It has
  a `/donations.json` `no-cache` entry in `_headers` so the update is visible immediately. If the
  fetch fails the bar is skipped and the rest of the drawer still renders.
- **QR codes**: `build_support_qr.py` (repo root) generates
  `web-landing-page/support/qr/{revolut,paypal,btc,eth,sol}.svg` by shelling out to the `qrencode`
  CLI (`pacman -S qrencode` / `apt install qrencode`; used instead of a Python lib because the
  system Python has no pip). Crypto QRs encode `bitcoin:`/`ethereum:`/`solana:` URIs so wallets
  prefill. **The payment values live in two places** — the `PAYMENTS` block in `build_support_qr.py`
  AND in `support.js` — keep them in sync and re-run the script when an address/link changes.
- **Not wired for Farsi** (same as comments): `getCurrentLang()` only yields de/en/ru.

## Content rules (enforced by convention, not tooling)

- Edit only `locales/{lang}/manuscript.md`. Never edit generated `*.html` or `*.tex` files.
- Markdown subset is intentionally minimal: `# H1` (chapter), `- ` (list item), paragraphs. No `*` emphasis, no `—` em-dashes (use `:` or `,`). See `TRANSLATION_GUIDE.md`.
- Preserved terms across all translations: "Ghostbusters" + "Who you gonna call?", "Mercedes W124" + "Steel Tank", "Taarof".
- LaTeX template (`tex-book/main.tex`) owns book typography (A5, 12pt, widow/orphan penalties). Style changes go there, not in `build.py`.

## Project contact

Canonical contact email for the public site (privacy notices, GDPR data requests, mailto links, support footer): **cookiesiniran@mailbox.org**. Use this in any new public-facing page or generated content; do not use Anton's personal Gmail address in checked-in assets.
