#!/usr/bin/env python3
"""Surgical patch: remove Semaglutide + The Furnace Stack + The Lipolysis Stack
from the storefront "Top 10 Best Peptides" card so the already-ranked-next
Tirzepatide + Retatrutide surface. Stacks get a +20000 rank bonus, so they must
be filtered explicitly (a TOP10_EXCLUDE set) rather than dropped from
POPULAR_ORDER. Patches two files, assertion-guarded: each anchor must occur
exactly once, else abort WITHOUT writing anything."""
import sys, os

ROOT = sys.argv[1]

EXCLUDE_BLOCK = (
    "// Base names excluded from the storefront \"Top 10 Best Peptides\" card.\n"
    "// Removing them frees slots so Tirzepatide + Retatrutide (already ranked\n"
    "// next in POPULAR_ORDER) surface. Stacks otherwise get a +20000 rank bonus,\n"
    "// so they must be filtered here rather than merely dropped from POPULAR_ORDER.\n"
    "const TOP10_EXCLUDE = new Set<string>([\n"
    "  'SEMAGLUTIDE',\n"
    "  'THE FURNACE STACK',\n"
    "  'THE LIPOLYSIS STACK',\n"
    "]);\n"
)

patches = []

# ---- File 1: client grid (components/AgentStorefrontGrid.tsx) ---------------
GRID = os.path.join(ROOT, "components/AgentStorefrontGrid.tsx")

G1_OLD = "  'Selank',\n];\n\nconst CARD_MAPPINGS = [\n"
G1_NEW = "  'Selank',\n];\n\n" + EXCLUDE_BLOCK + "\nconst CARD_MAPPINGS = [\n"

G2_OLD = (
    "      for (const item of result) {\n"
    "        const baseName = item.g.name.replace(/\\s*\\(.*\\)\\s*$/, '').trim().toUpperCase();\n"
    "        if (!seenBaseNames.has(baseName)) {\n"
)
G2_NEW = (
    "      for (const item of result) {\n"
    "        const baseName = item.g.name.replace(/\\s*\\(.*\\)\\s*$/, '').trim().toUpperCase();\n"
    "        if (TOP10_EXCLUDE.has(baseName)) continue;\n"
    "        if (!seenBaseNames.has(baseName)) {\n"
)
patches.append((GRID, [(G1_OLD, G1_NEW), (G2_OLD, G2_NEW)]))

# ---- File 2: city-page server resolver (lib/cities/top10-server.ts) --------
SRV = os.path.join(ROOT, "lib/cities/top10-server.ts")

S1_OLD = "  'Selank',\n];\n\nconst isBacWaterItem ="
S1_NEW = "  'Selank',\n];\n\n" + EXCLUDE_BLOCK + "\nconst isBacWaterItem ="

S2_OLD = (
    "    const seen = new Map<string, Group>();\n"
    "    for (const g of ranked) {\n"
    "      const base = g.name.replace(/\\s*\\(.*\\)\\s*$/, '').trim().toUpperCase();\n"
    "      if (!seen.has(base)) seen.set(base, g);\n"
)
S2_NEW = (
    "    const seen = new Map<string, Group>();\n"
    "    for (const g of ranked) {\n"
    "      const base = g.name.replace(/\\s*\\(.*\\)\\s*$/, '').trim().toUpperCase();\n"
    "      if (TOP10_EXCLUDE.has(base)) continue;\n"
    "      if (!seen.has(base)) seen.set(base, g);\n"
)
patches.append((SRV, [(S1_OLD, S1_NEW), (S2_OLD, S2_NEW)]))

# ---- Apply (assertion-guarded) ---------------------------------------------
for path, edits in patches:
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    if "TOP10_EXCLUDE" in src:
        print(f"SKIP (already patched): {path}")
        continue
    new = src
    for old, rep in edits:
        n = new.count(old)
        if n != 1:
            print(f"ABORT: anchor occurs {n}x (expected 1) in {path}:\n---\n{old}\n---")
            sys.exit(2)
        new = new.replace(old, rep)
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"PATCHED: {path}")

print("PATCH_OK")
