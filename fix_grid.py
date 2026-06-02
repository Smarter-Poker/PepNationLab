import re

with open('components/AgentStorefrontGrid.tsx', 'r') as f:
    content = f.read()

content = content.replace("10x ${size}${measure} Vials", "10x ${size}${measure} Viles")

with open('components/AgentStorefrontGrid.tsx', 'w') as f:
    f.write(content)

