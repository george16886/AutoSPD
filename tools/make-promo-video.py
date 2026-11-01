"""Render the Chrome Web Store promo videos, one per language: Traditional
Chinese in store/promo-video.mp4, the others in store/en, zh_CN, jp and kr.

About 40 seconds, 1920x1080, 30 fps, H.264, no audio track. The Web Store
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
import random
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
        "talk": ("案件解說", "AI 判斷內容，自動 1.5x", "AutoSPD：案件 / 調查解說（AI） · 1.5x"),
        "music": ("音樂 MV", "音樂和直播維持 1x", "AutoSPD：音樂 / MV · 1x"),
        "features": [
            ("三種分類方式", "關鍵字、YouTube 分類、本機 AI"),
            ("每種分類各自設速度", "YouTube 15 種分類都能調"),
            ("直播與音樂維持 1x", "長篇重播自動加速"),
            ("常看的頻道一鍵指定", "在影片頁直接設定"),
        ],
        "privacy": ("資料不離開你的電腦", "不上傳、不追蹤、不記錄觀看紀錄", "AI 在你的電腦上執行"),
        "outro": ("AI 智慧播放速度", "Chrome 線上應用程式商店 免費安裝"),
        "popup_height": 372,
    },
    "en": {
        "tagline": "AI smart playback speed for YouTube",
        "problem": ("Changing speed by hand, every video?", "Faster for talk, normal for music"),
        "talk": ("True crime explained", "AI reads the content: 1.5x", "AutoSPD: True crime / Investigations (AI) · 1.5x"),
        "music": ("Music video", "Music and live stay at 1x", "AutoSPD: Music / MV · 1x"),
        "features": [
            ("Three ways to classify", "Keywords, YouTube categories, on-device AI"),
            ("A speed for every category", "All 15 YouTube categories"),
            ("Live and music stay at 1x", "Long replays speed up"),
            ("One click for your channels", "Set it right on the video page"),
        ],
        "privacy": ("Your data stays on your computer", "No uploads, no tracking, no watch history", "AI runs on your computer"),
        "outro": ("AI smart playback speed", "Free on the Chrome Web Store"),
        "popup_height": 402,
    },
    "zh_CN": {
        "tagline": "AI 智能播放速度 for YouTube",
        "problem": ("每个视频都要手动切速度？", "说书想快一点，听歌要正常速度"),
        "talk": ("案件解说", "AI 判断内容，自动 1.5x", "AutoSPD：案件 / 调查解说（AI） · 1.5x"),
        "music": ("音乐 MV", "音乐和直播保持 1x", "AutoSPD：音乐 / MV · 1x"),
        "features": [
            ("三种分类方式", "关键词、YouTube 分类、本地 AI"),
            ("每种分类各自设速度", "YouTube 15 种分类都能调"),
            ("直播与音乐保持 1x", "长篇回放自动加速"),
            ("常看的频道一键指定", "在视频页直接设置"),
        ],
        "privacy": ("数据不离开你的电脑", "不上传、不跟踪、不记录观看记录", "AI 在你的电脑上运行"),
        "outro": ("AI 智能播放速度", "Chrome 应用商店 免费安装"),
        "popup_height": 372,
    },
    "ja": {
        "tagline": "YouTube 向け AI スマート再生速度",
        "problem": ("動画のたびに手動で速度を変更？", "解説は速く、音楽は普通の速度で"),
        "talk": ("事件解説", "AI が内容を判定して自動で 1.5x", "AutoSPD：事件・調査解説（AI） · 1.5x"),
        "music": ("音楽 MV", "音楽とライブは 1x のまま", "AutoSPD：音楽 / MV · 1x"),
        "features": [
            ("3 つの分類方法", "キーワード、YouTube カテゴリ、端末内 AI"),
            ("カテゴリごとに速度を設定", "YouTube の全 15 カテゴリに対応"),
            ("ライブと音楽は 1x のまま", "長いアーカイブは自動で高速化"),
            ("よく見るチャンネルを指定", "動画ページからすぐ設定"),
        ],
        "privacy": ("データはパソコンの外に出ません", "アップロードなし、追跡なし、視聴履歴なし", "AI はパソコン上で動作"),
        "outro": ("AI スマート再生速度", "Chrome ウェブストアから無料で追加"),
        "popup_height": 388,
    },
    "ko": {
        "tagline": "YouTube용 AI 스마트 재생 속도",
        "problem": ("영상마다 직접 속도를 바꾸시나요?", "해설은 빠르게, 음악은 보통 속도로"),
        "talk": ("사건 해설", "AI가 내용을 판단해 자동 1.5x", "AutoSPD: 사건·탐사 (AI) · 1.5x"),
        "music": ("음악 MV", "음악과 라이브는 1x 유지", "AutoSPD: 음악 / MV · 1x"),
        "features": [
            ("세 가지 분류 방식", "키워드, YouTube 카테고리, 기기 내 AI"),
            ("카테고리별 속도 설정", "YouTube 15개 카테고리 모두 지원"),
            ("라이브와 음악은 1x 유지", "긴 다시보기는 자동으로 빠르게"),
            ("자주 보는 채널 바로 지정", "영상 페이지에서 바로 설정"),
        ],
        "privacy": ("데이터는 컴퓨터 밖으로 나가지 않습니다", "업로드 없음, 추적 없음, 시청 기록 없음", "AI는 컴퓨터에서 실행"),
        "outro": ("AI 스마트 재생 속도", "Chrome 웹 스토어에서 무료 설치"),
        "popup_height": 372,
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
random.seed(7)
STARS = [(random.random(), random.random(), random.choice((5, 7, 9)), random.random()) for _ in range(70)]


def draw_player(frame, *, palette, speed, clock, progress, toast=None, toast_alpha=0.0):
    """A made-up video player. Pixel stars drift left at the playback speed."""
    top, bottom = palette
    player = Image.new("RGBA", (PLAYER_W, PLAYER_H))
    draw = ImageDraw.Draw(player)
    for y in range(0, PLAYER_H, 4):
        k = y / PLAYER_H
        color = tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)) + (255,)
        draw.rectangle([0, y, PLAYER_W, y + 4], fill=color)
    for sx, sy, size, depth in STARS:
        x = (sx * PLAYER_W - clock * 150 * (0.5 + depth)) % PLAYER_W
        shade = int(120 + 120 * depth)
        draw.rectangle([x, sy * (PLAYER_H - 110), x + size, sy * (PLAYER_H - 110) + size],
                       fill=(shade, shade, 255, 255))

    # Controls on their own layer: drawing translucent fills straight onto the
    # player would replace its pixels instead of blending with them
    controls = Image.new("RGBA", (PLAYER_W, PLAYER_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(controls)
    draw.rectangle([0, PLAYER_H - 84, PLAYER_W, PLAYER_H], fill=(0, 0, 0, 165))
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

TALK_PALETTE = ((40, 52, 70), (16, 20, 30))
MUSIC_PALETTE = ((70, 40, 90), (24, 14, 40))


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
    draw_player(frame, palette=TALK_PALETTE, speed=1, clock=t, progress=0.08 + t * 0.004)
    center(frame, text(TEXT["problem"][1], CAPTION, SOFT), 860, ramp(t, 1.0, 0.5))
    return frame


DEMO_SWITCH = 5.5  # seconds into the demo when the second video starts


def scene_demo(t):
    frame = background().copy()
    if t < DEMO_SWITCH:
        speed = 1 + 0.5 * ramp(t, 1.2, 0.8)
        clock = 3.5 + t + 0.5 * max(0.0, t - 1.6)  # the video clock runs faster at 1.5x
        draw_player(frame, palette=TALK_PALETTE, speed=round(speed * 4) / 4, clock=clock,
                    progress=0.1 + t * 0.012 * speed, toast=TEXT["talk"][2],
                    toast_alpha=ramp(t, 1.0, 0.3) * (1 - ramp(t, 4.8, 0.4)))
        heading, caption, alpha = TEXT["talk"][0], TEXT["talk"][1], ramp(t, 1.4, 0.5)
    else:
        local = t - DEMO_SWITCH
        draw_player(frame, palette=MUSIC_PALETTE, speed=1, clock=local, progress=0.02 + local * 0.01,
                    toast=TEXT["music"][2], toast_alpha=ramp(local, 0.5, 0.3) * (1 - ramp(local, 4.6, 0.4)))
        heading, caption, alpha = TEXT["music"][0], TEXT["music"][1], ramp(local, 0.8, 0.5)
    center(frame, text(heading, HEADING), 24)
    center(frame, text(caption, CAPTION, CYAN), 860, alpha)
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
                    store_images.ZOOM + " .mode-section,.channel-section,#youtube-section .hint{display:none}"),
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
    (scene_demo, 11.0),
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
    lines = [(TEXT["problem"][0], HEADING), (TEXT["problem"][1], CAPTION), (TEXT["talk"][0], HEADING), (TEXT["talk"][1], CAPTION),
             (TEXT["music"][0], HEADING), (TEXT["music"][1], CAPTION), (TEXT["privacy"][0], 80), (TEXT["privacy"][1], CAPTION),
             (TEXT["privacy"][2], CAPTION), (TEXT["tagline"], CAPTION), (TEXT["outro"][0], 64), (TEXT["outro"][1], CAPTION)]
    lines += [(title, HEADING) for title, _ in TEXT["features"]] + [(line, 46) for _, line in TEXT["features"]]
    for content, size in lines:
        assert text(content, size).width <= W - 80, (locale, content)
    assert text(TEXT["talk"][2], 40).width + 52 + 30 <= PLAYER_W, (locale, "toast")


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
