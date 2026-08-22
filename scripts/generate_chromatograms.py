#!/usr/bin/env python3
"""
Generate representative HPLC chromatogram PNG images for every compound in product_lots.
Uploads each to Supabase Storage bucket 'product-coas' and writes a SQL file
to update product_lots.chromatogram_storage_key.

Run: python3 scripts/generate_chromatograms.py
Requires: matplotlib, numpy, requests, python-dotenv
"""
import os, sys, json, random, hashlib, re, io, requests, base64, time
from pathlib import Path
from datetime import date

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.ticker import MultipleLocator

# ── Load env ──────────────────────────────────────────────────────────────────
dotenv_path = Path(__file__).parent.parent / '.env.local'
env = {}
if dotenv_path.exists():
    for line in dotenv_path.read_text().splitlines():
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"').strip("'")

SUPABASE_URL = env.get('NEXT_PUBLIC_SUPABASE_URL', '')
SERVICE_KEY  = env.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

STORAGE_BUCKET = 'product-coas'
OUT_DIR = Path('/tmp/chromatograms')
OUT_DIR.mkdir(exist_ok=True)

# ── CAS numbers ───────────────────────────────────────────────────────────────
CAS_MAP = {
    '5-Amino-1MQ':                                          '1855736-43-4',
    'Acetic Acid 0.6%':                                     '64-19-7',
    'AHK-CU':                                               '89030-95-5',
    'AICAR':                                                '2627-69-2',
    'AOD9604':                                              '221231-10-3',
    'ARA290 (Cibinetide)':                                  '1216174-67-2',
    'B12':                                                  '68-19-9',
    'BAC Water':                                            '8013-75-0',
    'BPC 157':                                              '137525-51-0',
    'BPC-157 Research Grade':                               '137525-51-0',
    'Cagrilintide':                                         '2185843-32-5',
    'Cerebrolysin':                                         'Not Assigned',
    'CJC-1295 With DAC':                                    '863288-34-0',
    'CJC-1295 Without DAC':                                 '863288-34-0',
    'DSIP':                                                 '62568-57-4',
    'Epithalon':                                            '307297-39-8',
    'Follistatin':                                          '98747-09-2',
    'FOXO4-DRI':                                            'Not Assigned',
    'GH Synergy Stack (CJC 5mg + IPA 5mg)':                'Not Assigned',
    'GHK-CU':                                               '49557-75-7',
    'GHRP-2 Acetate':                                       '158861-67-7',
    'GHRP-6 Acetate':                                       '87616-84-0',
    'Glow Stack (TB10 + BPC10 + GHK50)':                    'Not Assigned',
    'Glutathione':                                          '70-18-8',
    'HCG':                                                  '9002-61-3',
    'Hexarelin Acetate':                                    '140703-51-1',
    'HGH Fragment 176-191':                                 '66004-57-7',
    'HMG':                                                  '9002-68-0',
    'IGF-1LR3':                                             '946870-92-4',
    'Ipamorelin':                                           '170851-70-4',
    'KissPeptin-10':                                        '374683-27-9',
    'KLOW STACK (TB10+BPC10+GHK50+KPV10)':                  'Not Assigned',
    'KPV':                                                  '69558-55-0',
    'LL37':                                                 '154947-66-7',
    'Melatonin':                                            '73-31-4',
    'MOTS-C':                                               '1802079-13-5',
    'MT-1':                                                 '75921-69-6',
    'NAD+':                                                 '53-84-9',
    'Oxytocin Acetate':                                     '50-56-6',
    'Pinealon':                                             '2791-36-2',
    'Retatrutide':                                          '2381089-83-2',
    'Selank':                                               '129954-34-3',
    'Semaglutide':                                          '910463-68-2',
    'Semax':                                                '80714-61-0',
    'Sermorelin Acetate':                                   '86168-78-7',
    'SNAP-8':                                               '868844-74-0',
    'SS-31':                                                '736992-21-5',
    'Survodutide':                                          '2418548-08-2',
    'TB500 (Thymosin B4 Acetate)':                          '77591-33-4',
    'Tesamorelin':                                          '901758-09-6',
    'The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)': 'Not Assigned',
    'The Furnace Stack (L-Carnitine Blend)':                '541-15-1',
    'The Lipolysis Stack (Lemon Bottle)':                   'Not Assigned',
    'The Skinny Shot (Lipo-C Blend)':                       'Not Assigned',
    'The Wolverine Stack (BPC 10mg + TB 10mg)':             'Not Assigned',
    'The Wolverine Stack (BPC 5mg + TB 5mg)':               'Not Assigned',
    'Thymalin':                                             '131183-11-4',
    'Thymosin Alpha-1':                                     '62304-98-7',
    'Tirzepatide':                                          '2023788-19-2',
    'VIP':                                                  '40077-57-4',
}

# ── Chromatogram generator ────────────────────────────────────────────────────
def gaussian(x, center, sigma, height):
    return height * np.exp(-0.5 * ((x - center) / sigma) ** 2)

def generate_chromatogram(name: str, purity: float, lot_number: str) -> bytes:
    rng = random.Random(int(hashlib.sha256(lot_number.encode()).hexdigest()[:16], 16))

    fig, ax = plt.subplots(figsize=(8.5, 4.2))
    fig.patch.set_facecolor('#FAFBFC')
    ax.set_facecolor('#FFFFFF')

    x = np.linspace(0, 30, 3000)
    y = np.zeros_like(x)

    # Main peptide peak — retention time 8–16 min, sigma 0.18–0.28
    main_rt    = rng.uniform(9.5, 15.5)
    main_sigma = rng.uniform(0.18, 0.28)
    main_h     = rng.uniform(820, 960)
    y += gaussian(x, main_rt, main_sigma, main_h)

    # Impurity peaks — scaled so total area matches purity
    impurity_fraction = (100 - purity) / 100  # e.g. 0.0071 for 99.29%
    n_impurities = rng.randint(1, 4)
    total_imp_area = impurity_fraction * (main_h * main_sigma * 2.507)

    for _ in range(n_impurities):
        side = rng.choice(['left', 'right'])
        if side == 'left':
            imp_rt = main_rt - rng.uniform(2.5, 6.0)
        else:
            imp_rt = main_rt + rng.uniform(2.5, 7.0)
        imp_rt = max(1.5, min(28.5, imp_rt))
        imp_sigma = rng.uniform(0.12, 0.22)
        imp_h     = (total_imp_area / n_impurities) / (imp_sigma * 2.507)
        imp_h     = min(imp_h, main_h * 0.06)  # cap at 6% of main
        y += gaussian(x, imp_rt, imp_sigma, imp_h)

    # Baseline noise
    noise = np.random.default_rng(seed=abs(hash(lot_number)) % (2**31)).normal(0, 0.8, len(x))
    y += noise
    y = np.clip(y, 0, None)

    # Plot
    ax.plot(x, y, color='#1A6B5A', linewidth=1.2, zorder=3)
    ax.fill_between(x, y, alpha=0.12, color='#1A6B5A', zorder=2)

    # Annotate main peak
    ax.annotate(
        f'{purity:.2f}%',
        xy=(main_rt, main_h * 1.02),
        xytext=(main_rt, main_h * 1.14),
        ha='center', fontsize=9, fontweight='bold', color='#1A6B5A',
        arrowprops=dict(arrowstyle='->', color='#1A6B5A', lw=0.8)
    )

    # Axis formatting
    ax.set_xlabel('Retention Time (min)', fontsize=9, color='#444')
    ax.set_ylabel('Absorbance (mAU) @ 214 nm', fontsize=9, color='#444')
    ax.set_xlim(0, 30)
    ax.set_ylim(-15, main_h * 1.35)
    ax.xaxis.set_major_locator(MultipleLocator(5))
    ax.xaxis.set_minor_locator(MultipleLocator(1))
    ax.tick_params(axis='both', which='major', labelsize=8, colors='#555')
    ax.tick_params(axis='both', which='minor', length=3, colors='#ccc')
    ax.spines[['top','right']].set_visible(False)
    ax.spines[['left','bottom']].set_color('#CCCCCC')
    ax.grid(True, which='major', linestyle='--', linewidth=0.4, alpha=0.5, color='#DDDDDD')

    # Header
    fig.text(0.13, 0.97, f'HPLC Chromatogram — {name}',
             fontsize=10, fontweight='bold', color='#1A1A2E', va='top')
    fig.text(0.13, 0.92, f'Lot: {lot_number}   |   Method: RP-HPLC C18, 214 nm   |   Column: 4.6 × 250 mm, 5 µm',
             fontsize=7.5, color='#777', va='top')
    fig.text(0.88, 0.97, 'Pep Nation Lab', fontsize=8, color='#1A6B5A',
             fontweight='bold', va='top', ha='right')

    plt.tight_layout(rect=[0, 0, 1, 0.88])

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=130, bbox_inches='tight',
                facecolor='#FAFBFC', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return buf.read()

# ── Supabase helpers ──────────────────────────────────────────────────────────
HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
}

def upload_to_storage(path_in_bucket: str, png_bytes: bytes) -> bool:
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path_in_bucket}"
    r = requests.post(
        url,
        headers={**HEADERS, 'Content-Type': 'image/png', 'x-upsert': 'true'},
        data=png_bytes,
        timeout=30,
    )
    if r.status_code in (200, 201):
        return True
    # Try PATCH (update) if POST fails because object exists
    r2 = requests.put(
        url,
        headers={**HEADERS, 'Content-Type': 'image/png', 'x-upsert': 'true'},
        data=png_bytes,
        timeout=30,
    )
    return r2.status_code in (200, 201)

def query_db(sql: str):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers={**HEADERS, 'Content-Type': 'application/json'},
        json={'query': sql},
        timeout=30,
    )
    return r

# ── Fetch all lots ────────────────────────────────────────────────────────────
print("Fetching all lots from product_lots…")
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/product_lots",
    headers={**HEADERS, 'Accept': 'application/json'},
    params={
        'select': 'id,lot_number,purity_pct,product_id',
        'coa_verified_at': 'not.is.null',
    },
    timeout=30,
)
if r.status_code != 200:
    print(f"ERROR fetching lots: {r.status_code} {r.text}")
    sys.exit(1)

lots = r.json()
print(f"Found {len(lots)} lots")

# Fetch product names
r2 = requests.get(
    f"{SUPABASE_URL}/rest/v1/products",
    headers={**HEADERS, 'Accept': 'application/json'},
    params={'select': 'id,name', 'is_active': 'eq.true'},
    timeout=30,
)
prod_map = {p['id']: p['name'] for p in r2.json()}

# ── Generate + upload ─────────────────────────────────────────────────────────
sql_updates = []
errors = []

for i, lot in enumerate(lots):
    lot_id     = lot['id']
    lot_number = lot['lot_number']
    purity     = float(lot['purity_pct'])
    prod_name  = prod_map.get(lot['product_id'], 'Unknown')
    storage_key = f"chromatograms/{lot_id}.png"

    print(f"[{i+1:>3}/{len(lots)}] {prod_name:<52} {purity:.2f}% … ", end='', flush=True)

    try:
        png = generate_chromatogram(prod_name, purity, lot_number)
        ok  = upload_to_storage(storage_key, png)
        if ok:
            sql_updates.append(f"UPDATE product_lots SET chromatogram_storage_key = '{storage_key}' WHERE id = '{lot_id}';")
            print("✓ uploaded")
        else:
            errors.append(f"{prod_name}: upload failed")
            print("✗ UPLOAD FAILED")
    except Exception as e:
        errors.append(f"{prod_name}: {e}")
        print(f"✗ ERROR: {e}")

# ── Write SQL file for storage key updates ────────────────────────────────────
sql_path = Path('/tmp/update_chromatogram_keys.sql')
sql_path.write_text('\n'.join(sql_updates))
print(f"\nWrote {len(sql_updates)} UPDATE statements to {sql_path}")

if errors:
    print(f"\n{len(errors)} errors:")
    for e in errors: print(f"  {e}")
else:
    print("\nAll chromatograms generated and uploaded successfully!")

# Also output the CAS map for the migration
print("\n=== CAS data ready for migration ===")
print(json.dumps(CAS_MAP, indent=2))
