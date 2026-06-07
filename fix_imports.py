import os

files = [
    "components/research/PinToCompareButton.tsx",
    "components/storefront/DynamicAddToCartButton.tsx",
    "components/storefront/DynamicCartButton.tsx",
    "components/storefront/DynamicCompareButton.tsx",
    "components/storefront/DynamicDetailButton.tsx",
    "components/storefront/ProductModalEnhancements.tsx"
]

for f in files:
    with open(f, "r") as file:
        content = file.read()
    if "import Image from" not in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith("import "):
                lines.insert(i, "import Image from 'next/image';")
                break
        else:
            lines.insert(0, "import Image from 'next/image';")
        with open(f, "w") as file:
            file.write('\n'.join(lines))
        print(f"Fixed {f}")
    else:
        print(f"Skipped {f}")
