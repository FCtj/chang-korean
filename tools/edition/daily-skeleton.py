# 일상·학교 코스 뼈대
#   영어: CEFR-J Vocabulary Profile 1.5 의 A1(중1·기초) · A2(중2~3) · B1(고등) — 주제가 있는 단어는 주제 단원, 나머지는 NGSL 순위 Day 단원
#         토익 데이터(out-en-*.json)에 이미 있는 단어는 그 뜻·예문을 그대로 씀 (에이전트에 보내지 않음)
#   일본어: JMdict 상용어(news1·ichi1·spec·gai1) 중 JLPT N5~N1 목록 밖 · Jiten 빈도 상위 900 → 생활 회화 ①②③
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import csv, glob, json, math, re
S = WORK
SRC = f'{S}/src-data'
OUT = f'{S}/edition2'
UNIT = 25

# ── CMU → IPA (skeleton.py 와 같은 변환) ──
ARPA = {'AA': 'ɑ', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'ɛ', 'ER': 'ɝ', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ', 'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u',
        'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'g', 'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': 'ʒ'}
VOW = set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split())
def ipa(ph):
    out = []
    nv = sum(1 for p in ph if re.sub(r'\d', '', p) in VOW)
    for i, p in enumerate(ph):
        b, st = re.sub(r'\d', '', p), (re.findall(r'\d', p) or [''])[0]
        sym = 'ə' if (b == 'AH' and st == '0') else 'ɚ' if (b == 'ER' and st == '0') else ARPA.get(b, '')
        if b in VOW and st in ('1', '2') and nv > 1:
            j = len(out) - (1 if out and i > 0 and re.sub(r'\d', '', ph[i - 1]) not in VOW else 0)
            out.insert(j, 'ˈ' if st == '1' else 'ˌ')
        out.append(sym)
    return ''.join(out)
cmu = {}
for line in open(f'{SRC}/cmu/cmudict.dict', encoding='utf8'):
    parts = line.split('#')[0].split()
    if parts and '(' not in parts[0]:
        cmu.setdefault(parts[0], ipa(parts[1:]))
def ipa_of(term):
    ws = term.lower().split()
    got = [cmu.get(w) for w in ws]
    return ' '.join(got) if all(got) else ''

# ── 영어 ──
THEME_KO = {
    'Personal identification': '나·사람 소개', 'Free time, entertainment': '여가·놀이', 'House and home, environment': '집·생활환경', 'Shopping': '쇼핑',
    'Food and drink': '음식·음료', 'Travel': '여행·교통', 'Health and body care': '건강·몸', 'Education': '학교·공부', 'Relations with other people': '사람 사이',
    'Services': '공공 서비스', 'Language': '말·언어', 'Daily life': '하루 생활', 'Weather': '날씨', 'Places': '장소', 'Work and Jobs': '일·직업',
    'Objects and rooms': '물건·방', 'Things in the town, shops and shopping': '동네·가게', 'News, lifestyles and current affairs': '뉴스·사회', 'Clothes': '옷',
    'Hobbies and pastimes': '취미', 'Nationalities and countries': '나라·국적', 'Family life': '가족', 'Leisure activities': '여가 활동', 'Books and literature': '책·문학',
    'Media': '미디어', 'Arts': '예술', 'Film': '영화', 'Ways of travelling': '교통수단', 'Animals': '동물', 'Sport': '운동', 'Music': '음악', 'Colours': '색깔',
    'Environment': '환경', 'Technology': '기술', 'Science': '과학', 'Body': '몸', 'Health': '건강', 'Time': '시간', 'Transport': '교통', 'Weather and climate': '날씨',
}
SKIP = {'a', 'an', 'the', 'I', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
        'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves', 'to'}
ngsl = {}
for r in csv.reader(open(f'{SRC}/en/NGSL_12_stats.csv', encoding='utf-8')):
    if r and not r[0].startswith('#') and r[1].isdigit():
        ngsl[r[0].lower()] = int(r[1])
toeic = {}
for f in glob.glob(f'{OUT}/out-en-*.json'):
    toeic.update(json.load(open(f, encoding='utf8')))
toeic_read = {}
for lv in json.load(open(f'{OUT}/skel-en.json', encoding='utf8')):
    for u in lv['units']:
        for w in u['words']:
            toeic_read[w['term']] = w['reading'] or toeic.get(w['term'], {}).get('ipa', '')
rows = list(csv.DictReader(open(f'{SRC}/en/olp-cefrj-vocabulary-profile-1.5.csv', encoding='utf-8')))
ORDER = ['A1', 'A2', 'B1']
info = {}
for x in rows:
    if x['CEFR'] not in ORDER:
        continue
    h = x['headword'].split('/')[0].strip()
    if not h or h in SKIP or x['pos'] in ('be-verb', 'do-verb', 'have-verb', 'infinitive-to') or len(h.split()) > 4:
        continue
    theme = x['Threshold'] or x['CoreInventory 1'] or x['CoreInventory 2']
    w = info.setdefault(h, {'term': h, 'level': x['CEFR'], 'pos': [], 'theme': ''})
    if ORDER.index(x['CEFR']) < ORDER.index(w['level']):
        w['level'] = x['CEFR']
    if x['pos'] not in w['pos']:
        w['pos'].append(x['pos'])
    if theme and theme in THEME_KO and not w['theme']:
        w['theme'] = theme
en_levels = []
done = 0
for lv in ORDER:
    ws = [w for w in info.values() if w['level'] == lv]
    ws.sort(key=lambda w: (ngsl.get(w['term'].lower(), 99999), w['term'].lower()))
    by_theme = {}
    rest = []
    for w in ws:
        (by_theme.setdefault(w['theme'], []) if w['theme'] else rest).append(w)
    # 단어가 적은 주제는 Day 단원으로
    for t in list(by_theme):
        if len(by_theme[t]) < 8:
            rest += by_theme.pop(t)
    rest.sort(key=lambda w: (ngsl.get(w['term'].lower(), 99999), w['term'].lower()))
    units = []
    for t, items in sorted(by_theme.items(), key=lambda kv: -len(kv[1])):
        n = math.ceil(len(items) / UNIT)
        size = math.ceil(len(items) / n)
        for k in range(n):
            part = items[k * size:(k + 1) * size]
            units.append({'key': '', 'title': THEME_KO[t] + (f' {"①②③④⑤⑥⑦⑧"[k]}' if n > 1 else ''), 'words': part})
    for k in range(0, len(rest), UNIT):
        units.append({'key': '', 'title': f'Day {k // UNIT + 1:02d}', 'words': rest[k:k + UNIT]})
    for i, u in enumerate(units):
        u['key'] = f'u{i + 1:02d}'
        for w in u['words']:
            w['reading'] = toeic_read.get(w['term']) or ipa_of(w['term'])
            w['hint'] = f"CEFR {lv} · {'/'.join(w['pos'])}" + (f" · {w['theme']}" if w['theme'] else '')
            if w['term'] in toeic:
                w['done'] = toeic[w['term']]
                done += 1
    en_levels.append({'level': lv, 'units': units})
json.dump(en_levels, open(f'{OUT}/skel-en-daily.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
tot = sum(len(u['words']) for l in en_levels for u in l['units'])
print('en daily words', tot, '| from TOEIC data', done, '| per level', [(l['level'], sum(len(u['words']) for u in l['units']), len(l['units'])) for l in en_levels])

# ── 일본어 ──
cands = json.load(open(f'{SRC}/jlpt/daily-cands.json', encoding='utf8'))[:900]
ja_levels = []
for k in range(3):
    part = cands[k * 300:(k + 1) * 300]
    units = [{'key': f'd{i // UNIT + 1:02d}', 'title': f'Day {i // UNIT + 1:02d}', 'words': [{'term': w['term'], 'reading': w['reading'], 'hint': w['hint']} for w in part[i:i + UNIT]]} for i in range(0, len(part), UNIT)]
    ja_levels.append({'level': str(k + 1), 'units': units})
json.dump(ja_levels, open(f'{OUT}/skel-ja-daily.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('ja daily words', sum(len(u['words']) for l in ja_levels for u in l['units']))

# ── 에이전트 묶음: 새로 쓸 단어만 (같은 단원에 이미 있는 그림·뜻은 피하도록 taken 으로) ──
def chunks(lang, levels, target):
    out = []
    allu = [(lv['level'], u) for lv in levels for u in lv['units']]
    todo = [(lv, u) for lv, u in allu if any('done' not in w for w in u['words'])]
    total = sum(sum(1 for w in u['words'] if 'done' not in w) for _, u in todo)
    n = max(1, round(total / target))
    per = math.ceil(len(todo) / n)
    for c in range(0, len(todo), per):
        part = todo[c:c + per]
        data = []
        for lv, u in part:
            taken = [w['done'] for w in u['words'] if 'done' in w]
            data.append({'level': lv, 'key': u['key'], 'title': u['title'], 'words': [{'term': w['term'], 'reading': w['reading'], 'hint': w['hint']} for w in u['words'] if 'done' not in w],
                         'taken': {'emoji': [t['emoji'] for t in taken], 'meaning': [t['meaning'] for t in taken]}})
        name = f'{lang}d-{c // per + 1}'
        json.dump(data, open(f'{OUT}/chunk-{name}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        out.append((name, sum(len(u['words']) for u in data)))
    return out
print('chunks', chunks('en', en_levels, 450), chunks('ja', ja_levels, 450))
