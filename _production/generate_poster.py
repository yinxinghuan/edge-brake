#!/usr/bin/env python3
import json
import ssl
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "poster.png"
RECORD = ROOT / "_production" / "poster-source.json"
ENDPOINT = "https://chat.aiwaves.tech/aigram/api/gen-image"

PROMPT = """
Standalone square 1024x1024 full-bleed key art for a short addictive 3D arcade game named EDGE BRAKE. This is the artwork itself, not a mockup and not shown on any device.
A charming chunky low-poly penguin is sliding at high speed across a floating iceberg and braking at the very last centimeter before a dramatic vertical ice cliff. The penguin leans backward, orange feet carving the ice, a burst of faceted snow crystals spraying behind it. Deep polar ocean far below, angular ice mountains and a pale moon in the background. Strong readable silhouette, orthographic three-quarter camera, flat-shaded vector-voxel 3D, hard polygon faces, matte materials, soft contact shadow, cool midnight navy and icy teal palette with one warm coral accent and golden reward sparkle. The danger and near-miss must read instantly at 160x160 thumbnail size. Place the exact English title “EDGE BRAKE” large and clean in the top 20 percent safe area, bold geometric sans serif white lettering, perfectly spelled. Keep the penguin face and cliff edge inside the central 60 percent. Bottom 20 percent contains only nonessential snow and ocean. ABSOLUTELY NO phone, tablet, watch, device, bezel, black border, rounded device corners, app icon frame, poster frame or mockup. The image must bleed cleanly to all four square edges. No interface, no buttons, no watermark, no registered trademark symbol, no logo besides the title, no emoji, no photorealism, no smooth glossy 3D, no extra characters.
""".strip()

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}
SSL_CONTEXT = ssl._create_unverified_context()


def generate() -> str:
    payload = json.dumps({"prompt": PROMPT}).encode()
    last_error = None
    for attempt, delay in enumerate((3, 8, 15), start=1):
        try:
            request = urllib.request.Request(ENDPOINT, data=payload, method="POST", headers=HEADERS)
            with urllib.request.urlopen(request, timeout=420, context=SSL_CONTEXT) as response:
                body = json.loads(response.read())
            if not body.get("url"):
                raise RuntimeError(f"missing url: {body}")
            return body["url"]
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(delay)
    raise RuntimeError(str(last_error))


def download(url: str) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=90, context=SSL_CONTEXT) as response:
        OUT.write_bytes(response.read())


def main() -> None:
    url = generate()
    download(url)
    RECORD.write_text(json.dumps({
        "endpoint": ENDPOINT,
        "origin": "https://aigram.app",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_url": url,
        "prompt": PROMPT,
    }, ensure_ascii=False, indent=2) + "\n")
    print(url)
    print(OUT)


if __name__ == "__main__":
    main()
