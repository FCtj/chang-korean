"""앱 아이콘·스플래시 생성기 (분홍 아기 코끼리 마스코트)
원본: store/mascot.svg → store/mascot-1024.png (투명 배경 PNG로 미리 렌더링해 둠)
실행: python3 scripts/make-icons.py   (Pillow 필요)
정식 출시 전에는 디자이너가 다듬은 아이콘으로 바꿔도 됩니다.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
MASCOT = Image.open(ROOT / "store/mascot-1024.png").convert("RGBA")
MASCOT = MASCOT.crop(MASCOT.getbbox())
BG = (238, 232, 255, 255)  # 연보라 (분홍 코끼리가 잘 보이게)
DOT = (221, 210, 255, 255)
SPLASH_BG = (255, 244, 247, 255)


def mascot(width: int) -> Image.Image:
    return MASCOT.resize((width, int(width * MASCOT.height / MASCOT.width)), Image.LANCZOS)


def dotted_bg(px: int) -> Image.Image:
    img = Image.new("RGBA", (px, px), BG)
    d = ImageDraw.Draw(img)
    step = max(6, px // 9)
    r = max(1, px // 70)
    for y in range(step // 2, px, step):
        for x in range(step // 2 + (step // 2 if (y // step) % 2 else 0), px, step):
            d.ellipse((x - r, y - r, x + r, y + r), fill=DOT)
    return img


def legacy_icon(px: int, round_mask: bool = False) -> Image.Image:
    base = dotted_bg(px)
    m = mascot(int(px * 0.78))
    base.alpha_composite(m, ((px - m.width) // 2, (px - m.height) // 2 + px // 40))
    mask = Image.new("L", (px, px), 0)
    md = ImageDraw.Draw(mask)
    if round_mask:
        md.ellipse((0, 0, px - 1, px - 1), fill=255)
    else:
        md.rounded_rectangle((0, 0, px - 1, px - 1), radius=int(px * 0.22), fill=255)
    out = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def foreground(px: int) -> Image.Image:
    # 적응형 아이콘: 108dp 캔버스 중 가운데 66dp가 안전 영역
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    m = mascot(int(px * 0.6))
    img.alpha_composite(m, ((px - m.width) // 2, (px - m.height) // 2))
    return img


DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in DENSITIES.items():
    folder = RES / f"mipmap-{name}"
    legacy_icon(int(48 * k)).save(folder / "ic_launcher.png")
    legacy_icon(int(48 * k), round_mask=True).save(folder / "ic_launcher_round.png")
    foreground(int(108 * k)).save(folder / "ic_launcher_foreground.png")

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#EEE8FF</color>\n</resources>\n'
)

for splash in RES.glob("drawable*/splash.png"):
    w, h = Image.open(splash).size
    img = Image.new("RGBA", (w, h), SPLASH_BG)
    m = mascot(int(min(w, h) * 0.36))
    img.alpha_composite(m, ((w - m.width) // 2, (h - m.height) // 2))
    img.convert("RGB").save(splash)

legacy_icon(512).save(ROOT / "store/icon-512.png")
print("✓ 아이콘·스플래시 생성 완료")
