import re
import sys
import glob

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # If no img tags, skip
    if '<img ' not in content and '<img\n' not in content and '<img\r\n' not in content:
        return

    # Add import if missing
    if "import Image from 'next/image';" not in content and 'import Image from "next/image";' not in content:
        # try to insert after the first import or at top
        if "import " in content:
            content = re.sub(r'(import [^\n]+)', r"\1\nimport Image from 'next/image';", content, count=1)
        else:
            content = "import Image from 'next/image';\n" + content

    # 1. handle <img src="..." alt="..." style={{...}} />
    def replacer(m):
        full = m.group(0)
        # avoid replacing if it doesn't match single line straightforward <img src="" alt="" style="" /> pattern easily
        if 'src=' not in full:
            return full
            
        src_match = re.search(r'src=("[^"]+"|{[^}]+})', full)
        alt_match = re.search(r'alt=("[^"]+"|{[^}]+})', full)
        style_match = re.search(r'style={({[^}]+})}', full)
        if not style_match:
            style_match = re.search(r'style={([^}]+)}', full)

        if src_match:
            src = src_match.group(1)
            alt = alt_match.group(1) if alt_match else '""'
            
            # extract width/height from full
            width_match = re.search(r'width={?([0-9]+)}?', full)
            height_match = re.search(r'height={?([0-9]+)}?', full)
            
            # default dummy w/h
            w = width_match.group(1) if width_match else "200"
            h = height_match.group(1) if height_match else "200"

            if style_match:
                style = style_match.group(1)
                # Need to use <Image ... />
                # Wait, what if the original had a key={...}?
                key_match = re.search(r'key=("[^"]+"|{[^}]+})', full)
                key_str = f" key={key_match.group(1)}" if key_match else ""
                
                return f'<Image{key_str} src={src} alt={alt} width={{{w}}} height={{{h}}} unoptimized style={{{style}}} />'
            else:
                key_match = re.search(r'key=("[^"]+"|{[^}]+})', full)
                key_str = f" key={key_match.group(1)}" if key_match else ""
                return f'<Image{key_str} src={src} alt={alt} width={{{w}}} height={{{h}}} unoptimized />'
            
        return full

    content = re.sub(r'<img [^>]+/>', replacer, content)

    with open(filepath, 'w') as f:
        f.write(content)

files = [
    'components/research/EvidenceSafetyTabs.tsx',
    'components/research/ProductResearchPanel.tsx',
    'components/research/StackBuilder.tsx'
]

for file in files:
    try:
        process_file(file)
        print(f"Processed {file}")
    except Exception as e:
        print(f"Error on {file}: {e}")

