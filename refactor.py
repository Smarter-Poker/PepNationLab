import re

with open('components/AgentStorefrontGrid.tsx', 'r') as f:
    content = f.read()

# Find the start of the map function
map_start_str = "{filteredProducts.slice(0, visibleCount).map((group) => {\n"
map_start_idx = content.find(map_start_str)

# Find the end of the map function
map_end_str = "        })}\n"
map_end_idx = content.find(map_end_str, map_start_idx) + len("        })}")

# The body is what's inside
body = content[map_start_idx + len(map_start_str):map_end_idx - len("        })}")]

# Now we want to place `const renderProductCard = (group: GroupedProduct) => { ... }` before `return (`
return_str = "  return (\n    <div style={{ display: 'flex', flexDirection: 'column' }}>"
return_idx = content.find(return_str)

if map_start_idx != -1 and return_idx != -1:
    render_func = f"  const renderProductCard = (group: GroupedProduct) => {{\n{body}\n  }};\n\n"
    
    # insert render_func before return_str
    new_content = content[:return_idx] + render_func + content[return_idx:]
    
    # now replace the map body
    map_start_str_new = "{filteredProducts.slice(0, visibleCount).map((group) => {\n"
    new_map_start_idx = new_content.find(map_start_str_new)
    new_map_end_idx = new_content.find(map_end_str, new_map_start_idx) + len(map_end_str)
    
    replacement_grid = """{showFeatured && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-5)' }}>
            <div style={{ background: primaryColor, padding: '6px', borderRadius: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--white)', margin: 0, fontWeight: 700 }}>Featured Products</h2>
          </div>
          <motion.div
            className="grid-3" style={{ gap: 'var(--space-6)' }}
            variants={containerVariants} initial="hidden" animate="show"
          >
            {featuredGroups.map(renderProductCard)}
          </motion.div>
        </div>
      )}

      {true && (
        <motion.div
          className="grid-3" style={{ gap: 'var(--space-6)', display: filteredProducts.length === 0 ? 'none' : undefined }}
          variants={containerVariants} initial="hidden" animate="show"
          key={`${filterCategory}-${sortBy}-${searchQuery}`}
        >
        {filteredProducts.slice(0, visibleCount).map(renderProductCard)}
        </motion.div>"""
        
    final_content = new_content[:new_map_start_idx - len("      {true && (\n        <motion.div\n          className=\"grid-3\" style={{ gap: 'var(--space-6)', display: filteredProducts.length === 0 ? 'none' : undefined }}\n          variants={containerVariants} initial=\"hidden\" animate=\"show\"\n          key={`${filterCategory}-${sortBy}-${searchQuery}`}\n        >\n")] + replacement_grid + new_content[new_map_end_idx:]
    
    with open('components/AgentStorefrontGrid.tsx', 'w') as f:
        f.write(final_content)
    print("Refactoring successful!")
else:
    print("Could not find targets")
