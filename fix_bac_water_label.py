import re

with open('components/AgentStoreProducts.tsx', 'r') as f:
    content = f.read()

content = content.replace('"10-Pack"', '"10x 10ml Viles"')

with open('components/AgentStoreProducts.tsx', 'w') as f:
    f.write(content)

