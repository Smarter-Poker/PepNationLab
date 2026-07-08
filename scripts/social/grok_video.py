#!/usr/bin/env python3
"""
grok_video.py - Pep Nation Lab dynamic social video generator.

Pipeline (per Short):
  1. Build an on-brand, RUO-safe cinematic prompt (no people, no text in frame,
     no benefit/human-use claims - visuals only).
  2. Call the xAI Grok Imagine video API (grok-imagine-video), 9:16 vertical,
     up to 15s, 720p+, then poll until the render is done.
  3. Download the returned MP4.
  4. Composite a branded overlay (hook headline + wordmark + RUO footer) with
     ffmpeg. The overlay is rendered by Pillow to a transparent PNG so text
     wrapping, scrims, and fonts are fully controlled (no drawtext escaping).
  5. Optionally mux a background music track if provided.
  6. Write the finished 1080x1920 Short; optionally upload to a public Supabase
     bucket so it gets a shareable URL.

This runs where the network can reach api.x.ai and ffmpeg exists (GitHub
Actions, a Linux box, etc.) - NOT inside the Cowork sandbox, which is
firewalled off from api.x.ai.

Env:
  XAI_API_KEY                 (required)
  SUPABASE_URL                (optional - enables upload)
  SUPABASE_SERVICE_ROLE_KEY   (optional - enables upload)
  SUPABASE_BUCKET             (optional, default 'social-media')

Usage:
  python3 grok_video.py --topic bpc-157 --out out.mp4
  python3 grok_video.py --prompt "..." --hook "What Is BPC-157?" --out out.mp4
  python3 grok_video.py --topic reconstitution --duration 12 --upload
"""

import argparse
import os
import sys
import time
import textwrap
import urllib.request
import urllib.error
import json
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

API_BASE = "https://api.x.ai/v1"
BRAND_TEAL = (0, 196, 188)
BRAND_BG = (5, 10, 15)
WHITE = (255, 255, 255)
SILVER = (168, 180, 192)
RUO_TEXT = "For In Vitro Laboratory Research Use Only. Not For Human Or Animal Use."

# Curated cinematic scene prompts. Visuals ONLY - deliberately no people, no
# on-screen text (Grok text rendering is unreliable), and no therapeutic or
# human-use imagery, to stay Research-Use-Only compliant. Dark lab aesthetic,
# teal accent light, macro/scientific subjects - matches the site brand.
SCENES = {
    "peptide-101": (
        "Extreme macro cinematic shot inside a dark research laboratory, a single "
        "glowing amino-acid chain forming and coiling into a peptide helix, "
        "translucent teal and cyan light refracting through glass, slow dolly push-in, "
        "shallow depth of field, volumetric haze, hyper-detailed, 4k, no text"
    ),
    "reconstitution": (
        "Cinematic macro of a sterile glass vial on a dark reflective lab bench, "
        "a clear droplet falling into it and swirling in slow motion, soft teal rim "
        "lighting, condensation on glass, scientific and clean, shallow depth of field, "
        "no hands, no text, 4k"
    ),
    "coa": (
        "Slow cinematic pan across a row of labeled research vials in a dark lab, "
        "faint teal laboratory lighting, a laser scanner line sweeping across them, "
        "sense of purity testing and analysis, hyper-detailed reflections, no text, 4k"
    ),
    "bpc-157": (
        "Abstract cinematic visualization of a peptide molecule rotating in dark "
        "space, glowing teal and white molecular bonds, particles of light drifting, "
        "deep depth of field, premium scientific motion graphic, no text, 4k"
    ),
    "tb-500": (
        "Cinematic macro of luminous protein strands weaving through a dark fluid, "
        "teal bioluminescence, slow graceful motion, microscopic world aesthetic, "
        "hyper-detailed, no text, 4k"
    ),
    "molecule": (
        "A complex 3D peptide molecular structure slowly rotating, glowing teal nodes "
        "and silver bonds, dark cinematic background with subtle particles, premium "
        "science visualization, depth of field, no text, 4k"
    ),
    "lab": (
        "Cinematic slow tracking shot through a futuristic dark research laboratory, "
        "rows of glassware and instruments lit by teal accent lighting, volumetric "
        "light beams, clean and high-tech, no people, no text, 4k"
    ),
}

HOOKS = {
    "peptide-101": "What Is A Peptide?",
    "reconstitution": "Reconstitution 101",
    "coa": "Every Batch Is Tested",
    "bpc-157": "BPC-157 Explained",
    "tb-500": "TB-500 Explained",
    "molecule": "The Science Of Peptides",
    "lab": "Research Grade. Verified.",
}


def log(msg):
    print(f"[grok_video] {msg}", flush=True)


# --------------------------------------------------------------------------- #
# Grok Imagine video API
# --------------------------------------------------------------------------- #
def grok_generate_video(prompt, duration, aspect_ratio, resolution, api_key,
                        poll_timeout=900, poll_interval=6):
    """Start a text-to-video job and poll until done. Returns the video URL."""
    start_body = json.dumps({
        "model": "grok-imagine-video",
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
    }).encode()

    req = urllib.request.Request(
        f"{API_BASE}/videos/generations",
        data=start_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            start = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Grok start failed ({e.code}): {e.read().decode()[:500]}")

    request_id = start.get("request_id")
    if not request_id:
        raise SystemExit(f"No request_id in response: {start}")
    log(f"generation started, request_id={request_id}")

    deadline = time.time() + poll_timeout
    while time.time() < deadline:
        poll = urllib.request.Request(
            f"{API_BASE}/videos/{request_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        with urllib.request.urlopen(poll, timeout=60) as r:
            data = json.loads(r.read())
        status = data.get("status")
        if status == "done":
            url = data["video"]["url"]
            log(f"render done: {url}")
            return url
        if status in ("failed", "expired"):
            raise SystemExit(f"Grok generation {status}: {json.dumps(data)[:500]}")
        log(f"status={status} ... waiting")
        time.sleep(poll_interval)
    raise SystemExit("Grok generation timed out")


def download(url, dest):
    log(f"downloading -> {dest}")
    urllib.request.urlretrieve(url, dest)
    return dest


# --------------------------------------------------------------------------- #
# Branding overlay (Pillow -> transparent PNG)
# --------------------------------------------------------------------------- #
def load_font(size, bold=True):
    candidates = [
        os.path.join(os.path.dirname(__file__), "fonts",
                     "Poppins-Bold.ttf" if bold else "Poppins-Medium.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def build_overlay(hook, width=1080, height=1920):
    """Transparent PNG: top scrim + hook, bottom brand bar + RUO footer."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Top gradient scrim so white hook text stays legible over any footage.
    scrim_h = 520
    for y in range(scrim_h):
        a = int(190 * (1 - y / scrim_h))
        d.line([(0, y), (width, y)], fill=(5, 10, 15, a))

    # Hook headline (wrapped, centered, teal accent bar above).
    hook_font = load_font(78, bold=True)
    d.rectangle([80, 120, 200, 132], fill=BRAND_TEAL + (255,))
    lines = textwrap.wrap(hook, width=16) or [hook]
    y = 170
    for line in lines:
        d.text((80, y), line, font=hook_font, fill=WHITE + (255,))
        y += 92

    # Bottom brand + RUO footer bar.
    bar_top = height - 220
    d.rectangle([0, bar_top, width, height], fill=(5, 10, 15, 235))
    d.rectangle([0, bar_top, width, bar_top + 5], fill=BRAND_TEAL + (255,))

    wm_font = load_font(46, bold=True)
    handle_font = load_font(34, bold=False)
    d.text((80, bar_top + 34), "PEPNATIONLAB.COM", font=wm_font, fill=BRAND_TEAL + (255,))
    d.text((80, bar_top + 92), "@pepnationlab", font=handle_font, fill=SILVER + (255,))

    ruo_font = load_font(26, bold=False)
    ruo_lines = textwrap.wrap(RUO_TEXT, width=52)
    ry = bar_top + 138
    for line in ruo_lines:
        d.text((80, ry), line, font=ruo_font, fill=SILVER + (255,))
        ry += 32

    out = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
    img.save(out)
    return out


# --------------------------------------------------------------------------- #
# ffmpeg composite
# --------------------------------------------------------------------------- #
def composite(clip, overlay_png, out, music=None, width=1080, height=1920):
    vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height}[bg];[bg][1:v]overlay=0:0[v]")
    cmd = ["ffmpeg", "-y", "-i", clip, "-i", overlay_png]
    maps = ["-map", "[v]"]
    if music and os.path.exists(music):
        cmd += ["-stream_loop", "-1", "-i", music]
        maps += ["-map", "2:a", "-shortest"]
        acodec = ["-c:a", "aac", "-b:a", "160k"]
    else:
        acodec = ["-an"]
    cmd += ["-filter_complex", vf] + maps + [
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
        "-profile:v", "high", "-preset", "medium", "-movflags", "+faststart",
    ] + acodec + [out]
    log("compositing branded overlay with ffmpeg")
    subprocess.run(cmd, check=True)
    return out


# --------------------------------------------------------------------------- #
# Optional Supabase upload
# --------------------------------------------------------------------------- #
def supabase_upload(path, bucket, object_name):
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        log("Supabase creds absent - skipping upload")
        return None
    endpoint = f"{url}/storage/v1/object/{bucket}/{object_name}"
    with open(path, "rb") as f:
        body = f.read()
    req = urllib.request.Request(
        endpoint, data=body, method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "video/mp4",
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            r.read()
    except urllib.error.HTTPError as e:
        log(f"Supabase upload failed ({e.code}): {e.read().decode()[:300]}")
        return None
    public = f"{url}/storage/v1/object/public/{bucket}/{object_name}"
    log(f"uploaded -> {public}")
    return public


# --------------------------------------------------------------------------- #
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--topic", help=f"one of: {', '.join(SCENES)}")
    p.add_argument("--prompt", help="custom Grok visual prompt (overrides --topic)")
    p.add_argument("--hook", help="on-screen headline (overrides topic default)")
    p.add_argument("--duration", type=int, default=12)
    p.add_argument("--resolution", default="720p")
    p.add_argument("--aspect", default="9:16")
    p.add_argument("--music", help="optional background music file to loop under the clip")
    p.add_argument("--out", default="short.mp4")
    p.add_argument("--upload", action="store_true", help="upload finished file to Supabase bucket")
    args = p.parse_args()

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise SystemExit("XAI_API_KEY env var is required")

    if args.prompt:
        prompt = args.prompt
        hook = args.hook or "Pep Nation Lab"
    else:
        topic = args.topic or "molecule"
        if topic not in SCENES:
            raise SystemExit(f"unknown --topic '{topic}'. options: {', '.join(SCENES)}")
        prompt = SCENES[topic]
        hook = args.hook or HOOKS.get(topic, "Pep Nation Lab")

    log(f"hook={hook!r}")
    log(f"prompt={prompt[:90]}...")

    clip = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
    url = grok_generate_video(prompt, args.duration, args.aspect, args.resolution, api_key)
    download(url, clip)

    overlay = build_overlay(hook)
    composite(clip, overlay, args.out, music=args.music)
    log(f"finished Short -> {args.out}")

    if args.upload:
        bucket = os.environ.get("SUPABASE_BUCKET", "social-media")
        name = os.path.basename(args.out)
        supabase_upload(args.out, bucket, name)


if __name__ == "__main__":
    main()
