import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment

PEPTIDES = [
    ("5-Amino-1MQ","Weight Loss & Metabolism",159.21),
    ("Acetic Acid 0.6%","Immunity & Wellness",60.05),
    ("AHK-CU","Skin, Hair & Cosmetics",379.92),
    ("AICAR","Weight Loss & Metabolism",258.23),
    ("AOD9604","Weight Loss & Metabolism",1815.10),
    ("ARA290 (Cibinetide)","Immunity & Wellness",None),
    ("B12","Immunity & Wellness",None),
    ("BAC Water","Immunity & Wellness",None),
    ("BPC 157","Healing & Recovery",None),
    ("BPC-157 Research Grade","Healing & Recovery",None),
    ("Cagrilintide","Weight Loss & Metabolism",4409.01),
    ("Cerebrolysin","Immunity & Wellness",None),
    ("CJC-1295 With DAC","Muscle Growth & Performance",3647.10),
    ("CJC-1295 Without DAC","Muscle Growth & Performance",3357.90),
    ("DSIP","Immunity & Wellness",848.80),
    ("Epithalon","Anti-Aging & Longevity",390.35),
    ("Follistatin","Muscle Growth & Performance",38000.00),
    ("FOXO4-DRI","Anti-Aging & Longevity",5223.00),
    ("GH Synergy Stack (CJC 5mg + IPA 5mg)","Peptide Stacks",None),
    ("GHK-CU","Skin, Hair & Cosmetics",340.85),
    ("GHRP-2 Acetate","Muscle Growth & Performance",None),
    ("GHRP-6 Acetate","Muscle Growth & Performance",None),
    ("Glow Stack (TB10 + BPC10 + GHK50)","Peptide Stacks",None),
    ("Glutathione","Anti-Aging & Longevity",307.32),
    ("HCG","Sexual Health & Hormones",36700.00),
    ("Hexarelin Acetate","Muscle Growth & Performance",None),
    ("HGH Fragment 176-191","Muscle Growth & Performance",1817.10),
    ("HMG","Muscle Growth & Performance",None),
    ("IGF-1LR3","Muscle Growth & Performance",None),
    ("Ipamorelin","Muscle Growth & Performance",711.85),
    ("KissPeptin-10","Sexual Health & Hormones",1302.50),
    ("KLOW STACK (TB10+BPC10+GHK50+KPV10)","Peptide Stacks",None),
    ("KPV","Healing & Recovery",342.43),
    ("LL37","Immunity & Wellness",None),
    ("Melatonin","Anti-Aging & Longevity",232.28),
    ("MOTS-C","Weight Loss & Metabolism",2174.60),
    ("MT-1","Skin, Hair & Cosmetics",1646.86),
    ("NAD+","Anti-Aging & Longevity",663.43),
    ("Oxytocin Acetate","Sexual Health & Hormones",None),
    ("Pinealon","Anti-Aging & Longevity",418.40),
    ("Retatrutide","Weight Loss & Metabolism",4731.30),
    ("Selank","Immunity & Wellness",751.88),
    ("Semaglutide","Weight Loss & Metabolism",4113.58),
    ("Semax","Immunity & Wellness",813.90),
    ("Sermorelin Acetate","Muscle Growth & Performance",None),
    ("SNAP-8","Skin, Hair & Cosmetics",1075.20),
    ("SS-31","Anti-Aging & Longevity",639.79),
    ("Survodutide","Weight Loss & Metabolism",4231.63),
    ("TB500 (Thymosin B4 Acetate)","Healing & Recovery",None),
    ("Tesamorelin","Muscle Growth & Performance",5135.90),
    ("The Appetite Crusher Stack (Cagrilintide 5mg + Semaglutide 5mg)","Weight Loss & Metabolism",None),
    ("The Furnace Stack (L-Carnitine Blend)","Weight Loss & Metabolism",161.20),
    ("The Lipolysis Stack (Lemon Bottle)","Weight Loss & Metabolism",None),
    ("The Skinny Shot (Lipo-C Blend)","Weight Loss & Metabolism",None),
    ("The Wolverine Stack (BPC 10mg + TB 10mg)","Peptide Stacks",None),
    ("The Wolverine Stack (BPC 5mg + TB 5mg)","Healing & Recovery",None),
    ("Thymalin","Anti-Aging & Longevity",None),
    ("Thymosin Alpha-1","Immunity & Wellness",3108.30),
    ("Tirzepatide","Weight Loss & Metabolism",4813.45),
    ("VIP","Immunity & Wellness",3325.80),
]

def ptype(name):
    n = name.lower()
    if any(k in n for k in ["stack","blend","shot"]):
        return "Blend / Stack"
    if name in ("BAC Water","Acetic Acid 0.6%","B12"):
        return "Supply"
    return "Single Peptide"

# ---- styling ----
ARIAL = "Arial"
TEAL = "0F6E56"
HEAD_FILL = PatternFill("solid", fgColor="0F1923")
HEAD_FONT = Font(name=ARIAL, size=11, bold=True, color="FFFFFF")
TITLE_FONT = Font(name=ARIAL, size=16, bold=True, color="0F1923")
SUB_FONT = Font(name=ARIAL, size=10, color="5F6E7C")
FILL_YELLOW = PatternFill("solid", fgColor="FFF6D5")   # user fills these
FILL_GREY = PatternFill("solid", fgColor="EDEFF2")     # auto / pre-filled
AUTO_FONT = Font(name=ARIAL, size=10, color="5F6E7C", italic=True)
CELL_FONT = Font(name=ARIAL, size=10, color="0F1923")
EX_FONT = Font(name=ARIAL, size=10, color="8494A2", italic=True)
thin = Side(style="thin", color="D0DAE4")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)

wb = openpyxl.Workbook()

# ============================ Sheet 1: Peptides To Test ============================
ws = wb.active
ws.title = "Peptides To Test"

ws["A1"] = "Pep Nation Lab, Certificate Of Analysis, Lab Testing Checklist"
ws["A1"].font = TITLE_FONT
ws.merge_cells("A1:O1")

ws["A2"] = ("Yellow cells are for you to fill in with the real laboratory results once each batch is "
            "tested. The grey Theoretical Mass column is already on file (the peptide's real molecular "
            "weight) and auto-fills on the certificate. The first row below the header is an example, in "
            "grey italics, showing the expected format; overwrite or delete it. Nothing is published until "
            "you enter the data in the admin panel and click Publish.")
ws["A2"].font = SUB_FONT
ws["A2"].alignment = LEFT
ws.merge_cells("A2:O2")
ws.row_dimensions[2].height = 58

headers = ["Peptide","Type","Category","Theoretical Mass (Da) [auto]","Lot Number","Test Date",
           "Purity (%)","Purity Method","Observed Mass (Da)","Water Content (%)","Net Peptide (%)",
           "Appearance","Testing Lab","Report No.","Data Received? (Y/N)"]
# which columns the user fills (yellow)
FILL_COLS = set(range(5, 16))  # E..O
hdr_row = 4
for c, h in enumerate(headers, start=1):
    cell = ws.cell(row=hdr_row, column=c, value=h)
    cell.font = HEAD_FONT
    cell.fill = HEAD_FILL
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = BORDER
ws.row_dimensions[hdr_row].height = 30

# example row
ex = ["Semaglutide (example)","Single Peptide","Weight Loss & Metabolism",4113.58,
      "PNL-SEMA-2607-101","2026-07-01",99.20,"RP-HPLC, 214 nm",4113.90,4.10,88.40,
      "White Lyophilized Powder","Pep Nation Lab In-House","PNL-SEMA-101","Y"]
er = hdr_row + 1
for c, v in enumerate(ex, start=1):
    cell = ws.cell(row=er, column=c, value=v)
    cell.font = EX_FONT
    cell.alignment = LEFT if c in (1,3,8,12,13) else CENTER
    cell.border = BORDER
    if c in FILL_COLS:
        cell.fill = FILL_YELLOW
    elif c == 4:
        cell.fill = FILL_GREY

# data rows
start = er + 1
for i, (name, cat, mass) in enumerate(PEPTIDES):
    r = start + i
    ws.cell(row=r, column=1, value=name).font = CELL_FONT
    ws.cell(row=r, column=2, value=ptype(name)).font = CELL_FONT
    ws.cell(row=r, column=3, value=cat).font = CELL_FONT
    mcell = ws.cell(row=r, column=4, value=(mass if mass is not None else "Not On File"))
    mcell.font = AUTO_FONT
    mcell.fill = FILL_GREY
    mcell.alignment = CENTER
    if mass is None:
        mcell.comment = Comment("No single molecular weight on file (blend, supply, or mixture). "
                                "Determine per component or by the testing lab.", "PepNationLab")
    for c in range(5, 16):  # blank yellow fill-in cells
        cell = ws.cell(row=r, column=c, value=None)
        cell.fill = FILL_YELLOW
    for c in range(1, 16):
        cell = ws.cell(row=r, column=c)
        cell.border = BORDER
        if c in (1,3):
            cell.alignment = LEFT
        elif c == 2:
            cell.alignment = CENTER
        elif c not in (4,):
            cell.alignment = CENTER

last = start + len(PEPTIDES) - 1

# summary line above header
ws["A3"] = None
ws.cell(row=3, column=1, value="Peptides Needing Data:")
ws.cell(row=3, column=1).font = Font(name=ARIAL, size=10, bold=True, color="0F1923")
ws.cell(row=3, column=2, value=len(PEPTIDES)).font = Font(name=ARIAL, size=10, bold=True, color=TEAL)
ws.cell(row=3, column=4, value="Data Received:").font = Font(name=ARIAL, size=10, bold=True, color="0F1923")
# COUNTIF over the Data Received column (O), excluding the example row
ws.cell(row=3, column=5, value=f'=COUNTIF(O{start}:O{last},"Y")').font = Font(name=ARIAL, size=10, bold=True, color=TEAL)

widths = [30,15,26,24,20,13,10,20,17,16,14,26,22,16,18]
for i, w in enumerate(widths, start=1):
    ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
ws.freeze_panes = f"A{start}"

# ============================ Sheet 2: COA Fields Guide ============================
g = wb.create_sheet("COA Fields Guide")
g["A1"] = "What Each Certificate Field Needs"
g["A1"].font = TITLE_FONT
g.merge_cells("A1:D1")
g["A2"] = ("Every field on the Certificate Of Analysis, where its value comes from, and whether it is "
           "required before you can Publish. Auto fields are already handled by the system.")
g["A2"].font = SUB_FONT
g["A2"].alignment = LEFT
g.merge_cells("A2:D2")
g.row_dimensions[2].height = 30

ghead = ["Certificate Field","Source","Required To Publish?","Notes / Example"]
for c, h in enumerate(ghead, start=1):
    cell = g.cell(row=4, column=c, value=h)
    cell.font = HEAD_FONT; cell.fill = HEAD_FILL; cell.border = BORDER
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
g.row_dimensions[4].height = 26

FIELDS = [
    ("Product","Auto","No","Pulled from the catalogue."),
    ("Lot Number","You enter","Yes","The real batch/lot number printed on the vials, e.g. PNL-SEMA-2607-101."),
    ("Test Date","Lab","Yes","Date the assay was run. Cannot be in the future."),
    ("Purity (%)","Lab (RP-HPLC)","Yes","Main-peak purity, e.g. 99.2. Range 0.01 to 100."),
    ("Purity Method","You / Lab","Recommended","e.g. RP-HPLC, 214 nm."),
    ("HPLC Column","Lab","Optional","e.g. C18, 4.6 x 250 mm, 5 um."),
    ("Detection Wavelength (nm)","Lab","Optional","Whole number 180 to 800, e.g. 214."),
    ("Observed Mass (Da)","Lab (ESI-MS)","Recommended","Measured mass from mass spec, e.g. 4113.9."),
    ("Theoretical Mass (Da)","Auto (real MW)","No","Pre-filled from the compound record where on file. A chemical constant, not a test result."),
    ("Net Peptide Content (%)","Lab","Optional","By nitrogen analysis, e.g. 88.4."),
    ("Water Content (%)","Lab (Karl Fischer)","Optional","e.g. 4.1. Range 0 to 100."),
    ("Appearance","Lab / You","Optional","e.g. White to off-white lyophilized powder."),
    ("Storage","Default","No","Defaults to Store At 36 To 46 F. Override per lot if needed."),
    ("Testing Laboratory","You enter","Yes","e.g. Pep Nation Lab In-House. Pre-filled on new drafts."),
    ("Laboratory Report No.","Lab","Optional","The lab's own report number, if any."),
    ("Independent Third Party","You enter","Optional","Yes, or No (tested in-house)."),
    ("Laboratory Accreditation","You enter","Optional","e.g. ISO/IEC 17025, if applicable."),
    ("Chromatogram","Lab (upload)","Optional","Image of the HPLC trace, uploaded to the lot."),
    ("Signature","Auto","No","Swadep Mirsha, Laboratory Technician. Applied on Publish."),
    ("QR Code","Auto","No","Generated per lot; links to the public verification page."),
]
for i, (f, src, req, note) in enumerate(FIELDS):
    r = 5 + i
    vals = [f, src, req, note]
    for c, v in enumerate(vals, start=1):
        cell = g.cell(row=r, column=c, value=v)
        cell.font = CELL_FONT
        cell.border = BORDER
        cell.alignment = LEFT if c in (1,4) else CENTER
        if c == 3 and req == "Yes":
            cell.fill = PatternFill("solid", fgColor="FCEBEB")
            cell.font = Font(name=ARIAL, size=10, bold=True, color="A32D2D")
        if c == 2 and src.startswith("Auto"):
            cell.fill = FILL_GREY
for i, w in enumerate([26,18,20,60], start=1):
    g.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
g.freeze_panes = "A5"

out = "/sessions/practical-beautiful-darwin/mnt/outputs/PepNationLab_COA_Testing_Checklist.xlsx"
wb.save(out)
print("saved", out, "rows:", len(PEPTIDES))
