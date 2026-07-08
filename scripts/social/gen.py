#!/usr/bin/env python3
"""
Pep Nation Lab - Social Asset Generator (gen.py)

Renders branded, RUO-compliant social media assets from the compound database:
  - Vertical MP4 Shorts (1080x1920) for YouTube Shorts / Reels / TikTok
  - Image cards (1080x1350) for Pinterest / Instagram / Facebook

Output batch (default):
  6  Science Explainer Shorts (What Is A Peptide, Half-Life, Reconstitution,
     Evidence Tiers, Research Use Only, COA)
  8  Compound Spotlight Shorts (one per featured compound)
  8  Comparison Pins (side-by-side molecular fact tables)
  6  Glossary Cards (plain-language term definitions)
  = 28 finished, verified assets.

Data source order:
  1. Supabase REST `compounds` table (env: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
     + SUPABASE_SERVICE_ROLE_KEY). This is how the monthly Vercel/Actions cron
     pulls fresh data.
  2. Embedded FALLBACK_COMPOUNDS (a real snapshot) so the generator always runs,
     even offline / in CI without secrets.

Every asset carries the mandatory footer:
  "For In Vitro Laboratory Research Use Only. Not For Human Or Animal Use."

Nothing here posts anything. Publishing is handled by the separate autoposter
(see SOCIAL-AUTOPOSTER-HANDOFF.md). This script only creates files.

Requirements: Python 3.9+, Pillow, and ffmpeg on PATH.
Usage:
  python3 gen.py                     # full batch -> ./social-batch/
  python3 gen.py --out /tmp/batch    # custom output dir
  python3 gen.py --only images       # images only ('images' | 'videos' | 'all')
  python3 gen.py --limit-spotlights 3
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required: pip install Pillow --break-system-packages")


# --------------------------------------------------------------------------- #
# Brand system (mirrors app/globals.css - teal / black / silver)
# --------------------------------------------------------------------------- #
TEAL = "#00C4BC"
TEAL_DIM = "#0A8C87"
BG = "#050A0F"
SURFACE = "#0F1923"
SURFACE_2 = "#162230"
SURFACE_3 = "#1D2D3E"
WHITE = "#FFFFFF"
SILVER = "#A8B4C0"
SILVER_2 = "#D0DAE4"
DANGER = "#E53E3E"
HAIRLINE = "#22303E"

VIDEO_W, VIDEO_H = 1080, 1920
CARD_W, CARD_H = 1080, 1350
FPS = 30

RUO_FOOTER = "For In Vitro Laboratory Research Use Only. Not For Human Or Animal Use."
BRAND = "PEP NATION LAB"
SITE = "pepnationlab.com"


# --------------------------------------------------------------------------- #
# Compliance gate - mirrors lib/social/compliance-check.ts intent.
# Blocks human-use / benefit-claim language before it can reach an asset.
# --------------------------------------------------------------------------- #
DENY_TERMS = [
    "dose", "dosage", "dosing", "mg/kg", "mg per kg", "how to take",
    "protocol", "stack for", "cycle", "inject",
    "buy", "discount", "sale", "coupon", "order now", "shop",
    "cure", "treat", "treats", "treatment for", "heal your", "fix your",
    "for weight loss", "for fat loss", "for muscle", "for healing",
    "for anti-aging", "lose weight", "burn fat", "get ripped", "gains",
    "before and after", "results in", "guaranteed",
]

# Benefit-y phrases -> safe research-framed equivalents for spotlight slides.
SAFE_AREA_MAP = {
    "gi mucosal healing": "GI mucosal-repair models",
    "gut healing": "gut-integrity models",
    "gut health and integrity": "gut-barrier models",
    "tendon / ligament repair": "tendon and ligament models",
    "tendon repair": "connective-tissue models",
    "nerve repair": "nerve-regeneration models",
    "wound healing": "wound-repair models",
    "dermal / corneal wound healing": "dermal and corneal repair models",
    "cardiac repair models": "cardiac-repair models",
    "angiogenesis": "angiogenesis pathways",
    "angiogenesis promotion": "angiogenesis pathways",
    "collagen synthesis stimulation": "collagen-synthesis pathways",
    "skin anti-aging": "dermal ECM-remodeling models",
    "telomere elongation": "telomerase-activity models",
    "anti-aging / longevity": "cellular-aging models",
    "circadian rhythm regulation": "circadian-signaling models",
    "gh secretagogue research": "GH-secretagogue signalling",
    "type 2 diabetes management": "glucose-regulation research",
    "chronic weight management / obesity": "energy-metabolism research",
    "appetite suppression": "appetite-signalling pathways",
    "cardiovascular risk reduction": "cardiometabolic research",
    "antioxidant defense": "oxidative-stress models",
    "anti-inflammatory": "inflammatory-signalling models",
    "immune modulation": "immune-signalling models",
    "stem cell migration": "cell-migration models",
    "hair growth stimulation": "follicular-signalling models",
}


def compliance_check(text: str) -> tuple[bool, list[str]]:
    """Return (ok, hits). ok=False means the text must not ship."""
    low = " " + text.lower() + " "
    hits = [t for t in DENY_TERMS if t in low]
    return (len(hits) == 0, hits)


def assert_clean(label: str, *texts: str) -> None:
    joined = " | ".join(t for t in texts if t)
    ok, hits = compliance_check(joined)
    if not ok:
        raise ValueError(f"COMPLIANCE BLOCK [{label}]: banned terms {hits} in: {joined!r}")


def safe_areas(studied_for: list[str], n: int = 3) -> list[str]:
    """Pick research-framed, compliant 'studied in' phrases."""
    out: list[str] = []
    seen = set()
    for raw in studied_for:
        key = raw.strip().lower()
        mapped = SAFE_AREA_MAP.get(key)
        if mapped is None:
            continue  # only use vetted, mapped phrases
        if mapped in seen:
            continue
        ok, _ = compliance_check(mapped)
        if not ok:
            continue
        out.append(mapped)
        seen.add(mapped)
        if len(out) >= n:
            break
    if not out:
        out = ["laboratory research models"]
    return out


# --------------------------------------------------------------------------- #
# Fonts - prefer a clean geometric/neutral sans; degrade gracefully.
# --------------------------------------------------------------------------- #
FONT_CANDIDATES = {
    "display": [
        "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "semibold": [
        "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "body": [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ],
    "mono": [
        "/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    ],
}


def _first_existing(paths: list[str]) -> Optional[str]:
    for p in paths:
        if os.path.exists(p):
            return p
    return None


_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    key = (kind, size)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    path = _first_existing(FONT_CANDIDATES.get(kind, FONT_CANDIDATES["body"]))
    f = ImageFont.truetype(path, size) if path else ImageFont.load_default()
    _FONT_CACHE[key] = f
    return f


# --------------------------------------------------------------------------- #
# Drawing helpers
# --------------------------------------------------------------------------- #
def _text_w(draw: ImageDraw.ImageDraw, text: str, fnt) -> int:
    return int(draw.textbbox((0, 0), text, font=fnt)[2])


def _split_tokens(text: str) -> list[str]:
    """Split on spaces, but keep hyphens as breakable points so long
    hyphen-joined sequences (Gly-Glu-Pro-...) can wrap instead of overflowing."""
    out: list[str] = []
    for word in text.split():
        if "-" in word and len(word) > 12:
            parts = word.split("-")
            for i, p in enumerate(parts):
                out.append(p + ("-" if i < len(parts) - 1 else ""))
        else:
            out.append(word)
    return out


def wrap(draw, text: str, fnt, max_w: int) -> list[str]:
    tokens = _split_tokens(text)
    lines: list[str] = []
    cur = ""
    for w in tokens:
        # join hyphen-continuations without a space
        sep = "" if cur.endswith("-") else " "
        trial = (cur + sep + w) if cur else w
        if _text_w(draw, trial, fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def wrap_cap(draw, text: str, fnt, max_w: int, max_lines: int) -> list[str]:
    """Wrap and cap to max_lines, adding an ellipsis if truncated."""
    lines = wrap(draw, text, fnt, max_w)
    if len(lines) <= max_lines:
        return lines
    kept = lines[:max_lines]
    last = kept[-1].rstrip("-")
    while last and _text_w(draw, last + "…", fnt) > max_w:
        last = last[:-1]
    kept[-1] = last + "…"
    return kept


def draw_centered_block(draw, text, fnt, cx, top, max_w, fill, line_gap=14):
    lines = wrap(draw, text, fnt, max_w)
    y = top
    asc, desc = fnt.getmetrics()
    lh = asc + desc
    for ln in lines:
        w = _text_w(draw, ln, fnt)
        draw.text((cx - w / 2, y), ln, font=fnt, fill=fill)
        y += lh + line_gap
    return y


def base_canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    # subtle vertical gradient toward surface at the bottom
    top = _hex(BG)
    bot = _hex(SURFACE)
    for i in range(h):
        t = i / h
        r = int(top[0] + (bot[0] - top[0]) * t * 0.9)
        g = int(top[1] + (bot[1] - top[1]) * t * 0.9)
        b = int(top[2] + (bot[2] - top[2]) * t * 0.9)
        d.line([(0, i), (w, i)], fill=(r, g, b))
    return img, d


def _hex(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def brand_header(d, w, y=70):
    # teal tick + wordmark
    d.rectangle([80, y, 92, y + 40], fill=TEAL)
    d.text((112, y - 2), BRAND, font=font("display", 40), fill=WHITE)
    d.text((112, y + 44), SITE, font=font("body", 26), fill=SILVER)


def ruo_footer(d, w, h):
    fy = h - 150
    d.line([(80, fy), (w - 80, fy)], fill=HAIRLINE, width=2)
    lines = wrap(d, RUO_FOOTER, font("body", 26), w - 160)
    y = fy + 22
    for ln in lines:
        tw = _text_w(d, ln, font("body", 26))
        d.text((w / 2 - tw / 2, y), ln, font=font("body", 26), fill=SILVER)
        y += 36


def pill(d, x, y, text, fg=BG, bg=TEAL, pad=(26, 12), fnt_size=28):
    fnt = font("semibold", fnt_size)
    tw = _text_w(d, text, fnt)
    asc, desc = fnt.getmetrics()
    th = asc + desc
    w = tw + pad[0] * 2
    h = th + pad[1] * 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg)
    d.text((x + pad[0], y + pad[1]), text, font=fnt, fill=fg)
    return w, h


def progress_dots(d, w, h, idx, total, y=None):
    if y is None:
        y = h - 210
    gap = 26
    r = 7
    total_w = (total - 1) * gap
    x0 = w / 2 - total_w / 2
    for i in range(total):
        cx = x0 + i * gap
        col = TEAL if i == idx else HAIRLINE
        d.ellipse([cx - r, y - r, cx + r, y + r], fill=col)


# --------------------------------------------------------------------------- #
# Scene rendering (a "scene" = one full-frame slide inside a Short)
# --------------------------------------------------------------------------- #
@dataclass
class Scene:
    kicker: str
    headline: str
    sub: str = ""
    mono: str = ""          # optional monospace data line (sequence / CAS)
    accent: str = TEAL


def render_scene(scene: Scene, idx: int, total: int) -> Image.Image:
    img, d = base_canvas(VIDEO_W, VIDEO_H)
    brand_header(d, VIDEO_W)

    cx = VIDEO_W / 2
    # kicker pill
    if scene.kicker:
        kf = font("semibold", 30)
        tw = _text_w(d, scene.kicker.upper(), kf)
        pill(d, cx - (tw + 52) / 2, 300, scene.kicker.upper(),
             fg=BG, bg=scene.accent, fnt_size=30)

    # headline
    hy = 430
    hf = font("display", 92)
    hy = draw_centered_block(d, scene.headline, hf, cx, hy, VIDEO_W - 150,
                             WHITE, line_gap=6)

    # sub
    if scene.sub:
        hy += 40
        sf = font("body", 46)
        hy = draw_centered_block(d, scene.sub, sf, cx, hy, VIDEO_W - 200,
                                 SILVER_2, line_gap=14)

    # mono data line inside a chip
    if scene.mono:
        mf = font("mono", 40)
        lines = wrap(d, scene.mono, mf, VIDEO_W - 260)
        box_h = 40 + len(lines) * 58
        by = hy + 60
        d.rounded_rectangle([120, by, VIDEO_W - 120, by + box_h],
                            radius=24, fill=SURFACE_2, outline=HAIRLINE, width=2)
        ty = by + 20
        for ln in lines:
            tw = _text_w(d, ln, mf)
            d.text((cx - tw / 2, ty), ln, font=mf, fill=TEAL)
            ty += 58

    progress_dots(d, VIDEO_W, VIDEO_H, idx, total)
    ruo_footer(d, VIDEO_W, VIDEO_H)
    return img


# --------------------------------------------------------------------------- #
# Video assembly via ffmpeg (image sequence w/ per-scene durations + fades)
# --------------------------------------------------------------------------- #
def build_video(scenes: list[Scene], durations: list[float], out_path: Path) -> None:
    total = len(scenes)
    with tempfile.TemporaryDirectory() as tmp:
        tmpd = Path(tmp)
        frame_paths = []
        for i, sc in enumerate(scenes):
            p = tmpd / f"scene_{i:02d}.png"
            render_scene(sc, i, total).save(p)
            frame_paths.append(p)

        # concat demuxer script with per-image durations
        concat = tmpd / "concat.txt"
        with open(concat, "w") as fh:
            for p, dur in zip(frame_paths, durations):
                fh.write(f"file '{p.name}'\n")
                fh.write(f"duration {dur:.3f}\n")
            # demuxer needs the last frame repeated (no duration) to hold it
            fh.write(f"file '{frame_paths[-1].name}'\n")

        vid_dur = sum(durations)
        # global fade in/out for a polished top & tail
        vf = (
            f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=decrease,"
            f"pad={VIDEO_W}:{VIDEO_H}:(ow-iw)/2:(oh-ih)/2:color=0x050A0F,"
            f"fps={FPS},format=yuv420p,"
            f"fade=t=in:st=0:d=0.5,fade=t=out:st={vid_dur-0.5:.2f}:d=0.5"
        )
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-vf", vf,
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-r", str(FPS),
            str(out_path),
        ]
        subprocess.run(cmd, check=True, cwd=tmp)


# --------------------------------------------------------------------------- #
# Image cards: comparison pins + glossary cards (1080x1350)
# --------------------------------------------------------------------------- #
def render_comparison_pin(a: dict, b: dict, out_path: Path) -> None:
    img, d = base_canvas(CARD_W, CARD_H)
    brand_header(d, CARD_W, y=60)

    title = f"{a['display_name']}  vs  {b['display_name']}"
    tf = font("display", 60)
    # shrink to fit
    while _text_w(d, title, tf) > CARD_W - 120 and tf.size > 34:
        tf = font("display", tf.size - 2)
    tw = _text_w(d, title, tf)
    d.text((CARD_W / 2 - tw / 2, 190), title, font=tf, fill=WHITE)
    sub = "Research Comparison"
    sf = font("body", 32)
    sw = _text_w(d, sub, sf)
    d.text((CARD_W / 2 - sw / 2, 268), sub, font=sf, fill=TEAL)

    rows = [
        ("Class", short_class(a["compound_class"]), short_class(b["compound_class"])),
        ("Mol. Weight", a["mw"], b["mw"]),
        ("Sequence", short_seq(a["sequence"]), short_seq(b["sequence"])),
        ("CAS", a["cas"], b["cas"]),
        ("Half-Life", a["half_life"], b["half_life"]),
        ("Evidence Tier", tier_label(a["evidence_tier"]), tier_label(b["evidence_tier"])),
    ]

    top = 360
    row_h = 132
    col_label_x = 70
    col_a_x = 380
    col_b_x = 730
    col_a_w = col_b_x - col_a_x - 24
    col_b_w = CARD_W - 70 - col_b_x
    line_h = 38
    lf = font("semibold", 30)
    vf = font("body", 28)

    def draw_cell(value, x, y, max_w):
        lines = wrap_cap(d, str(value), vf, max_w, 3)
        for j, ln in enumerate(lines):
            d.text((x, y + 22 + j * line_h), ln, font=vf, fill=SILVER_2)

    for i, (label, va, vb) in enumerate(rows):
        y = top + i * row_h
        if i % 2 == 0:
            d.rounded_rectangle([50, y, CARD_W - 50, y + row_h - 16],
                                radius=16, fill=SURFACE_2)
        d.text((col_label_x, y + 22), label, font=lf, fill=TEAL)
        draw_cell(va, col_a_x, y, col_a_w)
        draw_cell(vb, col_b_x, y, col_b_w)

    ruo_footer(d, CARD_W, CARD_H)
    img.save(out_path)


def render_glossary_card(term: str, definition: str, out_path: Path) -> None:
    img, d = base_canvas(CARD_W, CARD_H)
    brand_header(d, CARD_W, y=60)

    kf = font("semibold", 30)
    pill(d, 70, 240, "GLOSSARY", fg=BG, bg=TEAL, fnt_size=30)

    tf = font("display", 92)
    while _text_w(d, term, tf) > CARD_W - 140 and tf.size > 44:
        tf = font("display", tf.size - 4)
    d.text((70, 330), term, font=tf, fill=WHITE)
    d.line([(74, 460), (74 + min(360, _text_w(d, term, tf)), 460)], fill=TEAL, width=6)

    df = font("body", 46)
    draw_centered_block(d, definition, df, CARD_W / 2, 560, CARD_W - 160,
                        SILVER_2, line_gap=16)

    link = f"Full Glossary At {SITE}"
    lf = font("semibold", 34)
    lw = _text_w(d, link, lf)
    d.text((CARD_W / 2 - lw / 2, CARD_H - 260), link, font=lf, fill=TEAL)

    ruo_footer(d, CARD_W, CARD_H)
    img.save(out_path)


def short_class(c: Optional[str]) -> str:
    if not c:
        return "-"
    c = c.split(";")[0].split("(")[0].strip()
    return c[:60]


def short_seq(s: Optional[str]) -> str:
    if not s:
        return "-"
    return s[:44]


def tier_label(t: Optional[str]) -> str:
    return {
        "approved_drug": "Approved Drug",
        "investigational": "Investigational",
        "preclinical": "Preclinical",
        "research_chemical": "Research Compound",
        "cosmetic": "Cosmetic",
    }.get((t or "").lower(), (t or "-").replace("_", " ").title())


# --------------------------------------------------------------------------- #
# Content definitions
# --------------------------------------------------------------------------- #
SCIENCE_SHORTS = [
    {
        "slug": "what-is-a-peptide",
        "scenes": [
            Scene("Peptide Science 101", "What Is A\nPeptide?", "In 30 seconds."),
            Scene("The Basics", "A Short Chain\nOf Amino Acids", "Think LEGO bricks snapped in a line."),
            Scene("Scale", "Link A Few:\nPeptide", "Link hundreds and you get a protein."),
            Scene("In The Lab", "Studied\nIn Vitro", "Researchers study how these chains behave in cells and analytical settings."),
            Scene("Learn More", "Plain-Language\nGlossary", f"Every term explained at {SITE}"),
        ],
        "caption": "What actually IS a peptide? A short chain of amino acids, studied in vitro. Full glossary on our site. For in vitro laboratory research use only.",
    },
    {
        "slug": "half-life-explained",
        "scenes": [
            Scene("Peptide Science 101", "Half-Life,\nExplained", "It sounds complicated. It is not."),
            Scene("The Idea", "Half Of What's\nLeft, Each Time", "Half gone, then half of that, then half of that."),
            Scene("Definition", "Time For Half\nTo Be Gone", "That is all a half-life measures."),
            Scene("Why It Matters", "Key For\nStudy Design", "In research, half-life tells scientists how long a compound persists."),
            Scene("Learn More", "Research Library", f"Read the monographs at {SITE}"),
        ],
        "caption": "Half-life, explained simply: the time for half of a substance to be gone. Research context only. For in vitro laboratory research use only.",
    },
    {
        "slug": "reconstitution-science",
        "scenes": [
            Scene("Lab & Handling", "Reconstitution,\nExplained", "The science of preparing a lyophilized peptide."),
            Scene("Step 1", "Lyophilized\nPowder", "Many research peptides ship freeze-dried for stability."),
            Scene("Step 2", "Add Diluent\nSlowly", "Bacteriostatic or sterile water, down the vial wall - never sprayed onto the pellet."),
            Scene("Step 3", "Swirl,\nDo Not Shake", "Gentle mixing protects the peptide chain."),
            Scene("Do The Math", "Concentration\nCalculator", f"Reconstitution math at {SITE}/research"),
        ],
        "caption": "Reconstitution science for the lab: lyophilized powder, gentle diluent addition, swirl - do not shake. Research handling only. For in vitro laboratory research use only.",
    },
    {
        "slug": "evidence-tiers",
        "scenes": [
            Scene("Data & Trends", "Evidence Tiers,\nExplained", "Not all research compounds carry the same weight of evidence."),
            Scene("Tier", "Approved Drug", "Regulator-approved, extensive clinical data."),
            Scene("Tier", "Investigational", "In active clinical trials."),
            Scene("Tier", "Preclinical /\nResearch Compound", "Animal and in vitro data; the research frontier."),
            Scene("Read The Tiers", "Every Monograph\nIs Tiered", f"See the evidence tier on each page at {SITE}"),
        ],
        "caption": "Evidence tiers, explained: from Approved Drug to Research Compound. Every monograph on our site is tiered. For in vitro laboratory research use only.",
    },
    {
        "slug": "research-use-only",
        "scenes": [
            Scene("RUO Explainer", "Research\nUse Only", "It is not fine print - it is the whole point."),
            Scene("What It Means", "In Vitro\nLab Work", "Cell studies, analytical work, scientific inquiry."),
            Scene("What It Is Not", "Not A Drug", "Not FDA-approved. Not for human or animal use."),
            Scene("Why It Exists", "Keeps Compounds\nIn Research", "The RUO label keeps research-grade compounds in legitimate research channels."),
            Scene("Learn More", "Compliance", f"Read our standard at {SITE}/compliance"),
        ],
        "caption": "Research Use Only is not a technicality - it is compliance. In vitro lab work, not a drug. For in vitro laboratory research use only.",
    },
    {
        "slug": "how-to-read-a-coa",
        "scenes": [
            Scene("Lab & Handling", "How To Read\nA COA", "The Certificate Of Analysis is a compound's report card."),
            Scene("Line 1", "Identity", "Does the mass spec confirm the right molecule?"),
            Scene("Line 2", "Purity", "HPLC percentage - how much is the target compound."),
            Scene("Line 3", "Batch & Date", "Traceability back to a specific production run."),
            Scene("Verify First", "Always Check\nThe COA", f"Learn what to look for at {SITE}"),
        ],
        "caption": "How to read a COA: identity, purity, batch traceability. A Certificate of Analysis is a research compound's report card. For in vitro laboratory research use only.",
    },
]

GLOSSARY_TERMS = [
    ("Peptide", "A short chain of amino acids joined by peptide bonds. Link a few and you get a peptide; link hundreds and you get a protein."),
    ("Amino Acid", "The building blocks of peptides and proteins. Twenty standard amino acids combine in sequence to define a molecule."),
    ("Molecular Weight", "The mass of one molecule, measured in daltons (Da). A core identity marker used for research reproducibility."),
    ("Half-Life", "The time it takes for half of a substance to be eliminated. Helps researchers design and interpret studies."),
    ("Reconstitution", "Dissolving a lyophilized (freeze-dried) peptide in a sterile diluent to prepare it for laboratory work."),
    ("Evidence Tier", "A ranking of how much scientific evidence supports a compound, from Approved Drug down to Research Compound."),
]

# Featured compounds (spotlight Shorts) and comparison pin pairs.
SPOTLIGHT_SLUGS = [
    "bpc-157", "tb-500", "semaglutide", "tirzepatide",
    "ipamorelin", "sermorelin", "ghk-cu", "epithalon",
]
COMPARISON_PAIRS = [
    ("bpc-157", "tb-500"),
    ("semaglutide", "tirzepatide"),
    ("ipamorelin", "sermorelin"),
    ("ghk-cu", "epithalon"),
    ("bpc-157", "ghk-cu"),
    ("tb-500", "ghk-cu"),
    ("sermorelin", "semaglutide"),
    ("ipamorelin", "tirzepatide"),
]


# --------------------------------------------------------------------------- #
# Data loading: Supabase REST first, embedded fallback second.
# --------------------------------------------------------------------------- #
def load_compounds() -> dict[str, dict]:
    url = (os.environ.get("SUPABASE_URL")
           or os.environ.get("NEXT_PUBLIC_SUPABASE_URL"))
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
           or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
    if url and key:
        try:
            q = (url.rstrip("/") + "/rest/v1/compounds?select=slug,display_name,"
                 "compound_class,evidence_tier,identity,half_life,studied_for")
            req = urllib.request.Request(
                q, headers={"apikey": key, "Authorization": f"Bearer {key}"})
            with urllib.request.urlopen(req, timeout=25) as r:
                rows = json.load(r)
            out = {}
            for row in rows:
                ident = row.get("identity") or {}
                out[row["slug"]] = {
                    "slug": row["slug"],
                    "display_name": row["display_name"],
                    "compound_class": row.get("compound_class"),
                    "evidence_tier": row.get("evidence_tier"),
                    "mw": ident.get("molecular_weight") or "-",
                    "sequence": ident.get("sequence") or "-",
                    "cas": ident.get("cas") or "-",
                    "half_life": row.get("half_life") or "-",
                    "studied_for": row.get("studied_for") or [],
                }
            if out:
                print(f"[data] loaded {len(out)} compounds from Supabase")
                return out
        except Exception as e:  # noqa: BLE001
            print(f"[data] Supabase fetch failed ({e}); using embedded fallback")
    print(f"[data] using embedded fallback ({len(FALLBACK_COMPOUNDS)} compounds)")
    return {c["slug"]: c for c in FALLBACK_COMPOUNDS}


# Real snapshot pulled from the compounds table (keeps gen.py runnable offline).
FALLBACK_COMPOUNDS = [
    {"slug": "bpc-157", "display_name": "BPC-157",
     "compound_class": "Synthetic pentadecapeptide derived from human gastric juice protein BPC",
     "evidence_tier": "research_chemical", "mw": "~1419 Da",
     "sequence": "Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val",
     "cas": "137525-51-0", "half_life": "~30 minutes",
     "studied_for": ["GI mucosal healing", "Tendon / ligament repair", "Nerve repair", "Angiogenesis promotion"]},
    {"slug": "tb-500", "display_name": "TB-500 / Thymosin Beta-4",
     "compound_class": "Endogenous 43-amino acid thymic peptide; G-actin sequestrant",
     "evidence_tier": "research_chemical", "mw": "Tbeta4 ~4921 Da; fragment ~889 Da",
     "sequence": "full Tbeta4 43 aa; TB-500 fragment Ac-LKKTETQ",
     "cas": "77591-33-4", "half_life": "~30 hours",
     "studied_for": ["Dermal / corneal wound healing", "Cardiac repair models", "Angiogenesis", "Stem cell migration"]},
    {"slug": "semaglutide", "display_name": "Semaglutide",
     "compound_class": "GLP-1 receptor agonist; fatty-acid conjugated 31-amino-acid GLP-1 analog",
     "evidence_tier": "approved_drug", "mw": "~4114 g/mol",
     "sequence": "31-aa GLP-1 analog (Aib2, C18 diacid)",
     "cas": "910463-68-2", "half_life": "~1 week",
     "studied_for": ["Type 2 diabetes management", "Chronic weight management / obesity", "Cardiovascular risk reduction", "Appetite suppression"]},
    {"slug": "tirzepatide", "display_name": "Tirzepatide",
     "compound_class": "Dual GIP/GLP-1 receptor co-agonist (twincretin); 39-residue peptide",
     "evidence_tier": "approved_drug", "mw": "~4814 g/mol",
     "sequence": "39-aa acylated peptide (C20 diacid)",
     "cas": "2023788-19-2", "half_life": "~1 week",
     "studied_for": ["Type 2 diabetes management", "Chronic weight management / obesity", "Cardiovascular risk reduction", "Appetite suppression"]},
    {"slug": "ipamorelin", "display_name": "Ipamorelin",
     "compound_class": "Selective synthetic pentapeptide GH secretagogue (GHRP)",
     "evidence_tier": "research_chemical", "mw": "~712 Da",
     "sequence": "Aib-His-D-2-Nal-D-Phe-Lys-NH2",
     "cas": "170851-70-4", "half_life": "~2 hours",
     "studied_for": ["GH secretagogue research", "Anti-aging / longevity"]},
    {"slug": "sermorelin", "display_name": "Sermorelin",
     "compound_class": "Synthetic 29-amino acid fragment of endogenous GHRH (1-29-NH2)",
     "evidence_tier": "approved_drug", "mw": "~3358 Da",
     "sequence": "GHRH(1-29) amide",
     "cas": "86168-78-7", "half_life": "~10-20 min",
     "studied_for": ["GH secretagogue research", "Anti-aging / longevity"]},
    {"slug": "ghk-cu", "display_name": "GHK-Cu",
     "compound_class": "Naturally occurring copper-binding tripeptide (Gly-His-Lys + Cu2+)",
     "evidence_tier": "cosmetic", "mw": "~402 Da (copper complex)",
     "sequence": "Gly-His-Lys + Cu(II)",
     "cas": "49557-75-7", "half_life": "~5-10 minutes",
     "studied_for": ["Wound healing", "Skin anti-aging", "Collagen synthesis stimulation", "Antioxidant defense"]},
    {"slug": "epithalon", "display_name": "Epithalon",
     "compound_class": "Synthetic tetrapeptide bioregulator derived from pineal epithalamin",
     "evidence_tier": "research_chemical", "mw": "~390.35 Da",
     "sequence": "Ala-Glu-Asp-Gly (AEDG)",
     "cas": "307297-39-8", "half_life": "~10-15 minutes",
     "studied_for": ["Telomere elongation", "Anti-aging / longevity", "Circadian rhythm regulation", "Antioxidant defense"]},
]


# --------------------------------------------------------------------------- #
# Spotlight Short builder
# --------------------------------------------------------------------------- #
def spotlight_scenes(c: dict) -> tuple[list[Scene], str]:
    name = c["display_name"]
    klass = short_class(c["compound_class"])
    areas = safe_areas(c["studied_for"], 3)
    areas_line = "; ".join(areas)

    scenes = [
        Scene("Compound Spotlight", name, "At A Glance - Research Reference"),
        Scene("Class", klass.split(" derived")[0][:40] or "Research Peptide",
              tier_label(c["evidence_tier"]) + " tier"),
        Scene("Molecular Identity", "Molecular\nWeight", mono=c["mw"]),
        Scene("Sequence", "Sequence", mono=short_seq(c["sequence"])),
        Scene("Identity", "CAS  /  Half-Life",
              sub=f"Half-Life {c['half_life']}", mono=c["cas"]),
        Scene("In Research", "Studied In", sub=areas_line),
        Scene("Full Monograph", "Read The\nEvidence", f"Referenced monograph at {SITE}/research/{c['slug']}"),
    ]
    caption = (
        f"{name} at a glance (research reference). Molecular facts, not claims. "
        f"Studied in {areas_line}. Full evidence-tiered monograph on our site. "
        f"For in vitro laboratory research use only."
    )
    return scenes, caption


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def scene_durations(n: int) -> list[float]:
    # opener a touch longer, closer a touch longer; middle even.
    if n <= 1:
        return [5.0]
    base = [4.8] + [4.6] * (n - 2) + [5.4]
    return base[:n]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="social-batch")
    ap.add_argument("--only", choices=["all", "videos", "images"], default="all")
    ap.add_argument("--limit-spotlights", type=int, default=8)
    ap.add_argument("--limit-comparisons", type=int, default=8)
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH.")

    out = Path(args.out)
    (out / "videos").mkdir(parents=True, exist_ok=True)
    (out / "images").mkdir(parents=True, exist_ok=True)

    compounds = load_compounds()
    manifest: list[dict] = []

    # ---- Videos ----
    if args.only in ("all", "videos"):
        print("\n== Science Explainer Shorts ==")
        for spec in SCIENCE_SHORTS:
            caption = spec["caption"]
            assert_clean(f"science:{spec['slug']}", caption,
                         *(s.headline + " " + s.sub for s in spec["scenes"]))
            outp = out / "videos" / f"science_{spec['slug']}.mp4"
            durs = scene_durations(len(spec["scenes"]))
            build_video(spec["scenes"], durs, outp)
            manifest.append({"file": str(outp), "type": "video",
                             "kind": "science", "caption": caption})
            print(f"  ok  {outp.name}  ({sum(durs):.1f}s)")

        print("\n== Compound Spotlight Shorts ==")
        for slug in SPOTLIGHT_SLUGS[: args.limit_spotlights]:
            c = compounds.get(slug)
            if not c:
                print(f"  skip {slug} (not in data)")
                continue
            scenes, caption = spotlight_scenes(c)
            assert_clean(f"spotlight:{slug}", caption,
                         *(s.headline + " " + s.sub for s in scenes))
            outp = out / "videos" / f"spotlight_{slug}.mp4"
            durs = scene_durations(len(scenes))
            build_video(scenes, durs, outp)
            manifest.append({"file": str(outp), "type": "video",
                             "kind": "spotlight", "slug": slug, "caption": caption})
            print(f"  ok  {outp.name}  ({sum(durs):.1f}s)")

    # ---- Images ----
    if args.only in ("all", "images"):
        print("\n== Comparison Pins ==")
        for a_slug, b_slug in COMPARISON_PAIRS[: args.limit_comparisons]:
            a, b = compounds.get(a_slug), compounds.get(b_slug)
            if not a or not b:
                print(f"  skip {a_slug} vs {b_slug} (missing data)")
                continue
            outp = out / "images" / f"compare_{a_slug}_vs_{b_slug}.png"
            render_comparison_pin(a, b, outp)
            manifest.append({"file": str(outp), "type": "image", "kind": "comparison",
                             "pair": [a_slug, b_slug]})
            print(f"  ok  {outp.name}")

        print("\n== Glossary Cards ==")
        for term, definition in GLOSSARY_TERMS:
            assert_clean(f"glossary:{term}", term, definition)
            slug = term.lower().replace(" ", "-")
            outp = out / "images" / f"glossary_{slug}.png"
            render_glossary_card(term, definition, outp)
            manifest.append({"file": str(outp), "type": "image", "kind": "glossary",
                             "term": term})
            print(f"  ok  {outp.name}")

    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    n_vid = sum(1 for m in manifest if m["type"] == "video")
    n_img = sum(1 for m in manifest if m["type"] == "image")
    print(f"\nDONE  {n_vid} videos + {n_img} images -> {out}/")
    print(f"Manifest: {out}/manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
