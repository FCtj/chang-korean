# 일본어판 예문 ②③ 일감 만들기: src/data/ja/*.ts 의 EX(예문 ①) → tools/_work/exmore/ja/in-NN.json
# 저장소 루트에서: python3 tools/exmore/prep-ja.py [묶음 크기=140]
import re, json, os, sys
ROOT = os.getcwd()
WORK = os.environ.get('CK_WORK', f'{ROOT}/tools/_work') + '/exmore/ja'
os.makedirs(WORK, exist_ok=True)
SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 140
# ED_EXAMPLES 와 같은 순서: 학교·생활 코스 먼저, JLPT 가 같은 단어를 덮어씀
ORDER = ['moe-1', 'moe-2', 'daily-1', 'daily-2', 'daily-3', 'n5', 'n4', 'n3']
Q = r"'((?:[^'\\]|\\.)*)'"
ROW = re.compile(rf"^\s+\[{Q}, {Q}, {Q}, {Q}\]", re.M)
EX = re.compile(rf"^\s+{Q}: \{{ ex: {Q}, rom: {Q}, ko: {Q} \}}", re.M)
items = {}
for name in ORDER:
    s = open(f'{ROOT}/src/data/ja/{name}.ts', encoding='utf-8').read()
    rows = {m[0]: m for m in ROW.findall(s)}
    for term, ex, rom, ko in EX.findall(s):
        r = rows.get(term)
        items[term] = {'term': term, 'reading': r[1] if r else '', 'meaning': r[2] if r else '', 'level': name, 'ex1': ex, 'ko1': ko}
# 쉬운 레벨부터 (N5 → N4 → 교육과정 → N3 → 생활)
rank = {'n5': 0, 'n4': 1, 'moe-1': 2, 'moe-2': 3, 'n3': 4, 'daily-1': 5, 'daily-2': 6, 'daily-3': 7}
lst = sorted(items.values(), key=lambda d: rank[d['level']])
n = 0
for i in range(0, len(lst), SIZE):
    n += 1
    json.dump(lst[i:i + SIZE], open(f'{WORK}/in-{n:02d}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(lst)}단어 → {n}묶음 ({WORK}/in-01..{n:02d}.json)')
