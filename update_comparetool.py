import re

with open('/Users/smarter.poker/Documents/pepnationlab/components/research/CompareTool.tsx', 'r') as f:
    content = f.read()

# Add import if missing
if "import Image from 'next/image';" not in content:
    content = content.replace("import IframeModal from '@/components/ui/IframeModal';", "import IframeModal from '@/components/ui/IframeModal';\nimport Image from 'next/image';")

# 1. handle the multiline img
content = re.sub(
    r'// eslint-disable-next-line @next/next/no-img-element\n\s*<img \n\s*src={src} \n\s*alt={alt} \n\s*style={{\n\s*height: \'42px\', \n\s*width: \'auto\', \n\s*maxWidth: \'none\',\n\s*objectFit: \'contain\',\n\s*display: \'inline-block\',\n\s*verticalAlign: \'middle\',\n\s*flexShrink: 0\n\s*}} \n\s*/>',
    '<Image src={src} alt={alt} width={120} height={42} unoptimized style={{ height: \'42px\', width: \'auto\', maxWidth: \'none\', objectFit: \'contain\', display: \'inline-block\', verticalAlign: \'middle\', flexShrink: 0 }} />',
    content
)

# 2. handle <img src="..." alt="..." style={{...}} />
def replacer(m):
    full = m.group(0)
    # avoid replacing if it doesn't match single line straightforward <img src="" alt="" style="" /> pattern easily
    if 'src=' not in full or 'alt=' not in full or 'style=' not in full:
        return full
        
    src_match = re.search(r'src=("[^"]+"|{[^}]+})', full)
    alt_match = re.search(r'alt=("[^"]+"|{[^}]+})', full)
    style_match = re.search(r'style={({[^}]+})}', full)
    if not style_match:
        style_match = re.search(r'style={([^}]+)}', full)

    if src_match and alt_match and style_match:
        src = src_match.group(1)
        alt = alt_match.group(1)
        style = style_match.group(1)
        
        # for dynamic styles or complex ones, we keep the exact style content
        # For Next.js image we need a width/height or fill. Let's provide an arbitrary width=100 height=100 and unoptimized to ensure it works correctly when height is fixed by style.
        # But for 'width: "100%", height: "100%"', we could use fill if we also make the parent relative. But to be safe, we can just use width={200} height={200} unoptimized.
        return f'<Image src={src} alt={alt} width={{200}} height={{200}} unoptimized style={{{style}}} />'
        
    return full

content = re.sub(r'<img [^>]+/>', replacer, content)

# Additional manual replacements for any that were missed by the regex (e.g. multiline <img src={comp.thumbnail} ...)
content = re.sub(
    r'<img\s*\n\s*src={comp.thumbnail}\s*\n\s*alt={comp.name}\s*\n\s*style={{ width: \'100%\', height: \'100%\', objectFit: \'cover\' }}\s*\n\s*/>',
    '<Image src={comp.thumbnail} alt={comp.name} width={200} height={200} unoptimized style={{ width: \'100%\', height: \'100%\', objectFit: \'cover\' }} />',
    content
)

with open('/Users/smarter.poker/Documents/pepnationlab/components/research/CompareTool.tsx', 'w') as f:
    f.write(content)
