# 일본어판 예문 ②③ → src/data/ja/ex-more-N.ts + ex-more.ts (저장소 루트에서: python3 -I tools/exmore/build-ja.py)
# 입력: tools/_work/exmore/ja/out-*.json (check-ja.py 를 통과한 것)
import glob, json, os
ROOT = os.getcwd()
WORK = os.environ.get('CK_WORK', f'{ROOT}/tools/_work') + '/exmore/ja'
PARTS = 4
merged = {}
for f in sorted(glob.glob(f'{WORK}/out-*.json')):
    merged.update(json.load(open(f, encoding='utf-8')))
order = []
for f in sorted(glob.glob(f'{WORK}/in-*.json')):
    order += [d['term'] for d in json.load(open(f, encoding='utf-8'))]
keys = list(dict.fromkeys(k for k in order if k in merged))
q = lambda s: "'" + s.strip().replace('\\', '\\\\').replace("'", "\\'") + "'"
size = -(-len(keys) // PARTS)
names = []
for i in range(PARTS):
    part = keys[i * size:(i + 1) * size]
    if not part: break
    n = i + 1
    names.append(n)
    lines = [
        f'// 일본어판 예문 ②③ ({n}/{PARTS}) — 이 앱에서 새로 씀: 초안 (원어민·전문가 검수 전)',
        '// 만든 방법: tools/exmore/ (SPEC-ja.md · check-ja.py · build-ja.py) — 직접 고치지 말고 out-*.json 을 고친 뒤 다시 만들 것',
        "import type { EdExampleMoreMap } from '../edition-types'",
        '',
        'export const MORE: EdExampleMoreMap = {',
    ]
    for k in part:
        lines.append(f'  {q(k)}: [')
        for e in merged[k]:
            lines.append(f"    {{ ex: {q(e['ex'])}, rom: {q(e['rom'])}, ko: {q(e['ko'])} }},")
        lines.append('  ],')
    lines.append('}')
    open(f'{ROOT}/src/data/ja/ex-more-{n}.ts', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
agg = ['// 일본어판 예문 ②③ — tools/exmore/build-ja.py 가 만듦 (예문 ① 은 각 레벨 파일의 EX)', "import type { EdExampleMoreMap } from '../edition-types'"]
agg += [f"import {{ MORE as M{n} }} from './ex-more-{n}.ts'" for n in names]
agg += ['', 'export const EX_MORE: EdExampleMoreMap = { ' + ', '.join(f'...M{n}' for n in names) + ' }', '']
open(f'{ROOT}/src/data/ja/ex-more.ts', 'w', encoding='utf-8').write('\n'.join(agg))
print(f'✓ 예문 ②③ {len(keys)}단어 / 일감 {len(order)}단어 → src/data/ja/ex-more-1..{len(names)}.ts')
