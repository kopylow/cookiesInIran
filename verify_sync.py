import sys

def normalize(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    norm_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if line.startswith('# '):
            line = line[2:].strip()
            
        if line.startswith('- '):
            line = '• ' + line[2:].strip()
            
        norm_lines.append(line)
    return norm_lines

txt_lines = normalize('cookiesInIran.txt')
md_lines = normalize('locales/de/manuscript.md')

if txt_lines == md_lines:
    print("SUCCESS: The text contents are identical.")
else:
    print(f"ERROR: Differences found! txt has {len(txt_lines)} lines, md has {len(md_lines)} lines")
    for i in range(max(len(txt_lines), len(md_lines))):
        t = txt_lines[i] if i < len(txt_lines) else "<EOF>"
        m = md_lines[i] if i < len(md_lines) else "<EOF>"
        if t != m:
            print(f"Mismatch at logical block {i+1}:")
            print(f"TXT: {t}")
            print(f"MD : {m}")
            sys.exit(1)
