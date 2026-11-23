# Emoji 14+ (2021~, 안드로이드 13 · iOS 15.4 미만에서 빈 네모) 그림을 오래된 폰에서도 보이는 그림으로 바꿈
# 사용: python3 emoji-compat.py [--write]
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import glob, re, sys

ROOT = ROOT + '/src/data'
NEW = set('🫠🫢🫣🫡🫥🫤🥹🫱🫲🫳🫴🫰🫵🫶🪸🪷🪹🪺🫘🫗🫙🛝🛞🛟🪬🪩🪫🩼🩻🫧🪪🟰🫨🩷🩵🩶🫏🪿🫎🪼🪽🪮🪭🫚🫛🪯🛜🪇🪈🫩🫆🪾🫜🪉🪏🫟🔞')

# 그림별 기본 대체
DEFAULT = {
    '🪪': '🆔', '🫥': '👻', '🟰': '⚖️', '🛟': '🆘', '🪫': '📉', '🫡': '🙇', '🫶': '🤗', '🫴': '🤲',
    '🫙': '🏺', '🫧': '🧼', '🛞': '🚗', '🫗': '💦', '🥹': '🥺', '🩻': '🩺', '🩼': '🤕', '🫘': '🥜',
    '🪷': '🌸', '🫚': '🌳', '🪺': '🐣', '🫳': '👇', '🫵': '👉', '🫣': '🙈', '🫤': '😕', '🫨': '🏚️',
    '🪽': '🕊️', '🩵': '🌫️', '🫱': '👉', '🫲': '👈', '🛝': '🎢', '🫛': '🥗', '🪸': '🐠', '🫰': '📸',
    '🔞': '🧑', '🪹': '🐦', '🩷': '💗', '🩶': '🩶', '🪩': '🎉', '🪬': '🧿', '🫠': '😵', '🫢': '🤭', '🪏': '⛏️', '🪭': '🪭',
}
# 단어별로 더 맞는 그림
BY_TERM = {
    # 🪪 신분증류는 🆔 · 그 밖
    '교통카드': '💳', '멤버십 카드': '💳', 'membership': '💳', '会員': '🧑‍🤝‍🧑', '회원': '💳', 'badge': '📛',
    'holder': '🙋', 'profile': '👤', 'last name': '🔤', '姓': '🔤', '姓名': '🔤', '見せる': '👀', '～員': '👥',
    '関係者': '👥', '証明': '📜', '免許': '🚗', 'license': '🚗', "driver\\'s license": '🚗', '정체성': '👤',
    # 🟰 같음 · 즉
    'as': '👉', 'つまり': '💡', 'すなわち': '💡', '同然': '👯', '同様': '👯', '同一': '👯',
    # 🛟 구조 · 도움
    'swimming pool': '🏊', '튜빙': '🌊', 'lifeguard': '⛑️', 'サポート': '🤝', 'help': '🙋', '助ける': '🙋',
    # 🪫 부족 · 약함
    'dead': '💀', 'weak': '🥀', 'weakness': '🥀', 'useless': '🗑️',
    # 🫡 경례
    '경례': '💂', 'commit': '💪', 'acknowledge': '👍', '任せる': '🤝', '命じる': '📢', '真面目': '🧑‍💼',
    # 🫶
    'dedication': '💝', '為': '💝',
    # 🫙 병
    '醤油': '🍶', '酢': '🍶', 'なにも': '🚫', '溜まる': '💧',
    # 🫧 거품
    'soda': '🥤', '妄想': '💭', '浮かび上がる': '🎈', '清む': '💧', '膜': '🔬', 'うがい': '💦',
    '피부': '🧴', '물티슈': '🧻', '세탁실': '🧺', '우유 거품': '☕', '자산 거품': '📈',
    # 🛞
    'flat': '➖', 'wheel': '🚙',
    # 🫗 따르다
    '물약': '💊', 'jug': '🍶', 'excessive': '📈', '비우다': '🗑️', 'stain': '👕',
    # 🩻
    '척추': '🦴', '디스크': '🦴',
    # 🫘
    '원두': '☕', '콜드브루': '☕', '두유': '🥛', '씨앗': '🌱',
    # 🪷 · 🪽
    '池': '🏞️', '불상': '🙏', '날개뼈': '🦴',
    # 🫳
    '掴む': '✊', '拾う': '🤏', '落す': '⬇️',
    # 🫣
    '躊躇': '😬',
    # 🫱 문지르다
    '문지르다': '👐',
    # 🔞
    'eighteen': '1️⃣8️⃣', 'underage': '🧒', '成年': '🧑',
    # 한국어판 문장·단어
    '만 18세부터 투표할 수 있어요.': '🗳️', '선거권': '🗳️', '인권': '🧑‍🤝‍🧑', '김장': '🥬',
    '지게차는 면허가 있는 사람만 운전할 수 있어요.': '🚜', '확증 편향': '🙈', '과유불급': '⚖️', '비유': '💭',
    '이 사찰은 유네스코 세계 문화유산으로 등재되었다.': '🙏', '휴대폰 배터리가 다 됐어요.': '🔋', '미성년자': '🧒',
    '출근 카드를 찍으세요.': '💳', '셀프': '🙋', '만 원 받았습니다.': '💵', '양념': '🧂', '팔에 힘을 빼 주세요.': '😌',
    '닭장에서 달걀을 모아 주세요.': '🥚', '콜드브루': '🧊', '우유 거품': '☁️', 't-work-build-12': '⛏️',
    '불난 집에 부채질': '🔥',
}

def is_emoji_str(s):
    return s and all(ord(ch) > 0x2000 for ch in s) and any(ch in NEW for ch in s)

Q = r"'((?:[^'\\]|\\.)*)'"
write = '--write' in sys.argv
changed = 0
for f in sorted(glob.glob(f'{ROOT}/**/*.ts', recursive=True)):
    src = open(f, encoding='utf8').read()
    out = []
    for line in src.split('\n'):
        if any(ch in NEW for ch in line):
            strs = list(re.finditer(Q, line))
            term = strs[0].group(1) if strs else ''
            def rep(m):
                global changed
                s = m.group(1)
                if not is_emoji_str(s):
                    return m.group(0)
                new = BY_TERM.get(term)
                if new is None:
                    new = ''.join(DEFAULT.get(ch, ch) for ch in s)
                changed += 1
                print(f"{f.split('/data/')[1]:28} {term[:28]:28} {s} → {new}")
                return "'" + new + "'"
            line = re.sub(Q, rep, line)
        out.append(line)
    new_src = '\n'.join(out)
    left = [ch for ch in new_src if ch in NEW]
    if left:
        print('  !! 남은 그림', f, ''.join(sorted(set(left))))
    if write and new_src != src:
        open(f, 'w', encoding='utf8').write(new_src)
print('바꾼 수:', changed, '(쓰기)' if write else '(미리보기)')
