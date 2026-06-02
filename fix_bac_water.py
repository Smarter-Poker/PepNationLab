import re

with open('components/AgentStoreProducts.tsx', 'r') as f:
    content = f.read()

# Replace dividing by 10
content = content.replace('(p.agent_cost / 10).toFixed(2)', '(p.agent_cost / (/bac\\.?\\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)')
content = content.replace('(Number(editForm.retail_price) / 10).toFixed(2)', '(Number(editForm.retail_price) / (/bac\\.?\\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)')
content = content.replace('(Number((editForm as any).retail_price) / 10).toFixed(2)', '(Number((editForm as any).retail_price) / (/bac\\.?\\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)')
content = content.replace('(Number(p.retail_price) / 10).toFixed(2)', '(Number(p.retail_price) / (/bac\\.?\\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)')
content = content.replace('(Number(p.sale_price) / 10).toFixed(2)', '(Number(p.sale_price) / (/bac\\.?\\s*water/i.test(p.products?.name || "") ? 1 : 10)).toFixed(2)')
content = content.replace('(agentCostPer10 / 10).toFixed(2)', '(agentCostPer10 / (/bac\\.?\\s*water/i.test(currentProduct?.products?.name || "") ? 1 : 10)).toFixed(2)')

# Replace " / Vial"
content = content.replace(' / Vial<', ' / {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}<')
content = content.replace(' / Vial\n', ' / {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}\n')
content = content.replace(' / Vial<', ' / {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}<')
# also handle plain text
content = content.replace('> / Vial<', '> / {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}<')
content = content.replace('> $ / Vial<', '> $ / {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}<')
content = content.replace('$ / Vial', '$ / {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}')
content = content.replace('/ Vial</span>', '/ {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}</span>')
content = content.replace('/ Vial\n', '/ {/bac\\.?\\s*water/i.test(p.products?.name || "") ? "10-Pack" : "Vial"}\n')

with open('components/AgentStoreProducts.tsx', 'w') as f:
    f.write(content)

