# 일본어판 예문 ②③ 검사: python3 -I tools/exmore/check-ja.py NN   (저장소 루트에서, in-NN.json + out-NN.json)
# 읽기 대조에 SudachiPy 필요: pip install sudachipy sudachidict_core
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jread import same
ROOT = os.getcwd()
WORK = os.environ.get('CK_WORK', f'{ROOT}/tools/_work') + '/exmore/ja'
nn = sys.argv[1]
inp = json.load(open(f'{WORK}/in-{nn}.json', encoding='utf-8'))
try:
    out = json.load(open(f'{WORK}/out-{nn}.json', encoding='utf-8'))
except FileNotFoundError:
    sys.exit(f'✗ out-{nn}.json 없음')
except json.JSONDecodeError as e:
    sys.exit(f'✗ JSON 아님: {e}')
HANGUL = re.compile(r'[가-힣]')
JA = re.compile(r'[぀-ヿ一-鿿]')
KANA = re.compile(r'^[぀-ゟ゠-ヿー・\s、。？！「」『』〜～…（）()0-9０-９A-Za-zＡ-Ｚａ-ｚ,.?!%％]+$')
errs, warns = [], []
terms = set()
for d in inp:
    t = d['term']; terms.add(t)
    w = f'"{t}"'
    v = out.get(t)
    if not isinstance(v, list) or len(v) != 2:
        errs.append(f'{w}: 예문 2개(리스트)가 필요'); continue
    seen = {d['ex1']}
    for k, e in enumerate(v, 2):
        at = f'{w} 예문{k}'
        if not isinstance(e, dict) or any(not str(e.get(x, '')).strip() for x in ('ex', 'rom', 'ko')):
            errs.append(f'{at}: ex·rom·ko 모두 필요'); continue
        ex, rom, ko = e['ex'].strip(), e['rom'].strip(), e['ko'].strip()
        if HANGUL.search(ex) or not JA.search(ex): errs.append(f'{at}: ex 는 일본어 → {ex}')
        if len(ex) > 45: errs.append(f'{at}: ex 너무 김 ({len(ex)}자)')
        elif len(ex) > 34: warns.append(f'{at}: 조금 김 ({len(ex)}자) → {ex}')
        if not KANA.match(rom): errs.append(f'{at}: rom 은 가나 읽기만 → {rom}')
        if not HANGUL.search(ko) or JA.search(re.sub(r'[一-鿿]', '', ko)): errs.append(f'{at}: ko 는 한국어 → {ko}')
        if ex in seen: errs.append(f'{at}: 예문 ①이나 다른 예문과 똑같음')
        seen.add(ex)
        term = re.sub(r'[～〜]', '', t)
        stem = term[:-1] if len(term) > 1 and re.search(r'[るうくすつぬむぶぐいだ]$', term) else term
        r = re.sub(r'[～〜]', '', d['reading'])
        rstem = r[:-1] if len(r) > 1 else r
        if stem not in ex and (not rstem or rstem not in rom): warns.append(f'{at}: 단어가 안 보임 → {ex}')
        if KANA.match(rom):
            ok, sud = same(ex, rom)
            if not ok: warns.append(f'{at}: 읽기 확인 (Sudachi: {sud}) → {ex} / {rom}')
for k in out:
    if k not in terms: errs.append(f'목록에 없는 단어 "{k}" (단어는 바꾸지 말 것)')
for m in errs: print('✗', m)
for m in warns: print('△', m)
if errs: sys.exit(f'\n{len(errs)}개 문제 · 경고 {len(warns)}')
print(f'✓ out-{nn}.json: {len(inp)}단어 · 예문 {2 * len(inp)}개 정상' + (f' (경고 {len(warns)})' if warns else ''))
