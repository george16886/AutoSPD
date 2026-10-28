"""Generate Chrome Web Store images into store/.

- promo-small.png (440x280): the small promo tile, pixel-art style.
- screenshot-*.png (1280x800): the popup and settings page, rendered with
  headless Chrome from the real extension files and sample data.

Needs Pillow, Google Chrome, and the Microsoft JhengHei font (Windows).
Run from the repository root after tools/make-icons.py:
    python tools/make-store-images.py
"""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "extension"
STORE = ROOT / "store"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
FONT_BOLD = r"C:\Windows\Fonts\msjhbd.ttc"
FONT = r"C:\Windows\Fonts\msjh.ttc"

BACKDROP = (11, 9, 20)
SCANLINE = (18, 16, 30)
PURPLE = (108, 92, 231)
LAVENDER = (162, 155, 254)
WHITE = (240, 237, 255)


def pixel_text(text, font_path, size, scale, color):
    """Text drawn without anti-aliasing at a small size, then scaled up by a
    whole number so it reads as pixel art."""
    font = ImageFont.truetype(font_path, size)
    left, top, right, bottom = font.getbbox(text)
    image = Image.new("RGBA", (right - left + 2, bottom - top + 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.fontmode = "1"
    draw.text((1 - left, 1 - top), text, font=font, fill=color + (255,))
    return image.resize((image.width * scale, image.height * scale), Image.NEAREST)


def smooth_text(text, font_path, size, color):
    font = ImageFont.truetype(font_path, size)
    left, top, right, bottom = font.getbbox(text)
    image = Image.new("RGBA", (right - left + 2, bottom - top + 2), (0, 0, 0, 0))
    ImageDraw.Draw(image).text((1 - left, 1 - top), text, font=font, fill=color + (255,))
    return image


def backdrop(width, height):
    canvas = Image.new("RGBA", (width, height), BACKDROP + (255,))
    draw = ImageDraw.Draw(canvas)
    for y in range(0, height, 6):
        draw.line([(0, y), (width, y)], fill=SCANLINE + (255,))
    return canvas


def with_glow(canvas, layer, radius):
    glow = layer.filter(ImageFilter.GaussianBlur(radius))
    canvas = Image.alpha_composite(canvas, glow)
    return Image.alpha_composite(canvas, layer)


def promo_small():
    width, height = 440, 280
    icon = Image.open(EXTENSION / "icons" / "icon16.png").resize((128, 128), Image.NEAREST)
    title = pixel_text("AutoSPD", FONT_BOLD, 16, 3, WHITE)
    line1 = pixel_text("YouTube 智慧調速", FONT_BOLD, 12, 2, LAVENDER)
    # Too small for pixel text: CJK strokes break apart without anti-aliasing
    line2 = smooth_text("依影片內容自動調整播放速度", FONT, 15, (200, 196, 230))

    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    icon_x, icon_y = 32, (height - 128) // 2
    layer.alpha_composite(icon, (icon_x, icon_y))
    text_x = icon_x + 128 + 28
    block = title.height + 14 + line1.height + 12 + line2.height
    y = (height - block) // 2
    layer.alpha_composite(title, (text_x, y))
    y += title.height + 14
    layer.alpha_composite(line1, (text_x, y))
    y += line1.height + 12
    layer.alpha_composite(line2, (text_x, y))
    return with_glow(backdrop(width, height), layer, 10).convert("RGB")


# --- Screenshots: real extension pages with a stubbed chrome.* API ---

def default_categories():
    source = (EXTENSION / "background.js").read_text(encoding="utf-8")
    start = source.index("const DEFAULT_CATEGORIES = ") + len("const DEFAULT_CATEGORIES = ")
    end = source.index("\n];", start) + 2
    return source[start:end]


def stub_script(settings, video_state):
    return (
        "<script>window.LanguageModel={availability:async()=>'available'};"
        "window.confirm=()=>false;window.chrome={runtime:{"
        f"sendMessage:async m=>m.type==='get-settings'?{{settings:{json.dumps(settings, ensure_ascii=False)}}}"
        f":{{categories:{default_categories()}}},openOptionsPage(){{}}}},"
        "tabs:{query:async()=>[{id:1,url:'https://www.youtube.com/watch?v=sample'}],"
        f"sendMessage:async()=>({json.dumps(video_state, ensure_ascii=False)})}}}};</script>"
    )


def render_page(workdir, page, script_name, stub, size, extra_css=""):
    html = (EXTENSION / page).read_text(encoding="utf-8")
    first_script = f'<script src="{script_name}">'
    html = html.replace(first_script, stub + first_script, 1)
    if extra_css:
        html = html.replace("</head>", f"<style>{extra_css}</style></head>", 1)
    target = workdir / f"render-{page}"
    target.write_text(html, encoding="utf-8")
    shot = workdir / f"{page}.png"
    subprocess.run([
        str(CHROME), "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--window-size={size[0]},{size[1]}", "--virtual-time-budget=3000",
        f"--screenshot={shot}", target.as_uri()
    ], check=True, capture_output=True)
    return Image.open(shot).convert("RGBA")


SETTINGS = {
    "classifyMode": "ai",
    "channelRules": [{"channel": "Wayne調查", "speed": 1.5}, {"channel": "澤北SG", "speed": 1.75}],
    "fixedNormalForLive": True,
    "fixedNormalForMusic": True,
    "liveReplayEnabled": True,
    "liveReplaySpeed": 1.5,
    "autoSpeed": True,
    "hideCaptions": True,
    "notifications": True,
    "defaultSpeed": 1,
}

VIDEO_STATE = {
    "videoId": "sample",
    "title": "「再給我一次機會，我還是會殺」！向岳母借40萬後爆發滅門悲劇",
    "categoryName": "案件 / 調查解說（AI）",
    "speed": 1.5,
    "mode": "auto",
    "ytCategory": "Entertainment",
    "channelName": "某調查頻道",
    "aiStatus": "ok",
}


def screenshot_popup(workdir):
    popup = render_page(workdir, "popup.html", "popup.js",
                        stub_script({**SETTINGS, "channelRules": []}, VIDEO_STATE), (340, 760))
    canvas = backdrop(1280, 800)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    headline = pixel_text("依影片內容自動調速", FONT_BOLD, 16, 3, WHITE)
    points = [
        "說書、案件解說自動加速",
        "直播、音樂與 MV 維持 1x",
        "常看的頻道可直接指定速度",
        "自動關閉 CC 字幕",
    ]
    x, y = 110, 210
    layer.alpha_composite(headline, (x, y))
    y += headline.height + 40
    bullet = Image.new("RGBA", (10, 10), PURPLE + (255,))
    for point in points:
        line = pixel_text(point, FONT, 14, 2, LAVENDER)
        layer.alpha_composite(bullet, (x, y + (line.height - 10) // 2))
        layer.alpha_composite(line, (x + 26, y))
        y += line.height + 22
    canvas = with_glow(canvas, layer, 8)
    frame = Image.new("RGBA", (popup.width + 8, popup.height + 8), PURPLE + (255,))
    frame.alpha_composite(popup, (4, 4))
    canvas.alpha_composite(frame, (1280 - frame.width - 120, (800 - frame.height) // 2))
    return canvas.convert("RGB")


# Each settings screenshot shows one part of the page, zoomed so the 760px-wide
# layout fills 1280px
ZOOM = "body{zoom:1.45}"
SETTINGS_SHOTS = {
    "screenshot-2-ai-mode.png": ({**SETTINGS, "classifyMode": "ai"}, ZOOM),
    "screenshot-3-youtube-mode.png": (
        {**SETTINGS, "classifyMode": "youtube", "ytCategorySpeeds": {"24": 1.5, "22": 1.5}},
        ZOOM + " .mode-section,.channel-section{display:none}",
    ),
    "screenshot-4-live-and-channels.png": (
        SETTINGS,
        ZOOM + " .mode-section,#keyword-section,#youtube-section{display:none}",
    ),
}


def screenshot_settings(workdir, settings, css):
    return render_page(workdir, "options.html", "yt-categories.js",
                       stub_script(settings, VIDEO_STATE), (1280, 800), css).convert("RGB")


def main():
    STORE.mkdir(exist_ok=True)
    promo_small().save(STORE / "promo-small.png")

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for item in EXTENSION.iterdir():
            if item.is_dir():
                shutil.copytree(item, workdir / item.name)
            else:
                shutil.copy(item, workdir / item.name)
        screenshot_popup(workdir).save(STORE / "screenshot-1-popup.png")
        for name, (settings, css) in SETTINGS_SHOTS.items():
            screenshot_settings(workdir, settings, css).save(STORE / name)
    print("wrote", sorted(p.name for p in STORE.iterdir()))


if __name__ == "__main__":
    main()
