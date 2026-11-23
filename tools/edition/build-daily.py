# 생활·학교 코스: skel-*-daily.json + out-end-*/out-jad-* (+ 토익 데이터에서 가져온 'done') → src/data/{ja,en}/daily-*.ts · daily.ts
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import glob, json, os
S = WORK + '/edition2'
D = ROOT + '/src/data'
q = lambda s: "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"
CFG = {
    'en': {'skel': 'skel-en-daily.json', 'outs': 'out-end-*.json', 'files': {'A1': 'daily-a1', 'A2': 'daily-a2', 'B1': 'daily-b1'},
           'head': """// 영어판 — 일상·학교 영어 {lv} (출처 기반)
// 단어 목록: CEFR-J Vocabulary Profile 1.5 — Tono Laboratory, Tokyo University of Foreign Studies (연구·상업 용도 무료, 출처 표시)
//   CEFR {lv} · 주제가 있는 단어는 주제 단원(CEFR-J 주제), 나머지는 NGSL 1.2 빈도 순 Day 단원
// 발음(IPA): CMU Pronouncing Dictionary · 뜻·예문(한국어): 이 앱에서 새로 씀 (초안) — 토익 코스와 겹치는 단어는 같은 뜻·예문
// 자세한 출처: ./SOURCES.md
"""},
    'ja': {'skel': 'skel-ja-daily.json', 'outs': 'out-jad-*.json', 'files': {'1': 'daily-1', '2': 'daily-2', '3': 'daily-3'},
           'head': """// 일본어판 — 생활 일본어 {lv} (출처 기반)
// 단어 목록: JMdict (EDRDG, CC BY-SA 4.0) 상용어 표시(news1·ichi1·spec·gai1) 중 JLPT N5~N1 목록에 없는 말
//   순서: Jiten global frequency list (CC BY-SA 4.0) 자주 쓰는 순 · 25개씩 Day 단원
// 뜻·예문(한국어): 이 앱에서 새로 씀 (초안) · 이 파일은 CC BY-SA 4.0 — 자세한 출처: ./SOURCES.md
"""},
}
for lang, c in CFG.items():
    out = {}
    for f in sorted(glob.glob(f'{S}/{c["outs"]}')):
        out.update(json.load(open(f, encoding='utf8')))
    skel = json.load(open(f'{S}/{c["skel"]}', encoding='utf8'))
    made = []
    for lv in skel:
        name = c['files'][lv['level']]
        units_ts, ex_ts, ok = [], [], True
        for u in lv['units']:
            rows = []
            for w in u['words']:
                o = w.get('done') or out.get(w['term'])
                if not o:
                    ok = False
                    continue
                reading = w['reading'] or o.get('ipa', '')
                rows.append(f"      [{q(w['term'])}, {q(reading)}, {q(o['meaning'])}, {q(o['emoji'])}],")
                ex_ts.append(f"  {q(w['term'])}: {{ ex: {q(o['ex'])}, rom: {q(o.get('exRom', '') if lang == 'ja' else '')}, ko: {q(o['exKo'])} }},")
            if rows:
                first = w0 if (w0 := (u['words'][0].get('done') or out.get(u['words'][0]['term']))) else None
                icon = first['emoji'] if first else '📘'
                units_ts.append(f"  {{\n    key: {q(u['key'])},\n    icon: {q(icon)},\n    title: {q(u['title'])},\n    words: [\n" + '\n'.join(rows) + "\n    ],\n    phrases: [],\n  },")
        if not ok:
            print(f'  {lang} daily {lv["level"]}: 아직 채우지 않은 단어가 있어 건너뜀')
            made.append((name, False))
            continue
        src = c['head'].format(lv=lv['level']) + "import type { EdUnit, EdExampleMap } from '../edition-types'\n\n"
        src += 'export const UNITS: EdUnit[] = [\n' + '\n'.join(units_ts) + '\n]\n\nexport const EX: EdExampleMap = {\n' + '\n'.join(ex_ts) + '\n}\n'
        open(f'{D}/{lang}/{name}.ts', 'w', encoding='utf8').write(src)
        made.append((name, True))
    var = lambda n: 'D_' + n.replace('daily-', '').upper()
    idx = "// 생활·학교 코스 레벨 (순서 = daily-1, daily-2 …) · 아직 채우지 않은 레벨은 빈 자리(화면에 안 보임)\nimport type { EdLevel } from '../edition-data'\n"
    idx += ''.join(f"import * as {var(n)} from './{n}.ts'\n" for n, ok in made if ok)
    idx += "\nconst EMPTY: EdLevel = { UNITS: [], EX: {} }\nexport const DAILY: EdLevel[] = [" + ', '.join(var(n) if ok else 'EMPTY' for n, ok in made) + ']\n'
    open(f'{D}/{lang}/daily.ts', 'w', encoding='utf8').write(idx)
    print(lang, 'daily made', [n for n, ok in made if ok], '| 비어 있음', [n for n, ok in made if not ok])
