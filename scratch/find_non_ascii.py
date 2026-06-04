import os

files_to_check = [
    'components/research/CompareTool.tsx',
    'components/storefront/StorefrontCompareDrawer.tsx',
    'components/research/CalculatorSuite.tsx',
    'components/storefront/StorefrontDiscovery.tsx',
    'app/api/researcher/helpful-data/route.ts',
    'app/api/storefront/semantic/route.ts',
    'components/AgentStorefrontGrid.tsx',
    'components/Messaging.tsx',
    'components/NavbarNotificationBell.tsx'
]

out_lines = []

for rel_path in files_to_check:
    abs_path = os.path.join('/Users/smarter.poker/Documents/pepnationlab', rel_path)
    if not os.path.exists(abs_path):
        out_lines.append(f"\nSkipping non-existent: {rel_path}\n")
        continue
    out_lines.append(f"\nChecking: {rel_path}\n")
    with open(abs_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        non_ascii = [c for c in line if ord(c) > 127]
        if non_ascii:
            out_lines.append(f"  Line {idx+1}: {''.join(non_ascii)} | {line.strip()}\n")

with open('/Users/smarter.poker/Documents/pepnationlab/scratch/non_ascii_scan.txt', 'w', encoding='utf-8') as f:
    f.writelines(out_lines)

print("Done writing to scratch/non_ascii_scan.txt")
