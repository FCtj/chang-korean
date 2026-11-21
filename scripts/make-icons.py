"""앱 아이콘·스플래시 임시 생성기 (코끼리 이모지 + 잎사귀 초록 배경)
정식 출시 전에는 디자이너가 만든 아이콘으로 교체하세요.
실행: python3 scripts/make-icons.py   (Pillow, NotoColorEmoji 폰트 필요)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
GREEN = (46, 125, 79, 255)
GOLD = (242, 165, 22, 255)
LIGHT = (242, 247, 243, 255)


def elephant(size: int) -> Image.Image:
    font = ImageFont.truetype(EMOJI_FONT, 109)  # 컬러 이모지 폰트는 109px 고정
    tile = Image.new("RGBA", (136, 128), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((0, 0), "🐘", font=font, embedded_color=True)
    tile = tile.crop(tile.getbbox())
    return tile.resize((size, int(size * tile.height / tile.width)), Image.LANCZOS)


def badge_icon(px: int, round_mask: bool = False) -> Image.Image:
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_mask:
        d.ellipse((0, 0, px - 1, px - 1), fill=GREEN)
    else:
        d.rounded_rectangle((0, 0, px - 1, px - 1), radius=int(px * 0.22), fill=GREEN)
    d.ellipse((px * 0.16, px * 0.66, px * 0.84, px * 0.86), fill=(0, 0, 0, 40))  # 그림자
    e = elephant(int(px * 0.68))
    img.alpha_composite(e, ((px - e.width) // 2, int(px * 0.5 - e.height * 0.55)))
    return img


def foreground(px: int) -> Image.Image:
    # 적응형 아이콘: 108dp 캔버스 중 가운데 66dp가 안전 영역
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    e = elephant(int(px * 0.5))
    img.alpha_composite(e, ((px - e.width) // 2, (px - e.height) // 2))
    return img


DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in DENSITIES.items():
    folder = RES / f"mipmap-{name}"
    badge_icon(int(48 * k)).save(folder / "ic_launcher.png")
    badge_icon(int(48 * k), round_mask=True).save(folder / "ic_launcher_round.png")
    foreground(int(108 * k)).save(folder / "ic_launcher_foreground.png")

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2E7D4F</color>\n</resources>\n'
)

for splash in RES.glob("drawable*/splash.png"):
    w, h = Image.open(splash).size
    img = Image.new("RGBA", (w, h), LIGHT)
    e = elephant(int(min(w, h) * 0.32))
    img.alpha_composite(e, ((w - e.width) // 2, (h - e.height) // 2))
    img.convert("RGB").save(splash)

store = ROOT / "store"
store.mkdir(exist_ok=True)
badge_icon(512).save(store / "icon-512.png")
print("✓ 아이콘·스플래시 생성 완료")
