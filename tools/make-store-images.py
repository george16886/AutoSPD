"""Generate Chrome Web Store images, one set per language.

Traditional Chinese goes in store/, the others in store/<locale>/.

- promo-small.png (440x280): the small promo tile, pixel-art style.
- screenshot-*.png (1280x800): the popup and settings page, rendered with
  headless Chrome from the real extension files and sample data.

Needs Pillow, Google Chrome, and the Windows CJK fonts listed in LOCALES.
Run from the repository root after tools/make-icons.py and tools/make-locales.py:
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
FONTS = r"C:\Windows\Fonts" + "\\"

# Per-language fonts, promo and popup-screenshot copy, and sample data
LOCALES = {
    "zh_TW": {
        "ui": "zh-TW", "bold": "msjhbd.ttc", "regular": "msjh.ttc",
        "promo": ("AI 智慧播放速度", "for YouTube ・ 依影片內容自動調速"),
        "headline": "依影片內容自動調速",
        "points": ["說書、案件解說自動加速", "直播、音樂與 MV 維持 1x", "常看的頻道可直接指定速度", "自動關閉 CC 字幕"],
        "video": ("「再給我一次機會，我還是會殺」！向岳母借40萬後爆發滅門悲劇", "案件 / 調查解說（AI）", "某調查頻道"),
    },
    "en": {
        "ui": "en", "bold": "arialbd.ttf", "regular": "arial.ttf",
        "promo": ("AI playback speed", "for YouTube · Speed set by video content"),
        "headline": "Speed that fits the video",
        "points": ["Talk and true crime speed up", "Live, music and MVs stay at 1x", "Set a speed for your channels", "Turns off CC captions"],
        "video": ("The Seventh Tenant: Inside an Unsolved Disappearance", "True crime / Investigations (AI)", "Sample Channel"),
    },
    "zh_CN": {
        "ui": "zh-CN", "bold": "msyhbd.ttc", "regular": "msyh.ttc",
        "promo": ("AI 智能播放速度", "for YouTube ・ 根据视频内容自动调速"),
        "headline": "根据视频内容自动调速",
        "points": ["说书、案件解说自动加速", "直播、音乐与 MV 保持 1x", "常看的频道可直接指定速度", "自动关闭 CC 字幕"],
        "video": ("消失的第七位房客：一桩悬案的真相", "案件 / 调查解说（AI）", "示例频道"),
    },
    "ja": {
        "ui": "ja", "bold": "YuGothB.ttc", "regular": "YuGothM.ttc",
        "promo": ("AI スマート再生速度", "for YouTube ・ 動画の内容で速度を自動調整"),
        "headline": "動画の内容で速度を自動調整",
        "points": ["解説や朗読は自動で高速に", "ライブ・音楽・MV は 1x のまま", "よく見るチャンネルは速度を指定", "CC 字幕を自動でオフ"],
        "video": ("七人目の住人の失踪：未解決事件の真相", "事件・調査解説（AI）", "サンプルチャンネル"),
    },
    "ko": {
        "ui": "ko", "bold": "malgunbd.ttf", "regular": "malgun.ttf",
        "promo": ("AI 스마트 재생 속도", "for YouTube · 영상 내용에 맞춰 자동 조절"),
        "headline": "영상 내용에 맞춰 자동 조절",
        "points": ["해설·사건 영상은 자동으로 빠르게", "라이브·음악·MV는 1x 유지", "자주 보는 채널은 속도 지정", "CC 자막 자동 끄기"],
        "video": ("일곱 번째 세입자의 실종: 미제 사건의 진실", "사건·탐사 (AI)", "샘플 채널"),
    },
}

BACKDROP = (11, 9, 20)
SCANLINE = (18, 16, 30)
PURPLE = (108, 92, 231)
LAVENDER = (162, 155, 254)
CYAN = (64, 232, 255)
WHITE = (240, 237, 255)


def pixel_text(text, font_path, size, scale, color):
    """Text drawn without anti-aliasing at a small size, then scaled up by a
    whole number so it reads as pixel art."""
    font = ImageFont.truetype(font_path, size)
    left, top, right, bottom = font.getbbox(text)
    # Without anti-aliasing, text can run wider than its measured box
    image = Image.new("RGBA", (right - left + 12, bottom - top + 2), (0, 0, 0, 0))
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


def promo_small(locale):
    FONT_BOLD, FONT = FONTS + locale["bold"], FONTS + locale["regular"]
    width, height = 440, 280
    icon = Image.open(EXTENSION / "icons" / "icon16.png").resize((128, 128), Image.NEAREST)
    title = pixel_text("AutoSPD", FONT_BOLD, 16, 3, WHITE)
    line1 = pixel_text(locale["promo"][0], FONT_BOLD, 12, 2, CYAN)
    # Too small for pixel text: CJK strokes break apart without anti-aliasing
    line2_size = 15
    while ImageFont.truetype(FONT, line2_size).getlength(locale["promo"][1]) > 236:
        line2_size -= 1
    line2 = smooth_text(locale["promo"][1], FONT, line2_size, (200, 196, 230))

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

def stub_script(locale_name, settings, video_state):
    locale = LOCALES[locale_name]
    messages = (EXTENSION / "_locales" / locale_name / "messages.json").read_text(encoding="utf-8")
    return (
        "<script>window.LanguageModel={availability:async()=>'available'};"
        "window.confirm=()=>false;"
        f"const STUB_MESSAGES={messages};"
        "window.chrome={i18n:{"
        f"getUILanguage:()=>'{locale['ui']}',"
        "getMessage:(k,s=[])=>(STUB_MESSAGES[k]?.message||'').replace(/[$]arg(\\d)[$]/g,(_,n)=>s[n-1]??'')},"
        "runtime:{"
        f"sendMessage:async m=>m.type==='get-settings'?{{settings:{json.dumps(settings, ensure_ascii=False)}}}"
        f":{{categories:buildDefaultCategories('{locale['ui']}')}},openOptionsPage(){{}}}},"
        "tabs:{query:async()=>[{id:1,url:'https://www.youtube.com/watch?v=sample'}],"
        f"sendMessage:async()=>({json.dumps(video_state, ensure_ascii=False)})}}}};</script>"
        '<script src="default-categories.js"></script>'
    )


def render_page(workdir, page, stub, size, extra_css=""):
    html = (EXTENSION / page).read_text(encoding="utf-8")
    first_script = '<script src="i18n.js">'
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

def video_state(locale):
    title, category, channel = locale["video"]
    return {
        "videoId": "sample",
        "title": title,
        "categoryName": category,
        "speed": 1.5,
        "mode": "auto",
        "ytCategory": "Entertainment",
        "channelName": channel,
        "aiStatus": "ok",
    }


def screenshot_popup(workdir, locale_name):
    locale = LOCALES[locale_name]
    FONT_BOLD, FONT = FONTS + locale["bold"], FONTS + locale["regular"]
    stub = stub_script(locale_name, {**SETTINGS, "channelRules": []}, video_state(locale))
    popup = render_page(workdir, "popup.html", stub, (340, 784))
    canvas = backdrop(1280, 800)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    headline = pixel_text(locale["headline"], FONT_BOLD, 15, 3, WHITE)
    points = locale["points"]
    x, y = 90, 210
    layer.alpha_composite(headline, (x, y))
    y += headline.height + 40
    bullet = Image.new("RGBA", (10, 10), PURPLE + (255,))
    for point in points:
        line = pixel_text(point, FONT, 13, 2, LAVENDER)
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
        {**SETTINGS, "classifyMode": "youtube"},
        ZOOM + " .mode-section,.channel-section,#youtube-section .hint{display:none}",
    ),
    "screenshot-4-live-and-channels.png": (
        SETTINGS,
        ZOOM + " .mode-section,#keyword-section,#youtube-section{display:none}",
    ),
}


def screenshot_settings(workdir, locale_name, settings, css):
    stub = stub_script(locale_name, settings, video_state(LOCALES[locale_name]))
    return render_page(workdir, "options.html", stub, (1280, 800), css).convert("RGB")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for item in EXTENSION.iterdir():
            if item.is_dir():
                shutil.copytree(item, workdir / item.name)
            else:
                shutil.copy(item, workdir / item.name)
        for locale_name, locale in LOCALES.items():
            folder = STORE if locale_name == "zh_TW" else STORE / locale_name
            folder.mkdir(parents=True, exist_ok=True)
            promo_small(locale).save(folder / "promo-small.png")
            screenshot_popup(workdir, locale_name).save(folder / "screenshot-1-popup.png")
            for name, (settings, css) in SETTINGS_SHOTS.items():
                screenshot_settings(workdir, locale_name, settings, css).save(folder / name)
            print("wrote", folder.relative_to(ROOT))


if __name__ == "__main__":
    main()
