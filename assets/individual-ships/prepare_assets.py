from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
MASTER_DIR = ROOT / "png"
OUT_DIR = ROOT / "grid-ready-128"
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
UNIT = int(MANIFEST["gridUnitPx"])


def alpha_crop(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Image has no visible pixels")
    pad = 4
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(image.width, bbox[2] + pad)
    bottom = min(image.height, bbox[3] + pad)
    return image.crop((left, top, right, bottom))


def fit_to_grid(source: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    margin = max(4, round(min(width, height) * 0.045))
    max_w = width - margin * 2
    max_h = height - margin * 2
    scale = min(max_w / source.width, max_h / source.height)
    resized = source.resize(
        (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = (width - resized.width) // 2
    y = (height - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rendered: list[tuple[dict, Image.Image]] = []
    for ship in MANIFEST["ships"]:
        source_path = MASTER_DIR / ship["file"]
        source = Image.open(source_path).convert("RGBA")
        cropped = alpha_crop(source)
        width = int(ship["gridWidth"]) * UNIT
        height = int(ship["gridHeight"]) * UNIT
        output = fit_to_grid(cropped, width, height)
        output.save(OUT_DIR / ship["file"], optimize=True)
        rendered.append((ship, output))

    preview_width = 1100
    row_height = 190
    preview = Image.new("RGB", (preview_width, row_height * len(rendered)), (8, 15, 24))
    draw = ImageDraw.Draw(preview)
    for index, (ship, asset) in enumerate(rendered):
        y0 = index * row_height
        thumb = asset.copy()
        thumb.thumbnail((820, 150), Image.Resampling.LANCZOS)
        preview.paste(thumb, (260, y0 + (row_height - thumb.height) // 2), thumb)
        label = f'{ship["name"]}  {ship["gridWidth"]}x{ship["gridHeight"]}'
        draw.text((20, y0 + 82), label, fill=(164, 235, 221))
    preview.save(ROOT / "preview-contact-sheet.png", optimize=True)


if __name__ == "__main__":
    main()
