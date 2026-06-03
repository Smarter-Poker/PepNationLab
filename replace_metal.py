import os
import re

TARGET_DIRS = ['app', 'components']
REPLACEMENTS = {
    'card-metal': 'glass-panel',
    'metal-frame': 'glass-panel',
    'metal-content': '',
    'metal-embossed-panel': 'glass-panel',
    'hover-lift-metal': 'hover-lift'
}

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    for old, new in REPLACEMENTS.items():
        # Only replace exact class names in quotes to be safe, but actually they might be mixed like "card-metal hover-lift"
        content = re.sub(r'\b' + re.escape(old) + r'\b', new, content)
    
    # cleanup empty classNames
    content = re.sub(r'className="\s+"', 'className=""', content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    for d in TARGET_DIRS:
        for root, _, files in os.walk(d):
            for file in files:
                if file.endswith(('.tsx', '.ts', '.css')):
                    replace_in_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
