import os
import re

def process_directory(directory):
    for root, dirs, files in os.walk(directory):
        # Exclude node_modules, .next, .git, .v3-staging
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git', '.v3-staging', 'venv')]
        
        for file in files:
            if not (file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.jsx') or file.endswith('.js')):
                continue
                
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
                
            # Find all <Image ... />
            # It can span multiple lines
            image_tags = re.findall(r'<Image[^>]+>', content)
            
            for tag in image_tags:
                if 'unoptimized' not in tag:
                    print(f"Missing unoptimized in {filepath}: {tag}")

process_directory('.')
