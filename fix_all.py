import os

project_dir = "/Users/smarter.poker/Documents/pepnationlab"

# Directories to search
dirs_to_check = ['app', 'components', 'lib', 'ui', 'public']

for dir_name in dirs_to_check:
    target_dir = os.path.join(project_dir, dir_name)
    if not os.path.exists(target_dir):
        continue
        
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.json'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if '—' in content:
                    new_content = content.replace('—', '-')
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

print("Done replacing em dashes globally.")
