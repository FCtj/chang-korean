# 2022 개정 제2외국어과 일본어 [別表I] 基本語彙表 (JPF 번역판 docx) → moe-ja.json [{kana, kanji, raw}]
#   표기: かな(漢字) = 학습용 한자 · かな<漢字> = 한자 표기 참고 · '-' 는 접사 · 〜 는 붙여 쓰는 말
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import zipfile, re, html, json
D = WORK + '/drive'
x = zipfile.ZipFile(f'{D}/jpf-438-458.docx').read('word/document.xml').decode('utf8')
paras = []
for p in re.findall(r'<w:p[ >].*?</w:p>', x, re.S):
    t = html.unescape(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))).strip()
    if t:
        paras.append(t)
# 표 앞의 안내문 건너뛰기: 첫 'あ' 줄부터
start = next(i for i, t in enumerate(paras) if re.match(r'^[ぁ-ゖー]', t) and not t.startswith('◦') and i > 20)
# 괄호 통일 후, 닫는 괄호가 더 많은 줄은 앞 항목의 이어지는 부분
def norm(t):
    return t.replace('（', '(').replace('）', ')').replace('〈', '<').replace('〉', '>').replace('＜', '<').replace('＞', '>')
items = []
for t in paras[start:]:
    if t.startswith('[別表'):
        break
    t = norm(t)
    closes = t.count(')') + t.count('>') - t.count('(') - t.count('<')
    if items and closes > 0:
        items[-1] += t
    else:
        items.append(t)
# 닫는 괄호가 빠진 항목 고치기 (예: あける(開ける)
items = [it + (')' if it.count('(') > it.count(')') else '') + ('>' if it.count('<') > it.count('>') else '') for it in items]
out = []
seen = set()
for it in items:
    s = it.replace('（', '(').replace('）', ')').replace('〈', '<').replace('〉', '>').replace('［', '[').replace('］', ']').replace('･', '・').replace('‹›', '').strip()
    s = re.sub(r'^[―－]', '-', s).replace('～', '〜')
    m = re.match(r'^([-〜~]?)([ぁ-ゖァ-ヺー・〜~\-]+?)([-〜~]?)\s*(?:[(<\[]([^)>\]]*)[)>\]])?\s*$', s)
    if not m:
        out.append({'raw': s, 'kana': None, 'kanji': None})
        continue
    kana = m.group(2)
    kanji = (m.group(4) or '').split('・')[0].strip() or None
    key = (kana, kanji)
    if key in seen:
        continue
    seen.add(key)
    out.append({'raw': s, 'kana': kana, 'kanji': kanji, 'affix': bool(m.group(1) or m.group(3)), 'learn': '(' in s})
json.dump(out, open(f'{D}/moe-ja.json', 'w'), ensure_ascii=False, indent=0)
ok = [o for o in out if o['kana']]
print('items', len(out), 'parsed', len(ok), 'unparsed', len(out) - len(ok))
print([o['raw'] for o in out if not o['kana']][:30])
print(ok[:8], ok[-5:])
