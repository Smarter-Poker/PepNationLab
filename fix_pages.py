import os
import re

app_dir = "/Users/smarter.poker/Documents/pepnationlab/app"

# 1. Replace em dashes with standard hyphens globally in app/
for root, dirs, files in os.walk(app_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if '—' in content:
                # Replace with standard hyphen or remove. We'll replace with ' - ' if it's ' — ', or '-'
                # Just replacing '—' with '-' is safest.
                new_content = content.replace('—', '-')
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

# 2. Fix CityPage.tsx specific issues
city_page = os.path.join(app_dir, "peptides", "[stateSlug]", "[citySlug]", "CityPage.tsx")
with open(city_page, 'r', encoding='utf-8') as f:
    city_content = f.read()

# a) Swap sections
glance_start = city_content.find("{/* ═════════════════════════════════════════════════\n            AT A GLANCE")
featured_start = city_content.find("{/* ═════════════════════════════════════════════════\n            FEATURED PEPTIDES")
why_start = city_content.find("{/* ═════════════════════════════════════════════════\n            WHY PEP NATION LAB")

if glance_start != -1 and featured_start != -1 and why_start != -1:
    glance_section = city_content[glance_start:featured_start]
    featured_section = city_content[featured_start:why_start]
    
    # Swap them
    new_city_content = city_content[:glance_start] + featured_section + glance_section + city_content[why_start:]
    city_content = new_city_content

# b) Replace pill titles with normal dynamic titles
# Let's define what a normal dynamic title is. The user just wants a normal title, perhaps just an h3 or a span with a normal font.
# We'll replace the complex pill styles with a simple h3.

# Pill 1: Research Catalog
pill1 = """<div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'var(--teal-subtle)', border: 'var(--border-teal)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
                </svg>
                Research Catalog
              </div>"""

new_pill1 = """<h3 style={{ color: 'var(--teal)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                Research Catalog
              </h3>"""
city_content = city_content.replace(pill1, new_pill1)

# Pill 2: Why Researchers Choose Us
pill2 = """<div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.15)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--grey-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>
                Why Researchers Choose Us
              </div>"""
new_pill2 = """<h3 style={{ color: 'var(--grey-300)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                Why Researchers Choose Us
              </h3>"""
city_content = city_content.replace(pill2, new_pill2)

# Pill 3: Agent Network
pill3 = """<div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--teal-subtle)', border: 'var(--border-teal)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>
                  {region} Agent Network
                </div>"""
new_pill3 = """<h3 style={{ color: 'var(--teal)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                  {region} Agent Network
                </h3>"""
city_content = city_content.replace(pill3, new_pill3)

# Pill 4: Common Questions
pill4 = """<div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.15)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--grey-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>
                Common Questions
              </div>"""
new_pill4 = """<h3 style={{ color: 'var(--grey-300)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                Common Questions
              </h3>"""
city_content = city_content.replace(pill4, new_pill4)

with open(city_page, 'w', encoding='utf-8') as f:
    f.write(city_content)

print("Done")
