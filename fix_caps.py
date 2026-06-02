import re

files = [
    'components/sales/SalesPageV2.tsx',
    'components/wallet/WalletPage.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Find the main return statement's wrapper div
    # Usually `return (` followed by `<div`
    # We will just insert `textTransform: 'capitalize', ` into the first `<div style={{` after `return (`
    
    parts = content.split('return (', 1)
    if len(parts) == 2:
        if '<div style={{' in parts[1]:
            parts[1] = parts[1].replace('<div style={{', '<div style={{ textTransform: \'capitalize\',', 1)
        elif '<div className=' in parts[1]:
            # if no style, add it
            # this is a bit brittle, so let's do a more robust string replacement
            # but usually it's `<div style={{` or `<div className="something">`
            pass
            
        with open(file, 'w') as f:
            f.write(parts[0] + 'return (' + parts[1])

