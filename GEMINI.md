# Cookies in Iran - Project Overview

"Cookies in Iran" is a memoir by Anton Kopylow detailing his travel experiences in Iran. This project is localized into multiple languages and supports both print (LaTeX) and web (HTML) outputs.

## Directory Overview

- `locales/`: The single source of truth for all content.
    - `de/manuscript.md`: German manuscript.
    - `en/manuscript.md`: English manuscript (dummy).
    - `ru/manuscript.md`: Russian manuscript (dummy).
    - `fa/manuscript.md`: Farsi manuscript (dummy).
- `tex-book/`: The LaTeX project directory for book production.
    - `main.tex`: The master LaTeX template.
- `web-landing-page/`: The website project directory.
    - `manuscript_*.html`: Auto-generated HTML fragments for the site.
- `build.py`: The master build script.
- `cookiesInIran.txt`: Original German source manuscript (legacy).

## Usage

### Generating All Outputs
To update both the LaTeX books and the website fragments for all languages, run:

```bash
python3 build.py
```

This script will:
1. Parse the Markdown files in `locales/`.
2. Generate localized LaTeX manuscripts with professional typography (no widows/orphans).
3. Compile PDFs for all languages using the appropriate engine (`pdflatex` for DE/EN, `xelatex` for RU/FA).
4. Generate HTML snippets for the landing page with RTL support for Farsi.
5. Clean up all temporary LaTeX junk files automatically.

## Development Conventions
- **Source of Truth**: Always edit the Markdown files in `locales/`.
- **Styling**: Changes to the book's layout should be made in `tex-book/main.tex`.
- **Typography**: The build script enforces strict rules against "Hurenkinder" (widows) and "Schusterjungen" (orphans).
