"""Render the Chrome Web Store promo videos, one per language: Traditional
Chinese in store/promo-video.mp4, the others in store/en, zh_CN, jp and kr.

About 43 seconds, 1920x1080, 30 fps, H.264, no audio track. The Web Store
takes a YouTube link, so upload the file to YouTube (unlisted is fine) and
paste its URL into the listing.

Written to survive small playback and YouTube's compression: large smooth
text, one short line per screen, a flat background, and pages rendered at 1.5x.
The player in the demo is a generic, made-up one: no YouTube logo or
interface, and fictional video titles.

Needs Pillow, PyAV (pip install av), Google Chrome and the Windows CJK fonts
listed in make-store-images.py. Run from the repository root:
    python tools/make-promo-video.py [locale ...]
"""

import importlib.util
import shutil
import sys
import tempfile
from functools import lru_cache
from pathlib import Path

import av
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "extension"
STORE = ROOT / "store"

W, H, FPS = 1920, 1080, 30

BACKGROUND = (13, 11, 24)
PURPLE = (108, 92, 231)
CYAN = (64, 232, 255)
WHITE = (245, 243, 255)
SOFT = (214, 210, 238)

# Sizes: readable when the video plays in the store's small frame
HEADING = 72
CAPTION = 52

# All on-screen text. Keep lines short: one heading and one line per screen.
COPY = {
    "zh_TW": {
        "tagline": "AI 智慧播放速度 for YouTube",
        "problem": ("每支影片都要手動切速度？", "說書想快一點，聽歌要正常速度"),
        "news": ("看新聞", "談話內容，自動 1.5x", "AutoSPD：新聞時事 · 1.5x"),
        "music": ("聽音樂", "節奏不走樣，維持 1x", "AutoSPD：音樂 / MV · 1x"),
        "travel": ("看旅遊影片", "風景照看，自動 1.25x", "AutoSPD：旅遊 Vlog · 1.25x"),
        "features": [
            ("三種分類方式", "關鍵字、YouTube 分類、本機 AI"),
            ("每種分類各自設速度", "YouTube 15 種分類都能調"),
            ("直播與音樂維持 1x", "長篇重播自動加速"),
            ("常看的頻道一鍵指定", "在影片頁直接設定"),
        ],
        "privacy": ("資料不離開你的電腦", "不上傳、不追蹤、不記錄觀看紀錄", "AI 在你的電腦上執行"),
        "outro": ("AI 智慧播放速度", "Chrome 線上應用程式商店 免費安裝"),
        "popup_height": 548,
    },
    "en": {
        "tagline": "AI smart playback speed for YouTube",
        "problem": ("Changing speed by hand, every video?", "Faster for talk, normal for music"),
        "news": ("Watching the news", "Mostly talk: automatically 1.5x", "AutoSPD: News · 1.5x"),
        "music": ("Listening to music", "Keeps the beat: stays at 1x", "AutoSPD: Music / MV · 1x"),
        "travel": ("Travel videos", "Still see the views: automatically 1.25x", "AutoSPD: Travel / Vlogs · 1.25x"),
        "features": [
            ("Three ways to classify", "Keywords, YouTube categories, on-device AI"),
            ("A speed for every category", "All 15 YouTube categories"),
            ("Live and music stay at 1x", "Long replays speed up"),
            ("One click for your channels", "Set it right on the video page"),
        ],
        "privacy": ("Your data stays on your computer", "No uploads, no tracking, no watch history", "AI runs on your computer"),
        "outro": ("AI smart playback speed", "Free on the Chrome Web Store"),
        "popup_height": 594,
    },
    "zh_CN": {
        "tagline": "AI 智能播放速度 for YouTube",
        "problem": ("每个视频都要手动切速度？", "说书想快一点，听歌要正常速度"),
        "news": ("看新闻", "谈话内容，自动 1.5x", "AutoSPD：新闻时事 · 1.5x"),
        "music": ("听音乐", "节奏不走样，保持 1x", "AutoSPD：音乐 / MV · 1x"),
        "travel": ("看旅游视频", "风景照看，自动 1.25x", "AutoSPD：旅游 Vlog · 1.25x"),
        "features": [
            ("三种分类方式", "关键词、YouTube 分类、本地 AI"),
            ("每种分类各自设速度", "YouTube 15 种分类都能调"),
            ("直播与音乐保持 1x", "长篇回放自动加速"),
            ("常看的频道一键指定", "在视频页直接设置"),
        ],
        "privacy": ("数据不离开你的电脑", "不上传、不跟踪、不记录观看记录", "AI 在你的电脑上运行"),
        "outro": ("AI 智能播放速度", "Chrome 应用商店 免费安装"),
        "popup_height": 548,
    },
    "ja": {
        "tagline": "YouTube 向け AI スマート再生速度",
        "problem": ("動画のたびに手動で速度を変更？", "解説は速く、音楽は普通の速度で"),
        "news": ("ニュースを見る", "トーク中心なので自動で 1.5x", "AutoSPD：ニュース · 1.5x"),
        "music": ("音楽を聴く", "リズムはそのまま 1x", "AutoSPD：音楽 / MV · 1x"),
        "travel": ("旅行動画を見る", "景色も楽しめる 1.25x", "AutoSPD：旅行・Vlog · 1.25x"),
        "features": [
            ("3 つの分類方法", "キーワード、YouTube カテゴリ、端末内 AI"),
            ("カテゴリごとに速度を設定", "YouTube の全 15 カテゴリに対応"),
            ("ライブと音楽は 1x のまま", "長いアーカイブは自動で高速化"),
            ("よく見るチャンネルを指定", "動画ページからすぐ設定"),
        ],
        "privacy": ("データはパソコンの外に出ません", "アップロードなし、追跡なし、視聴履歴なし", "AI はパソコン上で動作"),
        "outro": ("AI スマート再生速度", "Chrome ウェブストアから無料で追加"),
        "popup_height": 567,
    },
    "ko": {
        "tagline": "YouTube용 AI 스마트 재생 속도",
        "problem": ("영상마다 직접 속도를 바꾸시나요?", "해설은 빠르게, 음악은 보통 속도로"),
        "news": ("뉴스 볼 때", "말 위주라 자동 1.5x", "AutoSPD: 뉴스 · 1.5x"),
        "music": ("음악 들을 때", "박자 그대로 1x 유지", "AutoSPD: 음악 / MV · 1x"),
        "travel": ("여행 영상 볼 때", "풍경도 즐기는 자동 1.25x", "AutoSPD: 여행·브이로그 · 1.25x"),
        "features": [
            ("세 가지 분류 방식", "키워드, YouTube 카테고리, 기기 내 AI"),
            ("카테고리별 속도 설정", "YouTube 15개 카테고리 모두 지원"),
            ("라이브와 음악은 1x 유지", "긴 다시보기는 자동으로 빠르게"),
            ("자주 보는 채널 바로 지정", "영상 페이지에서 바로 설정"),
        ],
        "privacy": ("데이터는 컴퓨터 밖으로 나가지 않습니다", "업로드 없음, 추적 없음, 시청 기록 없음", "AI는 컴퓨터에서 실행"),
        "outro": ("AI 스마트 재생 속도", "Chrome 웹 스토어에서 무료 설치"),
        "popup_height": 548,
    },
}

# The language being rendered
LOCALE = "zh_TW"
FONT_BOLD = FONT = ""
TEXT = COPY[LOCALE]

_spec = importlib.util.spec_from_file_location("store_images", ROOT / "tools" / "make-store-images.py")
store_images = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(store_images)


# --- drawing helpers -------------------------------------------------------

def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


def ramp(t, start, length):
    """0 before start, 1 after start + length, eased in between."""
    return ease_out((t - start) / length)


@lru_cache(maxsize=None)
def text(content, size, color=WHITE, bold=True):
    font = ImageFont.truetype(FONT_BOLD if bold else FONT, size)
    left, top, right, bottom = font.getbbox(content)
    image = Image.new("RGBA", (right - left + 8, bottom - top + 8), (0, 0, 0, 0))
    ImageDraw.Draw(image).text((4 - left, 4 - top), content, font=font, fill=color + (255,))
    return image


@lru_cache(maxsize=None)
def background():
    return Image.new("RGBA", (W, H), BACKGROUND + (255,))


@lru_cache(maxsize=None)
def icon(size):
    return Image.open(EXTENSION / "icons" / "icon16.png").convert("RGBA").resize((size, size), Image.NEAREST)


@lru_cache(maxsize=None)
def glowing_icon(size):
    logo = icon(size)
    margin = 40
    layer = Image.new("RGBA", (size + margin * 2, size + margin * 2), (0, 0, 0, 0))
    layer.paste(logo, (margin, margin), logo)
    return Image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(18)), layer)


def faded(image, alpha):
    if alpha >= 1:
        return image
    out = image.copy()
    out.putalpha(out.getchannel("A").point(lambda a: int(a * max(alpha, 0))))
    return out


def center(frame, image, y, alpha=1.0, dy=0):
    if alpha <= 0:
        return
    frame.alpha_composite(faded(image, alpha), ((W - image.width) // 2, int(y + dy * (1 - alpha))))


# --- the generic player used in the demo -----------------------------------

PLAYER_W, PLAYER_H = 1200, 675
PLAYER_X, PLAYER_Y = (W - PLAYER_W) // 2, 130

# Scenes are drawn on a small canvas and scaled up by a whole number, so they
# read as pixel art. Everything moves with the video's own clock: at 1.5x the
# legs and the background really do go 1.5 times as fast.
PIXEL = 6
SCENE_W, SCENE_H = PLAYER_W // PIXEL, PLAYER_H // PIXEL + 1
GROUND = 84
SCROLL = 58  # scene pixels per second at 1x
STRIDES = 8  # sprite frames per second at 1x

RUNNER_TOP = [
    "....HHHHHH....",
    "...HHHHHHHH...",
    "...HHSSSSSS...",
    "...HSSSSKSS...",
    "...HSSSSSSS...",
    "....SSSSSS....",
    ".....TTTT.....",
]
RUNNER_FRAMES = [
    # Stride: arms and legs apart
    [
        "....TTTTTT....",
        "..SSTTTTTTSS..",
        ".SS.TTTTTT.SS.",
        ".S..TTTTTT..S.",
        "....NNNNNN....",
        "...NNNNNNNN...",
        "..NNN...NNN...",
        ".NNN.....NNN..",
        "NNN.......NNN.",
        "WW.........WWW",
    ],
    # Passing: back leg comes through
    [
        "....TTTTTT....",
        "....TTTTSS....",
        "....TTTTTSS...",
        "....TTTTTT....",
        "....NNNNNN....",
        "....NNNNNN....",
        ".....NNNNN....",
        ".....NN.NNN...",
        "....NNN..NN...",
        "....WWW..WWW..",
    ],
    # Stride, other side
    [
        "....TTTTTT....",
        "...STTTTTTSS..",
        "..SSTTTTTT.SS.",
        "..S.TTTTTT....",
        "....NNNNNN....",
        "...NNNNNNNN...",
        "...NNN..NNN...",
        "..NNN....NNN..",
        ".NNN......NNN.",
        ".WW........WWW",
    ],
    # In the air
    [
        "....TTTTTT....",
        "....STTTTTS...",
        "...SSTTTTSS...",
        "....TTTTTT....",
        "....NNNNNN....",
        "...NNNNNNN....",
        "...NNN.NNNN...",
        "..NNN....NN...",
        "..WW.....WWW..",
        "..............",
    ],
]
RUNNER_COLORS = {
    ".": (0, 0, 0, 0), "H": (52, 36, 30, 255), "S": (245, 200, 160, 255), "K": (30, 24, 40, 255),
    "T": (64, 232, 255, 255), "N": (58, 52, 120, 255), "W": (245, 243, 255, 255),
    "G": (255, 90, 170, 255),  # headphones
}
# Band over the hair and a cup over the ear
HEADPHONES = {(5, 0), (6, 0), (7, 0), (8, 0), (4, 0), (4, 1), (4, 2), (4, 3), (5, 3), (4, 4), (5, 4)}


@lru_cache(maxsize=None)
def runner(frame, headphones):
    rows = RUNNER_TOP + RUNNER_FRAMES[frame]
    sprite = Image.new("RGBA", (14, len(rows)))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            sprite.putpixel((x, y), RUNNER_COLORS[ch])
    if headphones:
        for x, y in HEADPHONES:
            sprite.putpixel((x, y), RUNNER_COLORS["G"])
    return sprite.resize((sprite.width * 2, sprite.height * 2), Image.NEAREST)


PIXEL_FONT = {
    "N": ["1001", "1101", "1011", "1001", "1001"], "E": ["111", "100", "110", "100", "111"],
    "W": ["10001", "10001", "10101", "10101", "01010"], "S": ["111", "100", "111", "001", "111"],
    "L": ["100", "100", "100", "100", "111"], "I": ["111", "010", "010", "010", "111"],
    "V": ["10001", "10001", "01010", "01010", "00100"],
}


def pixel_word(draw, x, y, word, color):
    for ch in word:
        for dy, row in enumerate(PIXEL_FONT[ch]):
            for dx, bit in enumerate(row):
                if bit == "1":
                    draw.point((x + dx, y + dy), fill=color)
        x += len(PIXEL_FONT[ch][0]) + 1


def wrapped(pos, distance, period):
    """Left edges of a pattern scrolling left, covering the scene."""
    start = -((distance % period))
    return [start + i * period for i in range(SCENE_W // period + 2)]


def road(draw, distance, base, dash):
    draw.rectangle([0, GROUND, SCENE_W, SCENE_H], fill=base)
    for x in wrapped(0, distance, 28):
        draw.rectangle([x, GROUND + 5, x + 13, GROUND + 6], fill=dash)


def scene_city(draw, clock):
    distance = clock * SCROLL
    draw.rectangle([0, 0, SCENE_W, GROUND], fill=(36, 34, 72))
    draw.rectangle([0, 56, SCENE_W, GROUND], fill=(66, 52, 96))
    heights = [34, 22, 44, 28, 38, 18, 30]
    for i, x in enumerate(wrapped(0, distance * 0.3, 20)):
        index = int((distance * 0.3) // 20 + i) % len(heights)
        h = heights[index]
        draw.rectangle([x, GROUND - h, x + 17, GROUND], fill=(24, 24, 52))
        for wy in range(GROUND - h + 3, GROUND - 3, 6):
            for wx in (x + 3, x + 10):
                if (index + wy + wx // 7) % 3:
                    draw.rectangle([wx, wy, wx + 2, wy + 2], fill=(250, 214, 110))
    road(draw, distance, (40, 40, 56), (230, 228, 240))


def scene_news(draw, clock):
    distance = clock * SCROLL
    draw.rectangle([0, 0, SCENE_W, GROUND], fill=(16, 40, 86))
    # Studio screens slide past
    for x in wrapped(0, distance * 0.35, 46):
        draw.rectangle([x, 18, x + 38, 58], fill=(10, 26, 58))
        draw.rectangle([x + 2, 20, x + 36, 56], fill=(30, 84, 150))
        draw.ellipse([x + 9, 25, x + 29, 45], fill=(70, 150, 214))
        draw.rectangle([x + 12, 30, x + 19, 36], fill=(120, 200, 140))
        draw.rectangle([x + 21, 34, x + 26, 41], fill=(120, 200, 140))
        draw.rectangle([x + 4, 49, x + 34, 53], fill=(214, 40, 60))
    draw.rectangle([0, 62, SCENE_W, GROUND], fill=(24, 54, 108))
    draw.rectangle([0, GROUND, SCENE_W, SCENE_H], fill=(214, 30, 54))
    # Live sign, fixed to the screen like a broadcast's
    draw.rectangle([SCENE_W - 26, 4, SCENE_W - 4, 12], fill=(214, 30, 54))
    pixel_word(draw, SCENE_W - 24, 6, "LIVE", (255, 255, 255))
    # Ticker: lines of "text" running past, under a NEWS tag
    draw.rectangle([0, GROUND + 3, SCENE_W, GROUND + 9], fill=(245, 243, 255))
    lengths = [14, 8, 19, 6, 11, 16]
    for i, x in enumerate(wrapped(0, distance * 1.2, 22)):
        length = lengths[int((distance * 1.2) // 22 + i) % len(lengths)]
        draw.rectangle([x, GROUND + 5, x + min(length, 18), GROUND + 7], fill=(30, 30, 50))
    draw.rectangle([0, GROUND + 1, 23, GROUND + 11], fill=(120, 16, 36))
    pixel_word(draw, 3, GROUND + 4, "NEWS", (255, 255, 255))


def scene_music(draw, clock):
    distance = clock * SCROLL
    draw.rectangle([0, 0, SCENE_W, GROUND], fill=(34, 14, 62))
    # Equalizer bouncing to the beat
    for i in range(0, SCENE_W, 8):
        level = abs(((clock * 2.2 + i * 0.137) % 2) - 1)
        level = 0.25 + 0.75 * level * abs(((i * 0.61) % 1) - 0.3)
        h = int(10 + 52 * level)
        for y in range(GROUND - h, GROUND, 4):
            shade = (GROUND - y) / 62
            color = (int(120 + 135 * shade), int(70 + 20 * shade), int(230 - 60 * shade))
            draw.rectangle([i + 1, y, i + 5, y + 2], fill=color)
    # Notes drifting past
    for i, x in enumerate(wrapped(0, distance * 0.7, 50)):
        y = 14 + (int((distance * 0.7) // 50 + i) * 11) % 24
        draw.rectangle([x, y + 7, x + 3, y + 9], fill=(245, 243, 255))
        draw.rectangle([x + 3, y, x + 3, y + 8], fill=(245, 243, 255))
        draw.rectangle([x + 3, y, x + 7, y + 1], fill=(245, 243, 255))
    road(draw, distance, (28, 16, 50), (255, 90, 170))


def scene_travel(draw, clock):
    distance = clock * SCROLL
    draw.rectangle([0, 0, SCENE_W, 34], fill=(120, 200, 245))
    draw.rectangle([0, 34, SCENE_W, GROUND], fill=(176, 226, 248))
    draw.ellipse([SCENE_W - 46, 16, SCENE_W - 28, 34], fill=(255, 228, 120))
    for i, x in enumerate(wrapped(0, distance * 0.08, 70)):
        y = 22 + (int((distance * 0.08) // 70 + i) * 7) % 12
        draw.rectangle([x, y + 2, x + 18, y + 5], fill=(255, 255, 255))
        draw.rectangle([x + 4, y, x + 13, y + 2], fill=(255, 255, 255))
    # Far peaks with snow, nearer hills, then trees going by quickly
    for x in wrapped(0, distance * 0.15, 66):
        draw.polygon([(x, 72), (x + 33, 30), (x + 66, 72)], fill=(96, 122, 170))
        draw.polygon([(x + 25, 40), (x + 33, 30), (x + 41, 40)], fill=(245, 248, 255))
    for x in wrapped(0, distance * 0.35, 48):
        draw.polygon([(x, 78), (x + 24, 50), (x + 48, 78)], fill=(82, 160, 104))
    draw.rectangle([0, 72, SCENE_W, GROUND], fill=(96, 180, 96))
    for x in wrapped(0, distance, 37):
        draw.rectangle([x + 5, 74, x + 7, GROUND], fill=(102, 66, 40))
        draw.polygon([(x, 76), (x + 6, 60), (x + 12, 76)], fill=(36, 120, 70))
    draw.rectangle([0, GROUND, SCENE_W, SCENE_H], fill=(214, 178, 124))
    for x in wrapped(0, distance, 28):
        draw.rectangle([x, GROUND + 5, x + 7, GROUND + 6], fill=(182, 146, 98))


SCENES_ART = {"city": scene_city, "news": scene_news, "music": scene_music, "travel": scene_travel}


def draw_scene(name, clock):
    canvas = Image.new("RGBA", (SCENE_W, SCENE_H), (0, 0, 0, 255))
    SCENES_ART[name](ImageDraw.Draw(canvas), clock)
    sprite = runner(int(clock * STRIDES) % len(RUNNER_FRAMES), name == "music")
    bob = 1 if int(clock * STRIDES) % 2 else 0
    canvas.alpha_composite(sprite, (SCENE_W // 2 - sprite.width // 2, GROUND + 2 - sprite.height - bob))
    return canvas.resize((SCENE_W * PIXEL, SCENE_H * PIXEL), Image.NEAREST).crop((0, 0, PLAYER_W, PLAYER_H))


def draw_player(frame, *, scene, speed, clock, progress, toast=None, toast_alpha=0.0):
    """A made-up video player showing a pixel runner in the given scene."""
    player = draw_scene(scene, clock)

    # Controls on their own layer: drawing translucent fills straight onto the
    # player would replace its pixels instead of blending with them
    controls = Image.new("RGBA", (PLAYER_W, PLAYER_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(controls)
    draw.rectangle([0, PLAYER_H - 84, PLAYER_W, PLAYER_H], fill=(0, 0, 0, 190))
    bar_y = PLAYER_H - 72
    draw.rectangle([28, bar_y, PLAYER_W - 28, bar_y + 8], fill=(255, 255, 255, 70))
    draw.rectangle([28, bar_y, 28 + (PLAYER_W - 56) * progress, bar_y + 8], fill=CYAN + (255,))
    draw.polygon([(34, PLAYER_H - 50), (34, PLAYER_H - 18), (60, PLAYER_H - 34)], fill=WHITE + (255,))
    badge = text(f"{speed:g}x", 40)
    bx = PLAYER_W - badge.width - 44
    draw.rounded_rectangle([bx - 18, PLAYER_H - 56, bx + badge.width + 18, PLAYER_H - 10], 10,
                           fill=PURPLE + (255,) if speed != 1 else (70, 66, 100, 255))
    controls.alpha_composite(badge, (bx, PLAYER_H - 56 + (46 - badge.height) // 2))
    player.alpha_composite(controls)

    # AutoSPD toast, styled like the real one, top-left over the video
    if toast and toast_alpha > 0:
        label = text(toast, 40, (255, 255, 255), bold=True)
        box = Image.new("RGBA", (label.width + 52, label.height + 34), (0, 0, 0, 0))
        ImageDraw.Draw(box).rounded_rectangle([0, 0, box.width - 1, box.height - 1], 14,
                                              fill=(20, 20, 28, 245), outline=(255, 255, 255, 50))
        box.alpha_composite(label, (26, 17))
        player.alpha_composite(faded(box, toast_alpha), (30, 30 - int(12 * (1 - toast_alpha))))

    frame.paste(Image.new("RGBA", (PLAYER_W + 12, PLAYER_H + 12), PURPLE + (255,)), (PLAYER_X - 6, PLAYER_Y - 6))
    frame.alpha_composite(player, (PLAYER_X, PLAYER_Y))


# --- scenes: each takes the time since the scene started -------------------

def scene_intro(t):
    frame = background().copy()
    grow = ramp(t, 0.1, 0.8)
    size = 16 * max(2, round(19 * grow))  # whole-number pixel scale keeps the icon crisp
    logo = glowing_icon(size)
    frame.alpha_composite(logo, ((W - logo.width) // 2, 400 - logo.height // 2))
    center(frame, text("AutoSPD", 120), 640, ramp(t, 0.9, 0.6), dy=20)
    center(frame, text(TEXT["tagline"], CAPTION, CYAN), 800, ramp(t, 1.4, 0.6), dy=20)
    return frame


def scene_problem(t):
    frame = background().copy()
    center(frame, text(TEXT["problem"][0], HEADING), 24, ramp(t, 0.0, 0.5))
    draw_player(frame, scene="city", speed=1, clock=t, progress=0.08 + t * 0.01)
    center(frame, text(TEXT["problem"][1], CAPTION, SOFT), 860, ramp(t, 1.0, 0.5))
    return frame


CLIP_SECONDS = 4.5
# (copy key, scene art, speed the extension picks). Each clip starts at 1x, then
# the toast appears and the speed changes, as it does on a real video.
CLIPS = [("news", "news", 1.5), ("music", "music", 1.0), ("travel", "travel", 1.25)]
SPEED_CHANGE_AT = 0.9


def scene_demo(t):
    frame = background().copy()
    index = min(int(t // CLIP_SECONDS), len(CLIPS) - 1)
    local = t - index * CLIP_SECONDS
    key, art, target = CLIPS[index]
    speed = target if local >= SPEED_CHANGE_AT else 1.0
    # The video's clock runs at the playback speed once it changes
    clock = local + (target - 1) * max(0.0, local - SPEED_CHANGE_AT)
    draw_player(frame, scene=art, speed=speed, clock=clock, progress=0.05 + clock * 0.03,
                toast=TEXT[key][2], toast_alpha=ramp(local, SPEED_CHANGE_AT - 0.1, 0.25) * (1 - ramp(local, CLIP_SECONDS - 0.4, 0.3)))
    heading, caption = TEXT[key][0], TEXT[key][1]
    center(frame, text(heading, HEADING), 24)
    center(frame, text(caption, CAPTION, CYAN), 860, ramp(local, SPEED_CHANGE_AT, 0.4))
    return frame


FEATURE_SECONDS = 3.5
FEATURE_SHOTS = ("ai", "youtube", "live", "popup")
SHOT_TOP = 196
SHOT_HEIGHT = 860
_shots = {}


def load_shots():
    """Render the real pages at 1.5x (popup at 2x) so text stays sharp at this size."""
    locale_name = LOCALE
    state = store_images.video_state(store_images.LOCALES[locale_name])
    settings = store_images.SETTINGS
    shots = {
        "ai": ({**settings, "classifyMode": "ai"}, store_images.ZOOM + " #keyword-section,#youtube-section,.channel-section{display:none}"),
        "youtube": ({**settings, "classifyMode": "youtube"},
                    store_images.ZOOM + " .mode-section,.channel-section,#youtube-section .hint,.default-speed-row{display:none}"),
        "live": (settings, store_images.ZOOM + " .mode-section,#keyword-section,#youtube-section{display:none}"),
    }
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for item in EXTENSION.iterdir():
            if item.is_dir():
                shutil.copytree(item, workdir / item.name)
            else:
                shutil.copy(item, workdir / item.name)
        for key, (page_settings, css) in shots.items():
            stub = store_images.stub_script(locale_name, page_settings, state)
            page = store_images.render_page(workdir, "options.html", stub, (1280, 800), css, scale=1.5)
            _shots[key] = framed(page.resize((1376, SHOT_HEIGHT), Image.LANCZOS))
        stub = store_images.stub_script(locale_name, {**settings, "channelRules": []}, state)
        popup = store_images.render_page(workdir, "popup.html", stub, (340, TEXT["popup_height"]), scale=2)
        _shots["popup"] = framed(popup.resize((popup.width * SHOT_HEIGHT // popup.height, SHOT_HEIGHT), Image.LANCZOS))


def framed(image):
    out = Image.new("RGBA", (image.width + 8, image.height + 8), PURPLE + (255,))
    out.alpha_composite(image.convert("RGBA"), (4, 4))
    return out


def scene_features(t):
    frame = background().copy()
    index = min(int(t // FEATURE_SECONDS), len(FEATURE_SHOTS) - 1)
    local = t - index * FEATURE_SECONDS
    title, line = TEXT["features"][index]
    shot = FEATURE_SHOTS[index]
    alpha = ramp(local, 0.0, 0.35) * (1 - (ramp(local, FEATURE_SECONDS - 0.25, 0.25) if index < len(FEATURE_SHOTS) - 1 else 0))
    center(frame, text(title, HEADING), 14, alpha)
    center(frame, text(line, 46, CYAN), 112, alpha)
    center(frame, _shots[shot], SHOT_TOP, alpha, dy=24)
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
    colors = {".": (0, 0, 0, 0), "X": (150, 120, 255, 255), "C": CYAN + (255,), "D": BACKGROUND + (255,)}
    image = Image.new("RGBA", (len(LOCK[0]), len(LOCK)))
    for y, row in enumerate(LOCK):
        for x, ch in enumerate(row):
            image.putpixel((x, y), colors[ch])
    return image.resize((image.width * scale, image.height * scale), Image.NEAREST)


def scene_privacy(t):
    frame = background().copy()
    center(frame, lock_icon(16), 170, ramp(t, 0.0, 0.5))
    center(frame, text(TEXT["privacy"][0], 80), 420, ramp(t, 0.3, 0.5), dy=20)
    center(frame, text(TEXT["privacy"][1], CAPTION, CYAN), 600, ramp(t, 0.9, 0.5), dy=20)
    center(frame, text(TEXT["privacy"][2], CAPTION, SOFT), 700, ramp(t, 1.4, 0.5), dy=20)
    return frame


def scene_outro(t):
    frame = background().copy()
    logo = glowing_icon(256)
    frame.alpha_composite(faded(logo, ramp(t, 0.0, 0.5)), ((W - logo.width) // 2, 120))
    center(frame, text("AutoSPD for YouTube", 104), 480, ramp(t, 0.2, 0.5), dy=20)
    center(frame, text(TEXT["outro"][0], 64, CYAN), 640, ramp(t, 0.4, 0.5), dy=20)
    center(frame, text(TEXT["outro"][1], CAPTION, SOFT), 800, ramp(t, 0.8, 0.5), dy=20)
    return frame


SCENES = [
    (scene_intro, 3.5),
    (scene_problem, 4.0),
    (scene_demo, CLIP_SECONDS * len(CLIPS)),
    (scene_features, FEATURE_SECONDS * len(FEATURE_SHOTS)),
    (scene_privacy, 4.0),
    (scene_outro, 4.0),
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


def use_locale(locale):
    """Switch fonts, copy and page captures to a language, and check its text fits."""
    global LOCALE, TEXT, FONT_BOLD, FONT
    LOCALE, TEXT = locale, COPY[locale]
    fonts = store_images.LOCALES[locale]
    FONT_BOLD = store_images.FONTS + fonts["bold"]
    FONT = store_images.FONTS + fonts["regular"]
    text.cache_clear()
    load_shots()
    lines = [(TEXT["problem"][0], HEADING), (TEXT["problem"][1], CAPTION), (TEXT["news"][0], HEADING), (TEXT["news"][1], CAPTION), (TEXT["travel"][0], HEADING), (TEXT["travel"][1], CAPTION),
             (TEXT["music"][0], HEADING), (TEXT["music"][1], CAPTION), (TEXT["privacy"][0], 80), (TEXT["privacy"][1], CAPTION),
             (TEXT["privacy"][2], CAPTION), (TEXT["tagline"], CAPTION), (TEXT["outro"][0], 64), (TEXT["outro"][1], CAPTION)]
    lines += [(title, HEADING) for title, _ in TEXT["features"]] + [(line, 46) for _, line in TEXT["features"]]
    for content, size in lines:
        assert text(content, size).width <= W - 80, (locale, content)
    for clip in ("news", "music", "travel"):
        assert text(TEXT[clip][2], 40).width + 52 + 30 <= PLAYER_W, (locale, clip)


def render_video(locale):
    use_locale(locale)
    total = sum(length for _, length in SCENES)
    folder = store_images.store_folder(locale)
    folder.mkdir(parents=True, exist_ok=True)
    out_path = folder / "promo-video.mp4"
    container = av.open(str(out_path), "w")
    stream = container.add_stream("libx264", rate=FPS)
    stream.width, stream.height, stream.pix_fmt = W, H, "yuv420p"
    # High quality, so YouTube's re-encode starts from a clean source
    stream.options = {"crf": "14", "preset": "slow"}
    frames = int(total * FPS)
    for index in range(frames):
        image = frame_at(index / FPS)
        for packet in stream.encode(av.VideoFrame.from_image(image)):
            container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    print(f"wrote {out_path.relative_to(ROOT)} ({total:.1f}s, {out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    for name in sys.argv[1:] or COPY:
        render_video(name)
