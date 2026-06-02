import os
import glob
import re

# 1. Update globals.css
globals_path = 'app/globals.css'
with open(globals_path, 'r') as f:
    content = f.read()

root_insertion = """  --bg-metal-dark: linear-gradient(180deg, #0b0f16 0%, #121822 100%);
  --bg-glass-teal: linear-gradient(135deg, rgba(0,196,188,0.08) 0%, rgba(0,229,255,0.04) 100%);
}"""

if '--bg-metal-dark' not in content:
    # Find the FIRST closing brace of :root
    # We know :root is around line 10. We can replace the specific string `--surface-2: rgba(255,255,255,0.06);`
    content = content.replace(
        '  --surface-2: rgba(255,255,255,0.06);',
        '  --surface-2: rgba(255,255,255,0.06);\n\n  --bg-metal-dark: linear-gradient(180deg, #0b0f16 0%, #121822 100%);\n  --bg-glass-teal: linear-gradient(135deg, rgba(0,196,188,0.08) 0%, rgba(0,229,255,0.04) 100%);'
    )
    with open(globals_path, 'w') as f:
        f.write(content)
    print("Updated globals.css")

# 2. Update all components
components_dir = 'components/**/*.tsx'
files = glob.glob(components_dir, recursive=True)

metal_pattern = re.compile(r"background:\s*'linear-gradient\(180deg,\s*#0b0f16\s*0%,\s*#121822\s*100%\)'")
teal_pattern = re.compile(r"background:\s*'linear-gradient\(135deg,\s*rgba\(0,196,188,0\.08\)\s*0%,\s*rgba\(0,229,255,0\.04\)\s*100%\)'")

metal_count = 0
teal_count = 0

for file_path in files:
    with open(file_path, 'r') as f:
        original_content = f.read()
    
    new_content = original_content
    
    # Replace metal
    if metal_pattern.search(new_content):
        new_content = metal_pattern.sub("background: 'var(--bg-metal-dark)'", new_content)
        metal_count += 1
        
    # Replace teal
    if teal_pattern.search(new_content):
        new_content = teal_pattern.sub("background: 'var(--bg-glass-teal)'", new_content)
        teal_count += 1
        
    if new_content != original_content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Updated {file_path}")

print(f"Total files updated for metal: {metal_count}")
print(f"Total files updated for teal: {teal_count}")
