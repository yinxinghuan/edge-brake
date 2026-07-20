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
SSL_CONTEXT = ssl._create_unverified_context()
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}
PROMPT = """
Preserve this exact full-bleed low-poly penguin, ice cliff, moon, ocean, color palette, square composition and the correctly spelled title EDGE BRAKE. Make only one correction: erase the tiny registered trademark R-in-a-circle symbol immediately to the upper right of the title, replacing it seamlessly with the same dark teal sky behind it. There must be absolutely no symbol, mark, dot or character after the final letter E. Do not change the title, penguin, ice, moon, layout or colors. No UI, no border, no watermark, no trademark symbol.
""".strip()


def call(ref_url: str) -> str:
    payload = json.dumps({"prompt": PROMPT, "ref_url": ref_url}).encode()
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


def main() -> None:
    previous = json.loads(RECORD.read_text())
    ref_url = previous["generated_url"]
    url = call(ref_url)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=90, context=SSL_CONTEXT) as response:
        OUT.write_bytes(response.read())
    RECORD.write_text(json.dumps({
        "endpoint": ENDPOINT,
        "origin": "https://aigram.app",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_url": url,
        "ref_url": ref_url,
        "prompt": PROMPT,
    }, ensure_ascii=False, indent=2) + "\n")
    print(url)
    print(OUT)


if __name__ == "__main__":
    main()
