#!/usr/bin/env python3
"""
grok_video.py - Pep Nation Lab dynamic social video generator (v2).

Adds to v1: spoken voiceover narration (xAI Grok TTS), an ambient music bed
mixed under the voice, on-screen captions timed to the narration, and the
compound's POPULAR / common name shown on-screen AND spoken in every
compound video.

Per Short:
  1. Pick a cinematic, RUO-safe visual prompt (no people, no on-screen text,
     no human-use/benefit claims - visuals only).
  2. Grok Imagine video (grok-imagine-video), 9:16 vertical, 720p.
  3. Grok TTS (POST /v1/tts, voice 'orion') renders the narration script to MP3.
     The script always names the popular/common name of the compound.
  4. Build a branded overlay (hook + "Also Known As: <popular name>" +
     wordmark + RUO footer) with Pillow.
  5. Build sentence-level captions (.ass) timed across the voiceover.
  6. ffmpeg composites overlay + burned captions over the footage, mixes the
     voiceover (full) with a ducked ambient bed, and trims to the voiceover
     length. Falls back to silent-with-music if TTS is unavailable.
  7. Optionally upload the finished Short to a public Supabase bucket.

Runs where the network reaches api.x.ai and ffmpeg exists (GitHub Actions, a
Linux box) - NOT the Cowork sandbox, which is firewalled from api.x.ai.

Env:  XAI_API_KEY (required); SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (upload).
"""

import argparse
import base64
import datetime
import json
import os
import re
import subprocess
import tempfile
import time
import textwrap
import urllib.error
import urllib.request

from PIL import Image, ImageDraw, ImageFont

API_BASE = "https://api.x.ai/v1"
BRAND_TEAL = (0, 196, 188)
WHITE = (255, 255, 255)
SILVER = (168, 180, 192)
RUO_TEXT = "For In Vitro Laboratory Research Use Only. Not For Human Or Animal Use."

# Cinematic scene prompts - visuals ONLY (no people, no text, no human-use).
SCENES = {
    "peptide-101": "Extreme macro cinematic shot inside a dark research laboratory, a single glowing amino-acid chain forming and coiling into a peptide helix, translucent teal and cyan light refracting through glass, slow dolly push-in, shallow depth of field, volumetric haze, hyper-detailed, 4k, no text",
    "reconstitution": "Cinematic macro of a sterile glass vial on a dark reflective lab bench, a clear droplet falling into it and swirling in slow motion, soft teal rim lighting, condensation on glass, scientific and clean, shallow depth of field, no hands, no text, 4k",
    "coa": "Slow cinematic pan across a row of labeled research vials in a dark lab, faint teal laboratory lighting, a laser scanner line sweeping across them, sense of purity testing and analysis, hyper-detailed reflections, no text, 4k",
    "bpc-157": "Abstract cinematic visualization of a peptide molecule rotating in dark space, glowing teal and white molecular bonds, particles of light drifting, deep depth of field, premium scientific motion graphic, no text, 4k",
    "tb-500": "Cinematic macro of luminous protein strands weaving through a dark fluid, teal bioluminescence, slow graceful motion, microscopic world aesthetic, hyper-detailed, no text, 4k",
    "ghk-cu": "Cinematic macro of a glowing copper-blue peptide complex forming in dark space, metallic teal and copper light, elegant molecular bonds rotating slowly, premium science visualization, no text, 4k",
    "semaglutide": "Abstract cinematic visualization of a long glowing peptide chain slowly rotating in dark space, teal and cyan light, drifting particles, premium scientific motion graphic, no text, 4k",
    "tirzepatide": "Cinematic visualization of a dual-strand glowing peptide molecule rotating in dark space, teal and white bonds, particles of light, premium science motion graphic, no text, 4k",
    "molecule": "A complex 3D peptide molecular structure slowly rotating, glowing teal nodes and silver bonds, dark cinematic background with subtle particles, premium science visualization, depth of field, no text, 4k",
    "lab": "Cinematic slow tracking shot through a futuristic dark research laboratory, rows of glassware and instruments lit by teal accent lighting, volumetric light beams, clean and high-tech, no people, no text, 4k",
}

HOOKS = {
    "peptide-101": "What Is A Peptide?",
    "reconstitution": "Reconstitution 101",
    "coa": "Every Batch Is Tested",
    "bpc-157": "BPC-157 Explained",
    "tb-500": "TB-500 Explained",
    "ghk-cu": "GHK-Cu Explained",
    "semaglutide": "Semaglutide Explained",
    "tirzepatide": "Tirzepatide Explained",
    "molecule": "The Science Of Peptides",
    "lab": "Research Grade. Verified.",
}

# Popular / common name shown on-screen and spoken. Empty for non-compound
# topics. For expansion, prefer the compound DB `aliases` field via --alias.
ALIASES = {
    "bpc-157": "Body Protection Compound 157",
    "tb-500": "Thymosin Beta-4",
    "ghk-cu": "Copper Peptide (GHK-Cu)",
    "semaglutide": "GLP-1 Research Analog",
    "tirzepatide": "GIP / GLP-1 Research Analog",
}

# Captions attached to the queued post. These are checked by the SAME compliance
# gate the autoposter runs before publishing (lib/social/compliance.ts), so they
# must stay research-framed: no dosing, no human-use, no benefit/therapeutic
# claims, no commerce language. A caption that trips the gate is queued as
# 'blocked' and surfaces in the admin console rather than being published.
CAPTIONS = {
    "peptide-101": "What actually IS a peptide? A short chain of amino acids, studied in vitro. Plain-language glossary on our site. For in vitro laboratory research use only. #peptidescience #biochemistry",
    "reconstitution": "Reconstitution science for the lab: lyophilized powder, gentle diluent addition, swirl - do not shake. A laboratory handling step. For in vitro laboratory research use only. #labscience",
    "coa": "How to read a COA: identity, purity, and batch traceability. A Certificate of Analysis is a research compound's report card. For in vitro laboratory research use only. #researchpeptides",
    "bpc-157": "BPC-157 at a glance (research reference). Molecular facts, not claims. Studied in tissue-repair models. Full evidence-tiered monograph on our site. For in vitro laboratory research use only.",
    "tb-500": "TB-500 / Thymosin Beta-4 at a glance (research reference). Molecular facts, not claims. Studied in cell-migration models. For in vitro laboratory research use only.",
    "molecule": "The science of peptides: short chains of amino acids, studied in vitro. Referenced monographs on our site. For in vitro laboratory research use only. #peptidescience",
    "lab": "Research grade, verified. Every compound is referenced and evidence-tiered. For in vitro laboratory research use only. #labscience #researchpeptides",
}

# RUO-safe narration. Always names the popular/common name for compounds.
# No dosing, no human-use, no benefit/therapeutic claims.
SCRIPTS = {
    "peptide-101": "Peptides are short chains of amino acids, the building blocks that tell cells how to function. [pause] Researchers study them in the lab to understand biology at the molecular level. Pep Nation Lab supplies research-grade peptides for in vitro laboratory research use only.",
    "reconstitution": "Reconstitution is how a lyophilized research peptide is prepared for study. [pause] A measured volume of solvent is added to the vial and gently swirled until clear. This is a laboratory handling step, for in vitro research use only.",
    "coa": "Every compound Pep Nation Lab ships is backed by a batch certificate of analysis. [pause] That means independent testing for identity and purity, documented for the researcher. Research grade, verified, and for in vitro laboratory use only.",
    "bpc-157": "BPC-157, popularly known as Body Protection Compound 157, is a synthetic peptide widely studied in cellular repair research. [pause] It is one of the most referenced compounds in the laboratory. Supplied for in vitro research use only.",
    "tb-500": "TB-500, the popular name for the peptide Thymosin Beta-4, is studied for its role in cell migration and structure. [pause] A staple of peptide research libraries. Supplied strictly for in vitro laboratory research use only.",
    "ghk-cu": "GHK-Cu, popularly called the Copper Peptide, is a naturally occurring complex studied in cellular and matrix research. [pause] Distinct for its copper-binding structure. Supplied for in vitro research use only.",
    "semaglutide": "Semaglutide is a long-acting GLP-1 research analog studied at the molecular level. [pause] Pep Nation Lab supplies it as a research-grade compound for in vitro laboratory research use only, never for human or animal use.",
    "tirzepatide": "Tirzepatide is a dual GIP and GLP-1 research analog studied for its molecular structure. [pause] Pep Nation Lab supplies it research grade, for in vitro laboratory research use only, never for human or animal use.",
    "molecule": "Every peptide has a precise molecular structure that defines how it behaves. [pause] Understanding that structure is the first step in rigorous research. Pep Nation Lab supplies research-grade compounds for the laboratory only.",
    "lab": "Research grade means verified. [pause] Every Pep Nation Lab compound is tested for identity and purity and documented with a certificate of analysis. For in vitro laboratory research use only.",
}


def log(m):
    print(f"[grok_video] {m}", flush=True)


def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


# --------------------------------------------------------------------------- #
# Grok Imagine video
# --------------------------------------------------------------------------- #
def grok_video(prompt, duration, aspect, resolution, api_key,
               poll_timeout=900, poll_interval=6):
    body = json.dumps({
        "model": "grok-imagine-video", "prompt": prompt,
        "duration": duration, "aspect_ratio": aspect, "resolution": resolution,
    }).encode()
    req = urllib.request.Request(
        f"{API_BASE}/videos/generations", data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            rid = json.loads(r.read())["request_id"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Grok video start failed ({e.code}): {e.read().decode()[:400]}")
    log(f"video request_id={rid}")
    deadline = time.time() + poll_timeout
    while time.time() < deadline:
        with urllib.request.urlopen(urllib.request.Request(
                f"{API_BASE}/videos/{rid}",
                headers={"Authorization": f"Bearer {api_key}"}), timeout=60) as r:
            data = json.loads(r.read())
        st = data.get("status")
        if st == "done":
            return data["video"]["url"]
        if st in ("failed", "expired"):
            raise SystemExit(f"Grok video {st}: {json.dumps(data)[:400]}")
        log(f"video status={st}")
        time.sleep(poll_interval)
    raise SystemExit("Grok video timed out")


# --------------------------------------------------------------------------- #
# Grok TTS voiceover
# --------------------------------------------------------------------------- #
def grok_tts(text, voice, api_key, dest):
    """POST /v1/tts -> MP3 bytes (handles raw or base64-JSON responses)."""
    body = json.dumps({
        "text": text, "voice_id": voice,
        "output_format": {"codec": "mp3", "sample_rate": 44100},
    }).encode()
    req = urllib.request.Request(
        f"{API_BASE}/tts", data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    if raw[:1] == b"{":  # JSON envelope with base64 audio
        obj = json.loads(raw)
        raw = base64.b64decode(obj["audio"])
    with open(dest, "wb") as f:
        f.write(raw)
    return dest


# --------------------------------------------------------------------------- #
# Branded overlay (Pillow)
# --------------------------------------------------------------------------- #
def font(size, bold=True):
    for c in [os.path.join(os.path.dirname(__file__), "fonts",
                           "Poppins-Bold.ttf" if bold else "Poppins-Medium.ttf"),
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
              else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def build_overlay(hook, alias, w=1080, h=1920):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    scrim = 560
    for y in range(scrim):
        d.line([(0, y), (w, y)], fill=(5, 10, 15, int(195 * (1 - y / scrim))))
    d.rectangle([80, 120, 200, 132], fill=BRAND_TEAL + (255,))
    y = 170
    for line in (textwrap.wrap(hook, width=16) or [hook]):
        d.text((80, y), line, font=font(78, True), fill=WHITE + (255,))
        y += 92
    if alias:
        d.text((80, y + 6), "Also Known As:", font=font(30, False), fill=SILVER + (255,))
        y += 46
        for line in textwrap.wrap(alias, width=30):
            d.text((80, y + 6), line, font=font(40, True), fill=BRAND_TEAL + (255,))
            y += 50
    bar = h - 220
    d.rectangle([0, bar, w, h], fill=(5, 10, 15, 235))
    d.rectangle([0, bar, w, bar + 5], fill=BRAND_TEAL + (255,))
    d.text((80, bar + 34), "PEPNATIONLAB.COM", font=font(46, True), fill=BRAND_TEAL + (255,))
    d.text((80, bar + 92), "@pepnationlab", font=font(34, False), fill=SILVER + (255,))
    ry = bar + 138
    for line in textwrap.wrap(RUO_TEXT, width=52):
        d.text((80, ry), line, font=font(26, False), fill=SILVER + (255,))
        ry += 32
    out = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
    img.save(out)
    return out


# --------------------------------------------------------------------------- #
# Captions (.ass) timed proportionally across the voiceover
# --------------------------------------------------------------------------- #
def _ts(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def build_ass(script, total, path, w=1080, h=1920):
    clean = re.sub(r"\[[^\]]*\]|<[^>]*>", "", script)  # drop TTS tags
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()]
    if not sentences:
        sentences = [clean.strip()]
    weights = [max(len(s), 1) for s in sentences]
    tot_w = sum(weights)
    header = (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: %d\nPlayResY: %d\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, "
        "Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\n"
        "Style: Cap, DejaVu Sans, 46, &H00FFFFFF, &H00301505, &HC0000000, 1, 1, 3, 0, 2, 90, 90, 300\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        % (w, h)
    )
    lines, t = [], 0.0
    for s, wt in zip(sentences, weights):
        dur = total * (wt / tot_w)
        text = "\\N".join(textwrap.wrap(s, width=30))
        lines.append(f"Dialogue: 0,{_ts(t)},{_ts(t + dur)},Cap,,0,0,0,,{text}")
        t += dur
    with open(path, "w") as f:
        f.write(header + "\n".join(lines) + "\n")
    return path


# --------------------------------------------------------------------------- #
# Ambient music bed (generated - licensing-safe). Override by placing a track
# at scripts/social/assets/music/bed.mp3.
# --------------------------------------------------------------------------- #
def music_bed(length, dest):
    override = os.path.join(os.path.dirname(__file__), "assets", "music", "bed.mp3")
    if os.path.exists(override):
        return override, True
    freqs = [110.0, 130.81, 164.81, 220.0]  # A minor pad
    inputs, mixes = [], ""
    for i, fr in enumerate(freqs):
        inputs += ["-f", "lavfi", "-i", f"sine=frequency={fr}:duration={length:.2f}"]
        mixes += f"[{i}:a]"
    filt = (mixes + f"amix=inputs={len(freqs)}:normalize=0,"
            "tremolo=f=0.12:d=0.5,lowpass=f=700,volume=0.9,"
            f"afade=t=in:st=0:d=1.5,afade=t=out:st={max(length-1.5,0):.2f}:d=1.5[a]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs,
                    "-filter_complex", filt, "-map", "[a]", dest], check=True)
    return dest, False


# --------------------------------------------------------------------------- #
def compose(clip, overlay_png, out, vo=None, ass=None, bed=None, length=None):
    inputs = ["-stream_loop", "-1", "-i", clip, "-i", overlay_png]
    idx = 2
    vo_i = bed_i = None
    if vo:
        inputs += ["-i", vo]; vo_i = idx; idx += 1
    if bed:
        inputs += ["-i", bed]; bed_i = idx; idx += 1

    vchain = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];[bg][1:v]overlay=0:0[ov]"
    if ass:
        safe = ass.replace("\\", "/").replace(":", "\\:")
        vchain += f";[ov]subtitles='{safe}'[v]"
    else:
        vchain += ";[ov]null[v]"

    fc = vchain
    amap = None
    if vo_i is not None and bed_i is not None:
        fc += (f";[{vo_i}:a]volume=1.0,apad[voa];[{bed_i}:a]volume=0.14[bea];"
               "[voa][bea]amix=inputs=2:duration=longest:dropout_transition=3[a]")
        amap = "[a]"
    elif vo_i is not None:
        fc += f";[{vo_i}:a]volume=1.0[a]"; amap = "[a]"
    elif bed_i is not None:
        fc += f";[{bed_i}:a]volume=0.16[a]"; amap = "[a]"

    cmd = ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc,
           "-map", "[v]"]
    if amap:
        cmd += ["-map", amap, "-c:a", "aac", "-b:a", "192k"]
    else:
        cmd += ["-an"]
    if length:
        cmd += ["-t", f"{length:.2f}"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
            "-profile:v", "high", "-preset", "medium", "-movflags", "+faststart", out]
    log("compositing (overlay + captions + voice + music)")
    subprocess.run(cmd, check=True)
    return out


def supabase_upload(path, bucket, name):
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        log("Supabase creds absent - skipping upload"); return None
    with open(path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        f"{url}/storage/v1/object/{bucket}/{name}", data=data, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "video/mp4",
                 "x-upsert": "true"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            r.read()
    except urllib.error.HTTPError as e:
        log(f"upload failed ({e.code}): {e.read().decode()[:300]}"); return None
    pub = f"{url}/storage/v1/object/public/{bucket}/{name}"
    log(f"uploaded -> {pub}"); return pub


def enqueue(media_url, caption, platform, link, scheduled_for, dedupe_key):
    """
    Hand the finished asset to the publish queue via /api/social/ingest.

    Deliberately goes through the API rather than writing to Postgres directly:
    the endpoint runs the SAME compliance gate the autoposter uses, validates the
    payload, and is idempotent on dedupe_key -- so re-running this workflow does
    not double-queue. It also means CI never needs the service-role key for this
    step, just the shared CRON_SECRET.
    """
    app_url = (os.environ.get("APP_URL") or "https://pepnationlab.com").rstrip("/")
    secret = os.environ.get("CRON_SECRET")
    if not secret:
        log("CRON_SECRET absent - skipping enqueue"); return None

    payload = json.dumps({"posts": [{
        "platform": platform,
        "caption": caption,
        "mediaUrl": media_url,
        "mediaType": "video",
        "link": link,
        "scheduledFor": scheduled_for,
        "source": "grok",
        "dedupeKey": dedupe_key,
    }]}).encode()

    req = urllib.request.Request(
        f"{app_url}/api/social/ingest", data=payload, method="POST",
        headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        log(f"enqueue failed ({e.code}): {e.read().decode()[:300]}"); return None
    except Exception as e:  # noqa: BLE001
        log(f"enqueue failed: {e}"); return None

    if body.get("blocked"):
        log(f"WARNING: caption blocked by compliance gate - queued as 'blocked', will NOT post: {caption[:80]!r}")
    if body.get("duplicates"):
        log(f"already queued (dedupe_key={dedupe_key}) - nothing added")
    log(f"enqueue -> {body}")
    return body


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--topic")
    p.add_argument("--prompt")
    p.add_argument("--hook")
    p.add_argument("--alias", help="popular/common name (overrides built-in)")
    p.add_argument("--script", help="narration text (overrides built-in)")
    p.add_argument("--voice", default="orion")
    p.add_argument("--duration", type=int, default=15)
    p.add_argument("--resolution", default="720p")
    p.add_argument("--aspect", default="9:16")
    p.add_argument("--no-vo", action="store_true")
    p.add_argument("--no-music", action="store_true")
    p.add_argument("--out", default="short.mp4")
    p.add_argument("--upload", action="store_true")
    p.add_argument("--enqueue", action="store_true",
                   help="after upload, add the asset to the publish queue (implies --upload)")
    p.add_argument("--platform", default="youtube",
                   choices=["youtube", "x", "instagram", "facebook", "tiktok"],
                   help="target platform for the queued post (video platforms only)")
    p.add_argument("--caption", help="override the built-in RUO-safe caption")
    p.add_argument("--link", default="https://pepnationlab.com/research")
    p.add_argument("--schedule", help="ISO timestamp for when the post is due (default: now)")
    a = p.parse_args()

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise SystemExit("XAI_API_KEY env var is required")

    if a.prompt:
        prompt = a.prompt
        hook = a.hook or "Pep Nation Lab"
        alias = a.alias or ""
        script = a.script or ""
    else:
        topic = a.topic or "molecule"
        if topic not in SCENES:
            raise SystemExit(f"unknown --topic '{topic}'. options: {', '.join(SCENES)}")
        prompt = SCENES[topic]
        hook = a.hook or HOOKS.get(topic, "Pep Nation Lab")
        alias = a.alias if a.alias is not None else ALIASES.get(topic, "")
        script = a.script if a.script is not None else SCRIPTS.get(topic, "")

    log(f"hook={hook!r} alias={alias!r}")

    # 1. Grok video
    clip = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
    url = grok_video(prompt, a.duration, a.aspect, a.resolution, api_key)
    urllib.request.urlretrieve(url, clip)

    # 2. Voiceover (fail-soft)
    vo = ass = None
    length = None
    if not a.no_vo and script:
        try:
            vo = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name
            grok_tts(script, a.voice, api_key, vo)
            vo_dur = ffprobe_duration(vo)
            if vo_dur <= 0:
                raise RuntimeError("empty voiceover")
            length = min(15.0, vo_dur + 0.6)
            ass = tempfile.NamedTemporaryFile(suffix=".ass", delete=False).name
            build_ass(script, vo_dur, ass)
            log(f"voiceover {vo_dur:.1f}s -> final {length:.1f}s")
        except Exception as e:  # noqa
            log(f"TTS unavailable ({e}); proceeding silent-with-music")
            vo = ass = None
    if length is None:
        length = min(float(a.duration), ffprobe_duration(clip) or a.duration)

    # 3. Music bed
    bed = None
    if not a.no_music:
        bed = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name
        bed, _ = music_bed(length, bed)

    # 4. Compose
    compose(clip, build_overlay(hook, alias), a.out, vo=vo, ass=ass, bed=bed, length=length)
    log(f"finished -> {a.out}")

    # 5. Publish path: upload the asset, then hand its public URL to the queue.
    media_url = None
    if a.upload or a.enqueue:
        media_url = supabase_upload(a.out, os.environ.get("SUPABASE_BUCKET", "social-media"),
                                    os.path.basename(a.out))

    if a.enqueue:
        if not media_url:
            raise SystemExit("--enqueue requires a successful upload (no public media URL)")
        topic_key = a.topic or "molecule"
        caption = a.caption or CAPTIONS.get(topic_key)
        if not caption:
            raise SystemExit(f"no caption for topic {topic_key!r}; pass --caption")
        # Idempotent per topic per day: re-running the workflow will not duplicate.
        dedupe_key = f"grok-{a.platform}-{topic_key}-{datetime.date.today().isoformat()}"
        enqueue(media_url, caption, a.platform, a.link, a.schedule, dedupe_key)


if __name__ == "__main__":
    main()
