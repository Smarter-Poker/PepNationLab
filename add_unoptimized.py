import re

files_to_update = [
    'components/Navbar.tsx',
    'components/AgentBundles.tsx',
    'components/FooterSection.tsx',
    'components/AgentStoreProducts.tsx',
    'components/AgentInventory.tsx',
    'components/AgentStorefrontGrid.tsx',
    'components/research/DynamicCalculatorHero.tsx'
]

for filepath in files_to_update:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        # We will use regex to find <Image ... /> and add unoptimized if missing.
        # Note: we need to make sure we don't accidentally match <ImageUploadResponse or something.
        def replacer(m):
            tag = m.group(0)
            if 'unoptimized' not in tag and 'src=' in tag:
                # insert unoptimized before closing />
                if '/>' in tag:
                    return tag.replace('/>', 'unoptimized />')
                else:
                    return tag
            return tag

        # Regex to match <Image ... /> potentially over multiple lines.
        new_content = re.sub(r'<Image(?![a-zA-Z])[^>]*/>', replacer, content)

        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error on {filepath}: {e}")
