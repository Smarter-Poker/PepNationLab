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
                return f'<Image src={src} alt={alt} width={{{w}}} height={{{h}}} unoptimized style={{{style}}} />'
            else:
                return f'<Image src={src} alt={alt} width={{{w}}} height={{{h}}} unoptimized />'
            
        return full

    content = re.sub(r'<img [^>]+/>', replacer, content)

    # Manual multiline replacers for known difficult tags
    content = re.sub(
        r'<img\s*\n\s*src={p.imageUrl}\s*\n\s*alt={p.productName}\s*\n\s*width={108}\s*\n\s*height={108}\s*\n\s*style={{ borderRadius: 6, objectFit: \'cover\' }}\s*\n\s*/>',
        '<Image src={p.imageUrl} alt={p.productName} width={108} height={108} unoptimized style={{ borderRadius: 6, objectFit: \'cover\' }} />',
        content
    )
    
    content = re.sub(
        r'<img\s*\n\s*src={p.imageUrl}\s*\n\s*alt={p.productName}\s*\n\s*width={84}\s*\n\s*height={84}\s*\n\s*style={{ borderRadius: 6, objectFit: \'cover\' }}\s*\n\s*/>',
        '<Image src={p.imageUrl} alt={p.productName} width={84} height={84} unoptimized style={{ borderRadius: 6, objectFit: \'cover\' }} />',
        content
    )
    
    content = re.sub(
        r'<img\s*\n\s*src={comp.thumbnail}\s*\n\s*alt={comp.name}\s*\n\s*style={{ width: \'100%\', height: \'100%\', objectFit: \'cover\' }}\s*\n\s*/>',
        '<Image src={comp.thumbnail} alt={comp.name} width={200} height={200} unoptimized style={{ width: \'100%\', height: \'100%\', objectFit: \'cover\' }} />',
        content
    )

    with open(filepath, 'w') as f:
        f.write(content)

files = [
    'components/research/MatchForm.tsx',
    'components/research/StacksClient.tsx',
    'components/storefront/StorefrontDiscovery.tsx',
    'components/storefront/StorefrontBackButton.tsx',
    'components/storefront/StorefrontCompareDrawer.tsx',
    'components/messenger/MessagePane.tsx',
    'components/messenger/MessageComposer.tsx',
    'components/researcher/SmartStackBuilder.tsx'
]

for file in files:
    try:
        process_file(file)
        print(f"Processed {file}")
    except Exception as e:
        print(f"Error on {file}: {e}")

