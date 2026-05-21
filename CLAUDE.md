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

## Content rules (enforced by convention, not tooling)

- Edit only `locales/{lang}/manuscript.md`. Never edit generated `*.html` or `*.tex` files.
- Markdown subset is intentionally minimal: `# H1` (chapter), `- ` (list item), paragraphs. No `*` emphasis, no `—` em-dashes (use `:` or `,`). See `TRANSLATION_GUIDE.md`.
- Preserved terms across all translations: "Ghostbusters" + "Who you gonna call?", "Mercedes W124" + "Steel Tank", "Taarof".
- LaTeX template (`tex-book/main.tex`) owns book typography (A5, 12pt, widow/orphan penalties). Style changes go there, not in `build.py`.
