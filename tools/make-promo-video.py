"""Render the Chrome Web Store promo video: store/promo-video.mp4.

About 32 seconds, 1920x1080, 30 fps, H.264, no audio track. The Web Store
takes a YouTube link, so upload the file to YouTube (unlisted is fine) and
paste its URL into the listing.

The player in the demo is a generic, made-up one: no YouTube logo or
interface, and fictional video titles.

Needs Pillow, PyAV (pip install av) and the Microsoft JhengHei font. Run
from the repository root after tools/make-store-images.py:
    python tools/make-promo-video.py
"""

import math
import random
from functools import lru_cache
from pathlib import Path

import av
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "store"
ICONS = ROOT / "extension" / "icons"
FONT_BOLD = r"C:\Windows\Fonts\msjhbd.ttc"
FONT = r"C:\Windows\Fonts\msjh.ttc"

W, H, FPS = 1920, 1080, 30

BACKDROP = (11, 9, 20)
SCANLINE = (18, 16, 30)
PURPLE = (108, 92, 231)
VIOLET = (150, 120, 255)
LAVENDER = (200, 196, 230)
CYAN = (64, 232, 255)
WHITE = (240, 237, 255)
MUTED = (140, 136, 170)


# --- drawing helpers -------------------------------------------------------

def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


def ramp(t, start, length):
    """0 before start, 1 after start + length, eased in between."""
    return ease_out((t - start) / length)


@lru_cache(maxsize=None)
def pixel_text(text, size, scale, color, bold=True):
    """Text drawn without anti-aliasing, then scaled up by a whole number."""
    font = ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    left, top, right, bottom = font.getbbox(text)
    image = Image.new("RGBA", (right - left + 2, bottom - top + 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.fontmode = "1"
    draw.text((1 - left, 1 - top), text, font=font, fill=color + (255,))
    return image.resize((image.width * scale, image.height * scale), Image.NEAREST)


@lru_cache(maxsize=None)
def smooth_text(text, size, color, bold=False):
    font = ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    left, top, right, bottom = font.getbbox(text)
    image = Image.new("RGBA", (right - left + 4, bottom - top + 4), (0, 0, 0, 0))
    ImageDraw.Draw(image).text((2 - left, 2 - top), text, font=font, fill=color + (255,))
    return image


@lru_cache(maxsize=None)
def backdrop():
    canvas = Image.new("RGBA", (W, H), BACKDROP + (255,))
    draw = ImageDraw.Draw(canvas)
    for y in range(0, H, 6):
        draw.line([(0, y), (W, y)], fill=SCANLINE + (255,))
    return canvas


@lru_cache(maxsize=None)
def icon(size):
    return Image.open(ICONS / "icon16.png").convert("RGBA").resize((size, size), Image.NEAREST)


def glow(layer, radius=14):
    """The layer over a blurred copy of itself."""
    return Image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius)), layer)


def faded(image, alpha):
    if alpha >= 1:
        return image
    out = image.copy()
    out.putalpha(out.getchannel("A").point(lambda a: int(a * max(alpha, 0))))
    return out


def paste_center_x(frame, image, y, alpha=1.0, dx=0):
    frame.alpha_composite(faded(image, alpha), ((W - image.width) // 2 + int(dx), int(y)))


def bullet_line(text, size=30):
    line = smooth_text(text, size, LAVENDER)
    row = Image.new("RGBA", (line.width + 34, max(line.height, 14)), (0, 0, 0, 0))
    row.paste(Image.new("RGBA", (12, 12), CYAN + (255,)), (0, (row.height - 12) // 2))
    row.alpha_composite(line, (34, (row.height - line.height) // 2))
    return row


# --- the generic player used in the demo -----------------------------------

PLAYER_X, PLAYER_Y, PLAYER_W, PLAYER_H = 360, 190, 1200, 675
random.seed(7)
STARS = [(random.random(), random.random(), random.choice((4, 6, 8)), random.random()) for _ in range(90)]


def draw_player(frame, *, palette, speed, clock, progress, title, toast=None, toast_alpha=0.0):
    """A made-up video player. Pixel stars drift left at the playback speed."""
    top, bottom = palette
    player = Image.new("RGBA", (PLAYER_W, PLAYER_H))
    draw = ImageDraw.Draw(player)
    for y in range(0, PLAYER_H, 4):
        k = y / PLAYER_H
        color = tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)) + (255,)
        draw.rectangle([0, y, PLAYER_W, y + 4], fill=color)
    for sx, sy, size, depth in STARS:
        x = (sx * PLAYER_W - clock * 140 * (0.5 + depth)) % PLAYER_W
        shade = int(120 + 120 * depth)
        draw.rectangle([x, sy * (PLAYER_H - 90), x + size, sy * (PLAYER_H - 90) + size],
                       fill=(shade, shade, 255, 255))

    # Controls on their own layer: drawing translucent fills straight onto the
    # player would replace its pixels instead of blending with them
    controls = Image.new("RGBA", (PLAYER_W, PLAYER_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(controls)
    draw.rectangle([0, PLAYER_H - 64, PLAYER_W, PLAYER_H], fill=(0, 0, 0, 150))
    bar_y = PLAYER_H - 52
    draw.rectangle([24, bar_y, PLAYER_W - 24, bar_y + 6], fill=(255, 255, 255, 70))
    draw.rectangle([24, bar_y, 24 + (PLAYER_W - 48) * progress, bar_y + 6], fill=CYAN + (255,))
    draw.polygon([(30, PLAYER_H - 34), (30, PLAYER_H - 14), (46, PLAYER_H - 24)], fill=WHITE + (255,))
    badge = smooth_text(f"{speed:g}x", 26, WHITE, bold=True)
    bx = PLAYER_W - badge.width - 40
    draw.rounded_rectangle([bx - 14, PLAYER_H - 42, bx + badge.width + 14, PLAYER_H - 8], 8,
                           fill=PURPLE + (255,) if speed != 1 else (60, 56, 90, 255))
    controls.alpha_composite(badge, (bx, PLAYER_H - 42 + (34 - badge.height) // 2))
    player.alpha_composite(controls)

    # AutoSPD toast, styled like the real one, top-left over the video
    if toast and toast_alpha > 0:
        text = smooth_text(toast, 28, (255, 255, 255))
        box = Image.new("RGBA", (text.width + 40, text.height + 26), (0, 0, 0, 0))
        ImageDraw.Draw(box).rounded_rectangle([0, 0, box.width - 1, box.height - 1], 12,
                                              fill=(24, 24, 32, 240), outline=(255, 255, 255, 36))
        box.alpha_composite(text, (20, 13))
        player.alpha_composite(faded(box, toast_alpha), (28, 28 - int(10 * (1 - toast_alpha))))

    frame.paste(Image.new("RGBA", (PLAYER_W + 12, PLAYER_H + 12), PURPLE + (255,)), (PLAYER_X - 6, PLAYER_Y - 6))
    frame.alpha_composite(player, (PLAYER_X, PLAYER_Y))
    title_image = smooth_text(title, 32, WHITE, bold=True)
    frame.alpha_composite(title_image, (PLAYER_X, PLAYER_Y + PLAYER_H + 22))


# --- scenes: each takes the time since the scene started -------------------

def scene_intro(t):
    frame = backdrop().copy()
    grow = ramp(t, 0.1, 0.9)
    size = max(16, int(16 * round(2 + 18 * grow)))  # whole-number pixel scale
    logo = glow(icon(size), 18)
    frame.alpha_composite(logo, ((W - logo.width) // 2, 330 - logo.height // 2 + 60))
    title = glow(pixel_text("AutoSPD", 20, 6, WHITE), 10)
    paste_center_x(frame, title, 640, ramp(t, 1.0, 0.6), dx=0)
    subtitle = pixel_text("AI 智慧播放速度 for YouTube", 14, 3, CYAN)
    paste_center_x(frame, subtitle, 800, ramp(t, 1.5, 0.6))
    return frame


def scene_problem(t):
    frame = backdrop().copy()
    heading = glow(pixel_text("每支影片都要手動切換速度？", 16, 4, WHITE), 8)
    paste_center_x(frame, heading, 70, ramp(t, 0.0, 0.5))
    draw_player(frame, palette=((40, 52, 70), (16, 20, 30)), speed=1, clock=t, progress=0.08 + t * 0.004,
                title="深夜懸案：消失的第七位房客｜案件解說")
    note = smooth_text("說書、案件解說想開快一點，聽歌、看直播又要切回正常速度……", 30, LAVENDER)
    paste_center_x(frame, note, 960, ramp(t, 1.0, 0.6))
    return frame


DEMO_SWITCH = 5.0  # seconds into the demo when the second video starts


def scene_demo(t):
    frame = backdrop().copy()
    if t < DEMO_SWITCH:
        speed_mix = ramp(t, 1.2, 0.8)
        speed = 1 + 0.5 * speed_mix
        # The video clock runs faster once the speed changes
        clock = 3.5 + t + 0.5 * max(0.0, t - 1.6)
        draw_player(frame, palette=((40, 52, 70), (16, 20, 30)), speed=round(speed * 4) / 4,
                    clock=clock, progress=0.1 + t * 0.012 * speed, title="深夜懸案：消失的第七位房客｜案件解說",
                    toast="AutoSPD：案件 / 調查解說（AI） · 1.5x",
                    toast_alpha=ramp(t, 1.0, 0.3) * (1 - ramp(t, 4.2, 0.4)))
        caption = "AI 讀懂影片在講什麼，不被聳動標題誤導 → 自動 1.5x"
        alpha = ramp(t, 1.4, 0.5)
    else:
        local = t - DEMO_SWITCH
        draw_player(frame, palette=((70, 40, 90), (24, 14, 40)), speed=1, clock=local,
                    progress=0.02 + local * 0.01, title="星空下（Official MV）",
                    toast="AutoSPD：音樂 / MV · 1x",
                    toast_alpha=ramp(local, 0.5, 0.3) * (1 - ramp(local, 4.2, 0.4)))
        caption = "音樂、MV 與直播自動維持 1x，不必再切回來"
        alpha = ramp(local, 0.8, 0.5)
    heading = glow(pixel_text("換影片，速度自動到位", 16, 4, WHITE), 8)
    paste_center_x(frame, heading, 70)
    paste_center_x(frame, smooth_text(caption, 32, CYAN, bold=True), 960, alpha)
    return frame


FEATURES = [
    ("三種分類方式", ["關鍵字規則", "YouTube 官方分類", "本機 AI 內容分析"], "screenshot-2-ai-mode.png"),
    ("每種分類各自設速度", ["15 種 YouTube 分類", "說書、教學可以快，", "體育、音樂維持 1x"], "screenshot-3-youtube-mode.png"),
    ("直播與音樂", ["直播、MV 固定 1x", "長篇直播重播自動加速", "常看的頻道直接指定速度"], "screenshot-4-live-and-channels.png"),
    ("在影片頁一鍵設定", ["頻道規則、手動調速", "自動關閉 CC 字幕", "與播放器速度選單同步"], "screenshot-1-popup.png"),
]
FEATURE_SECONDS = 2.0


# The popup screenshot has its own headline on the left; use only the popup
POPUP_CROP = (816, 20, 1156, 780)


@lru_cache(maxsize=None)
def feature_assets(index):
    title, points, shot = FEATURES[index]
    image = Image.open(STORE / shot).convert("RGBA")
    if shot == "screenshot-1-popup.png":
        image = image.crop(POPUP_CROP)
        image = image.resize((image.width * 650 // image.height, 650), Image.LANCZOS)
    else:
        image = image.resize((1040, 650), Image.LANCZOS)
    framed = Image.new("RGBA", (image.width + 12, image.height + 12), PURPLE + (255,))
    framed.alpha_composite(image, (6, 6))
    text = Image.new("RGBA", (640, 650), (0, 0, 0, 0))
    heading = glow(pixel_text(title, 16, 3, WHITE), 6)
    text.alpha_composite(heading, (0, 150))
    y = 150 + heading.height + 50
    for point in points:
        row = bullet_line(point, 34)
        text.alpha_composite(row, (0, y))
        y += row.height + 26
    return text, framed


def scene_features(t):
    frame = backdrop().copy()
    index = min(int(t // FEATURE_SECONDS), len(FEATURES) - 1)
    local = t - index * FEATURE_SECONDS
    text, shot = feature_assets(index)
    enter = ramp(local, 0.0, 0.45)
    leave = ramp(local, FEATURE_SECONDS - 0.3, 0.3) if index < len(FEATURES) - 1 else 0
    alpha = enter * (1 - leave)
    frame.alpha_composite(faded(text, alpha), (130 - int(40 * (1 - enter)), 200))
    shot_x = 770 + (1052 - shot.width) // 2  # center narrower shots in the same column
    frame.alpha_composite(faded(shot, alpha), (shot_x + int(120 * (1 - enter)), 215))
    # Step dots
    for i in range(len(FEATURES)):
        color = CYAN if i == index else (60, 56, 90)
        frame.paste(Image.new("RGBA", (14, 14), color + (255,)), (W // 2 - 50 + i * 28, 980))
    return frame


LOCK = [
    "....XXXX....",
    "...X....X...",
    "..X......X..",
    "..X......X..",
    "..X......X..",
    ".XXXXXXXXXX.",
    ".XCCCCCCCCX.",
    ".XCCCDDCCCX.",
    ".XCCCDDCCCX.",
    ".XCCCCDCCCX.",
    ".XCCCCCCCCX.",
    ".XXXXXXXXXX.",
]


@lru_cache(maxsize=None)
def lock_icon(scale):
    colors = {".": (0, 0, 0, 0), "X": VIOLET + (255,), "C": CYAN + (255,), "D": BACKDROP + (255,)}
    image = Image.new("RGBA", (len(LOCK[0]), len(LOCK)))
    for y, row in enumerate(LOCK):
        for x, ch in enumerate(row):
            image.putpixel((x, y), colors[ch])
    return image.resize((image.width * scale, image.height * scale), Image.NEAREST)


def scene_privacy(t):
    frame = backdrop().copy()
    paste_center_x(frame, glow(lock_icon(14), 16), 150, ramp(t, 0.0, 0.5))
    paste_center_x(frame, glow(pixel_text("資料不離開你的電腦", 16, 4, WHITE), 8), 400, ramp(t, 0.3, 0.5))
    rows = [bullet_line(point, 36) for point in ["不傳送任何資料、沒有追蹤或廣告", "不記錄觀看紀錄", "AI 分析在你的電腦上完成"]]
    left = (W - max(row.width for row in rows)) // 2
    for i, row in enumerate(rows):
        frame.alpha_composite(faded(row, ramp(t, 0.8 + i * 0.25, 0.5)), (left, 580 + i * 80))
    return frame


def scene_outro(t):
    frame = backdrop().copy()
    logo = glow(icon(256), 18)
    paste_center_x(frame, logo, 190, ramp(t, 0.0, 0.5))
    paste_center_x(frame, glow(pixel_text("AutoSPD for YouTube", 16, 5, WHITE), 10), 520, ramp(t, 0.2, 0.5))
    paste_center_x(frame, pixel_text("AI 智慧播放速度", 14, 4, CYAN), 660, ramp(t, 0.4, 0.5))
    paste_center_x(frame, smooth_text("Chrome 線上應用程式商店 ・ 免費安裝", 36, LAVENDER), 820, ramp(t, 0.8, 0.5))
    return frame


SCENES = [
    (scene_intro, 3.5),
    (scene_problem, 3.5),
    (scene_demo, 10.0),
    (scene_features, FEATURE_SECONDS * len(FEATURES)),
    (scene_privacy, 3.5),
    (scene_outro, 3.5),
]
FADE = 0.3


def frame_at(seconds):
    start = 0.0
    for render, length in SCENES:
        if seconds < start + length or render is SCENES[-1][0]:
            local = seconds - start
            frame = render(local)
            # Fade through black between scenes (and in at the very start)
            edge = min(local, length - local) if render is not SCENES[-1][0] else local
            if edge < FADE:
                black = Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - edge / FADE))))
                frame = Image.alpha_composite(frame, black)
            return frame.convert("RGB")
        start += length
    raise ValueError(seconds)


def main():
    total = sum(length for _, length in SCENES)
    out_path = STORE / "promo-video.mp4"
    container = av.open(str(out_path), "w")
    stream = container.add_stream("libx264", rate=FPS)
    stream.width, stream.height, stream.pix_fmt = W, H, "yuv420p"
    stream.options = {"crf": "18", "preset": "medium"}
    frames = int(total * FPS)
    for index in range(frames):
        image = frame_at(index / FPS)
        for packet in stream.encode(av.VideoFrame.from_image(image)):
            container.mux(packet)
        if index % (FPS * 4) == 0:
            print(f"  {index / FPS:4.1f}s / {total:.1f}s")
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    print(f"wrote {out_path.relative_to(ROOT)} ({total:.1f}s, {out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
