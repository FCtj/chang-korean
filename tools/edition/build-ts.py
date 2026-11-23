# 출처 뼈대(skel-*.json) + 채운 결과(out-*.json) → 앱 데이터 파일
#   src/data/ja/n5.ts · n4.ts · n3.ts   /   src/data/en/toeic-450.ts … toeic-900.ts   (+ index.ts · SOURCES.md)
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import glob, json, os
S = WORK + '/edition2'
D = ROOT + '/src/data'
q = lambda s: "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"

HEAD = {
 'ja': """// 일본어판 — JLPT {lv} 단어 (출처 기반)
// 단어 목록: Jonathan Waller's JLPT {lv} list (tanos.co.uk, CC BY) — open-anki-jlpt-decks 판 (MIT, Jamie Sinclair)
// 단원 순서: Jiten global frequency list (jiten.moe, CC BY-SA 4.0) 의 자주 쓰는 순 · 25개씩 Day 단원
// 뜻·예문(한국어): 이 앱에서 새로 씀 — 초안, 원어민·전문가 검수 전
// 이 파일(가공한 단어 데이터)은 CC BY-SA 4.0 — 자세한 출처: ./SOURCES.md
""",
 'en': """// 영어판 — TOEIC {lv} 단어 (출처 기반)
// 단어 목록: TOEIC Service List 1.2 + New General Service List 1.2 (701~2,809위)
//   — Browne, C., Culligan, B., & Phillips, J. (newgeneralservicelist.com), CC BY-SA 4.0
// 레벨: 두 목록 안의 빈도 순위를 5등분 · 단원: 25개씩 Day 단원 (자주 쓰는 순)
// 발음(IPA): CMU Pronouncing Dictionary (Carnegie Mellon University) 에서 변환
// 뜻·예문(한국어): 이 앱에서 새로 씀 — 초안, 원어민·전문가 검수 전
// 이 파일(가공한 단어 데이터)은 CC BY-SA 4.0 — 자세한 출처: ./SOURCES.md
""",
}
FILES = {'ja': {'N5': 'n5', 'N4': 'n4', 'N3': 'n3'}, 'en': {'450': 'toeic-450', '600': 'toeic-600', '700': 'toeic-700', '800': 'toeic-800', '900': 'toeic-900'}}
READ_FIX = {'wind': 'wɪnd', 'いただく': 'いただく'}  # CMU 첫 발음이 뜻과 다른 단어
VAR = {'n5': 'N5', 'n4': 'N4', 'n3': 'N3', 'toeic-450': 'T450', 'toeic-600': 'T600', 'toeic-700': 'T700', 'toeic-800': 'T800', 'toeic-900': 'T900'}

for lang in ('ja', 'en'):
    out = {}
    for f in sorted(glob.glob(f'{S}/out-{lang}-*.json')):
        out.update(json.load(open(f, encoding='utf8')))
    skel = json.load(open(f'{S}/skel-{lang}.json', encoding='utf8'))
    os.makedirs(f'{D}/{lang}', exist_ok=True)
    made, missing = [], 0
    for lv in skel:
        name = FILES[lang][lv['level']]
        units_ts, ex_ts = [], []
        ok = True
        for u in lv['units']:
            rows = []
            for w in u['words']:
                o = out.get(w['term'])
                if not o:
                    ok = False
                    missing += 1
                    continue
                reading = READ_FIX.get(w['term']) or w['reading'] or o.get('ipa', '')
                rows.append(f"      [{q(w['term'])}, {q(reading)}, {q(o['meaning'])}, {q(o['emoji'])}],")
                ex_ts.append(f"  {q(w['term'])}: {{ ex: {q(o['ex'])}, rom: {q(o.get('exRom', '') if lang == 'ja' else '')}, ko: {q(o['exKo'])} }},")
            if not rows:
                continue
            icon = out[u['words'][0]['term']]['emoji'] if u['words'][0]['term'] in out else '📘'
            units_ts.append(f"  {{\n    key: {q(u['key'])},\n    icon: {q(icon)},\n    title: {q(u['title'])},\n    words: [\n" + '\n'.join(rows) + "\n    ],\n    phrases: [],\n  },")
        if not ok:
            print(f'  {lang} {lv["level"]}: 아직 채우지 않은 단어가 있어 건너뜀 (앱에서는 준비 중)')
            made.append((name, False))
            continue
        src = HEAD[lang].format(lv=lv['level'] if lang == 'ja' else lv['level'] + ('+' if lv['level'] == '900' else ''))
        src += "import type { EdUnit, EdExampleMap } from '../edition-types'\n\n"
        src += 'export const UNITS: EdUnit[] = [\n' + '\n'.join(units_ts) + '\n]\n\n'
        src += 'export const EX: EdExampleMap = {\n' + '\n'.join(ex_ts) + '\n}\n'
        open(f'{D}/{lang}/{name}.ts', 'w', encoding='utf8').write(src)
        made.append((name, True))
    title = '일본어판 — JLPT N5 → N3 (출처 기반, N2·N1 준비 중)' if lang == 'ja' else '영어판 — TOEIC 450 → 900+ (TSL 1.2 + NGSL 1.2)'
    idx = f"// {title} · 레벨 순서 = topik-1, topik-2 …\nimport type {{ EdLevel }} from '../edition-data'\n"
    idx += ''.join(f"import * as {VAR[n]} from './{n}.ts'\n" for n, ok in made if ok)
    idx += "\n// 아직 단어를 다 채우지 않은 레벨은 빈 자리 (화면에서 준비 중)\nconst EMPTY: EdLevel = { UNITS: [], EX: {} }\n"
    idx += f"export const LEVELS: EdLevel[] = [{', '.join(VAR[n] if ok else 'EMPTY' for n, ok in made)}]\n"
    open(f'{D}/{lang}/index.ts', 'w', encoding='utf8').write(idx)
    print(lang, 'made', [n for n, ok in made if ok], '| 준비 중', [n for n, ok in made if not ok], '| missing words', missing)
