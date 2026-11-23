# 출처 목록으로 레벨·단원 뼈대 만들기 → skel-ja.json · skel-en.json (+ 에이전트 묶음 chunk-*.json)
#   일본어: JLPT N5·N4·N3 (Jonathan Waller 목록, open-anki-jlpt-decks 판) · 단원 안 순서 = Jiten 빈도 순위
#   영어:   TSL 1.2 전부 + NGSL 1.2 701~2809위 · 레벨 = 각 목록 안 순위 백분위로 5등분 (450·600·700·800·900+)
#   영어 발음 = CMU 발음사전(ARPAbet → IPA)
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import csv, json, math, os, re
S = WORK
SRC = f'{S}/src-data'
OUT = f'{S}/edition2'
UNIT = 25
old = json.load(open(f'{OUT}/old.json', encoding='utf8'))

def units_of(words):
    return [{'key': f'd{i // UNIT + 1:02d}', 'title': f'Day {i // UNIT + 1:02d}', 'words': words[i:i + UNIT]} for i in range(0, len(words), UNIT)]

# ── 일본어 ──
freq = {}
with open(f'{SRC}/jlpt/jiten_freq_global.csv', encoding='utf8') as f:
    for row in csv.DictReader(f):
        try:
            r = int(row['Rank'])
        except (ValueError, KeyError):
            continue
        for k in (row.get('Word'), row.get('Form')):
            if k and k not in freq:
                freq[k] = r
seen = set()
ja_levels = []
# 목록 표기 정리 (이형 'A; B' → 대표 표기 하나, 메모 '(かん)'·'(する)' 빼기)
FIX = {
    '堅; 硬; 固い': ('固い', 'かたい'), '足; 脚': ('足', 'あし'), '伯父; 叔父さん': ('おじさん', 'おじさん'), '伯母さん; 叔母さん': ('おばさん', 'おばさん'),
    'キロ; キログラム': ('キログラム', 'キログラム'), 'キロ; キロメートル': ('キロメートル', 'キロメートル'), 'お金持ち': ('お金持ち', 'おかねもち'),
    '～(て) しまう': ('～てしまう', '～てしまう'), '～(に) よると': ('～によると', '～によると'), '～(に) ついて': ('～について', '～について'),
    'パート (タイム)': ('パート', 'パート'), 'スーパー (マーケット)': ('スーパー', 'スーパー'), '高校; 高等学校': ('高校', 'こうこう'),
    '毎年': ('毎年', 'まいとし'), '毎月': ('毎月', 'まいつき'), '行く': ('行く', 'いく'), '何': ('何', 'なに'),
}
def clean(term, reading):
    if term in FIX:
        return FIX[term]
    term = re.sub(r'\s*\((?:かん|する)\)', '', term)
    reading = re.sub(r'\s*\((?:かん|する)\)', '', reading)
    term = re.split(r'[;、]', term)[0].strip()
    reading = re.split(r'[;、]', reading)[0].strip()
    return term, reading
for lv in ['n5', 'n4', 'n3']:
    rows = []
    with open(f'{SRC}/jlpt/{lv}.csv', encoding='utf8') as f:
        for r in csv.DictReader(f):
            term, reading = clean(r['expression'].strip(), r['reading'].strip())
            if not term or term in seen:
                continue
            seen.add(term)
            reading = reading or term
            rank = min(freq.get(term, 10**7), freq.get(reading, 10**7) if reading != term else 10**7)
            w = {'term': term, 'reading': reading, 'hint': r['meaning'].strip(), 'rank': rank}
            if term in old['ja']:
                w['draft'] = old['ja'][term]
            rows.append(w)
    rows.sort(key=lambda w: w['rank'])
    for w in rows:
        w.pop('rank')
    ja_levels.append({'level': lv.upper(), 'units': units_of(rows)})

# ── 영어 ──
ARPA = {'AA': 'ɑ', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'ɛ', 'ER': 'ɝ', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ', 'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u',
        'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'g', 'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': 'ʒ'}
VOW = {'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'}
def ipa(phones):
    out = []
    nvow = sum(1 for p in phones if re.sub(r'\d', '', p) in VOW)
    for i, p in enumerate(phones):
        base, st = re.sub(r'\d', '', p), (re.findall(r'\d', p) or [''])[0]
        sym = ARPA.get(base, '')
        if base == 'AH' and st == '0':
            sym = 'ə'
        if base == 'ER' and st == '0':
            sym = 'ɚ'
        if base in VOW and st in ('1', '2') and nvow > 1:
            mark = 'ˈ' if st == '1' else 'ˌ'
            # 강세 표시는 앞 자음 하나 앞에 (대략적인 음절 시작)
            j = len(out)
            if out and i > 0 and re.sub(r'\d', '', phones[i - 1]) not in VOW:
                j -= 1
            out.insert(j, mark)
        out.append(sym)
    return ''.join(out)
cmu = {}
with open(f'{SRC}/cmu/cmudict.dict', encoding='utf8') as f:
    for line in f:
        parts = line.split('#')[0].split()
        if not parts:
            continue
        w = parts[0]
        if '(' in w:
            continue
        cmu.setdefault(w, ipa(parts[1:]))

def load(path, enc, rank_col):
    rows = [r for r in csv.reader(open(path, encoding=enc)) if r and not r[0].startswith('#')]
    head = rows[0]
    i = head.index(rank_col)
    return [(r[0].strip(), int(r[i])) for r in rows[1:] if r[0].strip()]
ngsl = [(w, r) for w, r in load(f'{SRC}/en/NGSL_12_stats.csv', 'utf-8', 'SFI Rank') if r >= 701]
tsl = load(f'{SRC}/en/TSL_12_stats.csv', 'latin-1', 'TSL Rank')
items = []
for w, r in ngsl:
    items.append({'term': w, 'src': f'NGSL {r}', 'p': (r - 701) / (2809 - 701 + 1)})
for w, r in tsl:
    items.append({'term': w, 'src': f'TSL {r}', 'p': (r - 1) / len(tsl)})
seen = set()
en_levels = [[] for _ in range(5)]
for it in sorted(items, key=lambda x: x['p']):
    t = it['term']
    if t.lower() in seen:
        continue
    seen.add(t.lower())
    lv = min(4, int(it['p'] * 5))
    w = {'term': t, 'reading': cmu.get(t.lower(), ''), 'hint': it['src']}
    if t in old['en']:
        w['draft'] = old['en'][t]
    en_levels[lv].append(w)
en = [{'level': name, 'units': units_of(ws)} for name, ws in zip(['450', '600', '700', '800', '900'], en_levels)]

json.dump(ja_levels, open(f'{OUT}/skel-ja.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(en, open(f'{OUT}/skel-en.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# 에이전트 묶음: 단원 단위로 약 500단어씩
def chunks(lang, levels, target):
    allu = [(lv['level'], u) for lv in levels for u in lv['units']]
    total = sum(len(u['words']) for _, u in allu)
    n = max(1, round(total / target))
    per = math.ceil(len(allu) / n)
    out = []
    for k in range(0, len(allu), per):
        part = allu[k:k + per]
        name = f'{lang}-{k // per + 1}'
        json.dump([{'level': lv, **u} for lv, u in part], open(f'{OUT}/chunk-{name}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        out.append((name, sum(len(u['words']) for _, u in part), sum(1 for _, u in part for w in u['words'] if 'draft' in w), f'{part[0][0]} {part[0][1]["title"]} → {part[-1][0]} {part[-1][1]["title"]}'))
    return out
for lang, lv in (('ja', ja_levels), ('en', en)):
    tot = sum(len(u['words']) for l in lv for u in l['units'])
    print(lang, 'words', tot, '| per level', [(l['level'], sum(len(u['words']) for u in l['units']), len(l['units'])) for l in lv])
    for c in chunks(lang, lv, 500):
        print('  ', c)
print('en missing IPA:', sum(1 for l in en for u in l['units'] for w in u['words'] if not w['reading']))
print('ja no freq (sorted last) sample:', [w['term'] for l in ja_levels for u in l['units'][-1:] for w in u['words'][-5:]])
