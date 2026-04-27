# Translation Instructions for "Cookies in Iran"

This document outlines the literary and technical rules established for the translation of the German manuscript into English, Russian, and Farsi.

## 1. Tone & Style
- **Native Flow:** The translation should not be a 1-to-1 literal translation. It must feel like it was originally written by a native speaker of the target language.
- **Narrative Voice:** Maintain the voice of a memoir—personal, reflective, and occasionally high-tension.
- **Dynamic Tenses:** As detailed in `Zeitenanalyse.md`, the manuscript uses a mix of tenses:
  - **Past Tense (Präteritum):** For general storytelling and chronological reporting.
  - **Present Tense (Präsens):** For high-tension moments (interrogations, court scenes, military alerts) to create immediacy.

## 2. Formatting Constraints
- **No Emphasis Symbols:** Do NOT use asterisks (`*`) for italics or emphasis. 
- **No Em-Dashes:** Do NOT use em-dashes (`—`). Use colons (`:`) or commas (`,`) instead to maintain sentence flow.
- **Plain Text Integrity:** Keep the formatting simple and consistent with the legacy `cookiesInIran.txt` and the Markdown files in `locales/`.

## 3. Specific Terminology
- **Ghostbusters:** Keep the reference to "Ghostbusters" and the "Who you gonna call?" catchphrase, as they are globally recognized.
- **Mercedes W124:** Ensure the specific car model and its "Steel Tank" nickname are preserved.
- **Taarof:** Preserve the Persian concept of "Taarof" and its explanation in the epilogue.

## 4. Workflow
- **Pacing:** Strictly Chapter-by-Chapter translation.
- **Verification:** Combined AI review (for flow/tenses) and manual user review (for final approval).
- **Build Integration:** After any translation update, run `python3 build.py` to generate the localized PDFs and web fragments.

## 5. Directory Structure
- **Source:** `cookiesInIran.txt` (legacy German) or `locales/de/manuscript.md` (active German).
- **Targets:**
  - `locales/en/manuscript.md` (English)
  - `locales/ru/manuscript.md` (Russian)
  - `locales/fa/manuscript.md` (Farsi)
