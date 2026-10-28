"""Generate AutoSPD's pixel-art icons.

The icon is drawn on a 16x16 grid and scaled by whole numbers, so every size
stays crisp: Chrome shows the 16px icon in the toolbar and 32/48 in the
extensions page. The 128px icon is the Chrome Web Store icon, which must be
96x96 artwork (16 x 6) with 16px of transparent padding on each side.
assets/logo.png is a larger copy with a soft glow for the README.

Run from the repository root:  python tools/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageFilter

# One character per pixel. '.' is transparent.
# A fast-forward double chevron: violet fading into electric cyan.
GRID = [
    "..BBBBBBBBBBBB..",
    ".BDDDDDDDDDDDDB.",
    "BDDDDDDDDDDDDDDB",
    "BDDDDDDDDDDDDDDB",
    "BDDLLDDDDCCDDDDB",
    "BDDDLLDDDDCCDDDB",
    "BDDDDLLDDDDCCDDB",
    "BDDDDDLLDDDDCCDB",
    "BDDDDDLLDDDDCCDB",
    "BDDDDLLDDDDCCDDB",
    "BDDDLLDDDDCCDDDB",
    "BDDLLDDDDCCDDDDB",
    "BDDDDDDDDDDDDDDB",
    "BDDDDDDDDDDDDDDB",
    ".BDDDDDDDDDDDDB.",
    "..BBBBBBBBBBBB..",
]

PALETTE = {
    ".": (0, 0, 0, 0),
    "B": (108, 92, 231, 255),   # frame: AutoSPD purple (#6c5ce7)
    "D": (16, 14, 32, 255),     # background: near-black navy
    "L": (150, 120, 255, 255),  # first chevron: violet
    "C": (64, 232, 255, 255),   # second chevron: electric cyan
}

ROOT = Path(__file__).resolve().parent.parent


def draw(grid):
    size = len(grid)
    image = Image.new("RGBA", (size, size))
    for y, row in enumerate(grid):
        assert len(row) == size, f"row {y} has {len(row)} pixels"
        for x, char in enumerate(row):
            image.putpixel((x, y), PALETTE[char])
    return image


def make_logo(icon, size=512):
    """README logo: the icon on a dark CRT-style backdrop with a soft glow."""
    pixels = icon.resize((320, 320), Image.NEAREST)
    canvas = Image.new("RGBA", (size, size), (11, 9, 20, 255))
    # Faint scanlines, a shade lighter than the backdrop
    for y in range(0, size, 6):
        for x in range(size):
            canvas.putpixel((x, y), (18, 16, 30, 255))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - 320) // 2,) * 2
    glow.paste(pixels, offset, pixels)
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    canvas = Image.alpha_composite(canvas, glow)
    canvas.alpha_composite(pixels, offset)
    return canvas


def main():
    icon = draw(GRID)
    icons_dir = ROOT / "extension" / "icons"
    icons_dir.mkdir(exist_ok=True)
    for size in (16, 32, 48):
        icon.resize((size, size), Image.NEAREST).save(icons_dir / f"icon{size}.png")
    store_icon = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    store_icon.paste(icon.resize((96, 96), Image.NEAREST), (16, 16))
    store_icon.save(icons_dir / "icon128.png")
    assets_dir = ROOT / "assets"
    assets_dir.mkdir(exist_ok=True)
    make_logo(icon).convert("RGB").save(assets_dir / "logo.png")
    print("wrote", icons_dir, "and", assets_dir / "logo.png")


if __name__ == "__main__":
    main()
