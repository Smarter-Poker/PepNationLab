import re

with open('components/AgentStorefrontGrid.tsx', 'r') as f:
    content = f.read()

content = content.replace("'Bac. Water 10x 10ml'", "'Bac. Water 10x 10ml Viles'")

with open('components/AgentStorefrontGrid.tsx', 'w') as f:
    f.write(content)

