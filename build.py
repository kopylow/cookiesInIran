import os
import subprocess
import re
import shutil
from pathlib import Path

# --- Configuration ---
ROOT = Path(__file__).resolve().parent
LOCALES_DIR = ROOT / "locales"
TEX_DIR = ROOT / "tex-book"
WEB_DIR = ROOT / "web-landing-page"

LATEX_REPLACEMENTS = {
    "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_",
    "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
}

LANG_MAP = {
    "de": "german", "en": "english", "ru": "russian", "fa": "persian"
}

TITLE_MAP = {
    "de": "Kekse im Iran",
    "en": "Cookies in Iran",
    "ru": "Печенье в Иране",
    "fa": "کلوچه‌ها در ایران"
}

AUTHOR_MAP = {
    "de": "Anton Kopylow",
    "en": "Anton Kopylow",
    "ru": "Антон Копылов",
    "fa": "آنتون کپیلوف"
}

COPYRIGHT_MAP = {
    "de": "© 2026 Anton Kopylow. Alle Rechte vorbehalten.",
    "en": "© 2026 Anton Kopylow. All rights reserved.",
    "ru": "© 2026 Антон Копылов. Все права защищены.",
    "fa": "© ۲۰۲۶ آنتون کپیلوف. تمامی حقوق محفوظ است."
}

def escape_latex(text: str) -> str:
    for char, replacement in LATEX_REPLACEMENTS.items():
        text = text.replace(char, replacement)
    return text

def md_to_latex(content: str) -> str:
    lines = content.splitlines()
    output = []
    in_list = False
    
    for line in lines:
        # Robust stripping including NBSP
        clean_line = line.strip().replace('\u00a0', '').strip()
        
        # Handle empty lines
        if not clean_line:
            if in_list:
                output.append("\\end{itemize}")
                in_list = False
            output.append("")
            continue
            
        # Handle Headers (Chapters)
        if clean_line.startswith("# "):
            if in_list:
                output.append("\\end{itemize}")
                in_list = False
            title = clean_line[2:].strip()
            output.append(f"\\chapter{{{escape_latex(title)}}}")
            continue
            
        # Handle Lists
        if clean_line.startswith("- "):
            if not in_list:
                output.append("\\begin{itemize}")
                in_list = True
            output.append(f"  \\item {escape_latex(clean_line[2:].strip())}")
            continue
            
        # Handle normal text
        if in_list:
            output.append("\\end{itemize}")
            in_list = False
        
        output.append(escape_latex(clean_line) + "\n")
        
    if in_list:
        output.append("\\end{itemize}")
        
    return "\n".join(output)

def md_to_html(content: str, lang: str) -> str:
    lines = content.splitlines()
    output = []
    dir_attr = ' dir="rtl"' if lang == "fa" else ""
    in_list = False
    
    present_indices = [1, 4, 5, 6]
    images = [
        "Pics/IMG20250326155129.jpg",
        "Pics/IMG20250404174150.jpg",
        "Pics/IMG20250406120444.jpg",
        "Pics/IMG20250409181112.jpg",
        "Pics/IMG20250418180248.jpg",
        "Pics/IMG20250422144952.jpg",
        "Pics/IMG20260115120128.jpg",
        "Pics/IMG20260222151627.jpg",
        "Pics/WhatsApp_Image_2026-05-03_at_16.44.59.jpeg"
    ]
    
    ch_index = -1
    
    for line in lines:
        line = line.strip().replace('\u00a0', '').strip()
        if not line:
            if in_list: output.append("</ul>"); in_list = False
            continue
        if line.startswith("# "):
            if in_list: output.append("</ul>"); in_list = False
            if ch_index >= 0:
                btn_text = "Discuss this chapter" if lang != "de" else "Dieses Kapitel diskutieren"
                output.append(f'<div class="discuss-wrapper"><button class="discuss-btn" data-chapter="{ch_index}">{btn_text}</button></div>')
                
            ch_index += 1
            tense = "present" if ch_index in present_indices else "past"
            
            if ch_index > 0:
                img = images[(ch_index - 1) % len(images)]
                output.append(f'<div class="airlock" style="background-image: url(\'{img}\');"></div>')
                
            output.append(f'<h1{dir_attr} data-tense="{tense}">{line[2:].strip()}</h1>')
        elif line.startswith("- "):
            if not in_list: output.append(f"<ul{dir_attr}>"); in_list = True
            output.append(f"  <li>{line[2:].strip()}</li>")
        else:
            if in_list: output.append("</ul>"); in_list = False
            output.append(f"<p{dir_attr}>{line}</p>")
    if in_list: output.append("</ul>")
    
    if ch_index >= 0:
        btn_text = "Discuss this chapter" if lang != "de" else "Dieses Kapitel diskutieren"
        output.append(f'<div class="discuss-wrapper"><button class="discuss-btn" data-chapter="{ch_index}">{btn_text}</button></div>')
        
    return "\n".join(output)

def build_pdf(lang: str):
    print(f"  -> {lang.upper()}: Generiere PDF...", end="\r")
    
    # Create the needed manuscript .tex file
    manuscript_file = f"manuscript_{lang}.tex"
    md_content = LOCALES_DIR.joinpath(lang, "manuscript.md").read_text(encoding="utf-8")
    (TEX_DIR / manuscript_file).write_text(md_to_latex(md_content), encoding="utf-8")
    
    template = (TEX_DIR / "main.tex").read_text(encoding="utf-8")
    
    # Typography settings
    typo_fix = ["\\widowpenalty=1000", "\\clubpenalty=1000", "\\brokenpenalty=500", "\\displaywidowpenalty=500"]
    
    # Language & Font Setup
    poly_lang = LANG_MAP.get(lang, "english")
    lang_setup = ["\\usepackage{polyglossia}", f"\\setmainlanguage{{{poly_lang}}}", "\\usepackage{fontspec}"] + typo_fix
    
    if lang in ["de", "en"]:
        lang_setup.append("\\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf]")
    else:
        lang_setup.append("\\setmainfont{DejaVu Sans}")
        if lang == "ru": lang_setup.append("\\newfontfamily\\cyrillicfont{DejaVu Sans}")

    # Preamble and Template Cleaning
    template = re.sub(r'\\usepackage\[T1\]\{fontenc\}', '', template)
    template = re.sub(r'\\usepackage\[utf8\]\{inputenc\}', '', template)
    template = re.sub(r'\\usepackage\[.*?\]\{babel\}', '', template)
    template = re.sub(r'\\usepackage\{lmodern\}', '', template)
    
    # Remove word count lines from template
    template = re.sub(r'.*?wordcount.*?\n', '', template)
    
    template = template.replace("Cookies in Iran", TITLE_MAP.get(lang, "Cookies in Iran"))
    template = template.replace("[AUTHOR_NAME]", AUTHOR_MAP.get(lang, "Anton Kopylow"))
    template = template.replace("[COPYRIGHT_TEXT]", COPYRIGHT_MAP.get(lang, "© 2026 Anton Kopylow. All rights reserved."))
    
    template = template.replace("\\documentclass[12pt,openany]{book}", "\\documentclass[12pt,openany]{book}\n" + "\n".join(lang_setup))
    
    if lang == "fa":
        template = template.replace("\\begin{document}", "\\usepackage{xepersian}\n\\settextfont{DejaVu Sans}\n\\begin{document}")

    template = template.replace("\\input{manuscript.tex}", f"\\input{{{manuscript_file}}}")
    
    temp_main_file = f"main_{lang}.tex"
    (TEX_DIR / temp_main_file).write_text(template, encoding="utf-8")
    
    success = True
    try:
        for _ in range(2):
            result = subprocess.run(["xelatex", "-interaction=nonstopmode", temp_main_file], 
                           cwd=TEX_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if result.returncode != 0:
                print(f"XeLaTeX Error:\n{result.stdout}\n{result.stderr}")
                success = False
                break
    except Exception as e:
        print(f"Exception: {e}")
        success = False

    # CLEANUP
    extensions = [".aux", ".log", ".out", ".toc", ".tex"]
    for ext in extensions:
        p = TEX_DIR / f"main_{lang}{ext}"
        if p.exists(): p.unlink()
    (TEX_DIR / manuscript_file).unlink(missing_ok=True)

    if success:
        pdf_path = TEX_DIR / f"main_{lang}.pdf"
        if pdf_path.exists():
            new_name = TITLE_MAP.get(lang, "Cookies in Iran").replace(" ", "_") + ".pdf"
            pdf_path.rename(TEX_DIR / new_name)
        print(f"  [OK] {lang.upper()}: PDF bereit.       ")
    else:
        print(f"  [FAIL] {lang.upper()}: Fehler beim PDF-Build.")

def main():
    print("--- Starte Build-Prozess (ohne Wordcount) ---")
    TEX_DIR.mkdir(exist_ok=True)
    WEB_DIR.mkdir(exist_ok=True)

    for lang in ["de", "en", "ru", "fa"]:
        lang_dir = LOCALES_DIR / lang
        if not lang_dir.exists(): continue
        md_file = lang_dir / "manuscript.md"
        if not md_file.exists(): continue
        
        content = md_file.read_text(encoding="utf-8")
        (WEB_DIR / f"manuscript_{lang}.html").write_text(md_to_html(content, lang), encoding="utf-8")
        build_pdf(lang)

    print("\nKopiere Bilder in das Web-Verzeichnis...")
    if (WEB_DIR / "Pics").exists():
        shutil.rmtree(WEB_DIR / "Pics")
    shutil.copytree(ROOT / "Pics", WEB_DIR / "Pics")

    print("\nFertig!")

if __name__ == "__main__":
    main()
