# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A memoir ("Kekse im Iran" / "Cookies in Iran" by Anton Kopylow) localized into 4 languages (DE, EN, RU, FA) with two outputs: print PDFs (LaTeX) and a static web landing page. Content project, not software — no test suite, no linter, no CI. `AGENTS.md` and `GEMINI.md` cover the same territory and should be kept in rough sync if you change conventions here.

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

**Already set in production:**
- `RESEND_API_KEY` — Resend sending key (EU region account)

**Still needed — site partially functional without these:**
- `TURNSTILE_SECRET` — Cloudflare Turnstile (comment posting skips bot check without it in dev, but should be set in prod)
- `EMAIL_ENC_KEY` — 32-byte base64 for AES-GCM encryption of stored email addresses
- `EMAIL_HASH_SALT` — stable salt for email hashing (do NOT rotate — changing it orphans all existing identities)
- `IP_HASH_SALT_CURRENT` + `IP_HASH_SALT_PREVIOUS` — rotated quarterly with overlap window
- `CF_ACCESS_AUD` — Cloudflare Access AUD tag, gates the `/admin*` path
- `CRON_SECRET` — bearer token for the external cron trigger

Also set `TURNSTILE_SITE_KEY` in `wrangler.toml [vars]` and mirror it in the `<meta name="turnstile-site-key">` tag in `index.html`.

### Cron (Pages Functions have no native cron)

`functions/api/admin/cron-tick.js` purges expired `pending_verifications`, resolved `reports` older than 90 days, and expired `bans`. Authenticated by `Authorization: Bearer ${CRON_SECRET}`. Trigger externally — either a tiny standalone Worker with `[triggers] crons = [...]` calling this endpoint, or a GitHub Actions schedule.

## Content rules (enforced by convention, not tooling)

- Edit only `locales/{lang}/manuscript.md`. Never edit generated `*.html` or `*.tex` files.
- Markdown subset is intentionally minimal: `# H1` (chapter), `- ` (list item), paragraphs. No `*` emphasis, no `—` em-dashes (use `:` or `,`). See `TRANSLATION_GUIDE.md`.
- Preserved terms across all translations: "Ghostbusters" + "Who you gonna call?", "Mercedes W124" + "Steel Tank", "Taarof".
- LaTeX template (`tex-book/main.tex`) owns book typography (A5, 12pt, widow/orphan penalties). Style changes go there, not in `build.py`.

## Project contact

Canonical contact email for the public site (privacy notices, GDPR data requests, mailto links, support footer): **cookiesiniran@mailbox.org**. Use this in any new public-facing page or generated content; do not use Anton's personal Gmail address in checked-in assets.
