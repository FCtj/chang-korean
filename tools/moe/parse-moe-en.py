# 2022 개정 영어과 교육과정 [별표 3] 기본 어휘 목록 (3,000) → moe-en.json  [{w, mark: '*'|'**'|'', forms: [...]}]
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import re, json, sys
D = WORK + '/drive'
lines = open(f'{D}/moe-english.txt', encoding='utf8').read().split('\n')
start = next(i for i, l in enumerate(lines) if '기본 어휘 목록' in l and i > 150)
end = next(i for i, l in enumerate(lines) if i > start and '기본 어휘 관련 지침 개정' in l)
entries = []
last = None
CELL = re.compile(r"^(?P<w>[A-Za-z][A-Za-z.'’\-]*(?: [A-Za-z][A-Za-z.'’\-]*)*?)(?P<m>\*{1,2})?(?:\s*\((?P<f>[^)]*)\))?$")
for l in lines[start + 1:end]:
    if re.search(r'^\s*-\s*\d+\s*-\s*$', l) or not l.strip():
        continue
    cells = [c.strip() for c in re.split(r'\s{2,}', l.strip()) if c.strip()]
    for c in cells:
        if re.fullmatch(r'[A-Z]', c):
            continue  # 알파벳 머리글자
        if c.startswith('(') and c.endswith(')'):
            if last:
                last['forms'] += [x.strip() for x in c[1:-1].split(',')]
            continue
        if re.fullmatch(r"[^()]*\)", c):
            continue  # 앞 줄에서 넘어온 괄호 끝 (파생어)
        c = re.sub(r'\s*\([^)]*$', '', c)  # 줄을 넘는 괄호는 버림
        if ' / ' in c or c.endswith(' /'):
            c = c.split(' / ')[0].rstrip(' /')  # 철자 변이형: 첫 번째만
            c = re.sub(r'\s*\([^)]*$', '', c)
        m = CELL.match(c)
        if not m:
            print('?', repr(c), file=sys.stderr)
            continue
        last = {'w': m['w'], 'mark': m['m'] or '', 'forms': [x.strip() for x in (m['f'] or '').split(',') if x.strip()]}
        entries.append(last)
seen = set()
out = []
for e in entries:
    k = e['w'].lower()
    if k in seen:
        continue
    seen.add(k)
    out.append(e)
json.dump(out, open(f'{D}/moe-en.json', 'w'), ensure_ascii=False, indent=0)
from collections import Counter
print(len(out), Counter(e['mark'] for e in out))
print(out[:5], out[-3:])
