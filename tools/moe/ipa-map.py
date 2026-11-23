# 교육부 영어 기본 어휘 중 앱에 없는 단어의 IPA (CMU 사전 → IPA, 강세 위치 고침)
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import json, re, sys
S = WORK
sys.path.insert(0, f'{ROOT}/tools/edition')
from importlib.machinery import SourceFileLoader
fix = SourceFileLoader('fixipa', f'{ROOT}/tools/edition/fix-ipa-stress.py').load_module().fix
ARPA = {'AA': 'ɑ', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'ɛ', 'ER': 'ɝ', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ', 'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u',
        'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'g', 'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': 'ʒ'}
VOW = set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split())
def ipa(phones):
    out = []
    nvow = sum(1 for p in phones if re.sub(r'\d', '', p) in VOW)
    for p in phones:
        base, st = re.sub(r'\d', '', p), (re.findall(r'\d', p) or [''])[0]
        sym = ARPA.get(base, '')
        if base == 'AH' and st == '0': sym = 'ə'
        if base == 'ER' and st == '0': sym = 'ɚ'
        if base in VOW and st in ('1', '2') and nvow > 1:
            out.append('ˈ' if st == '1' else 'ˌ')
        out.append(sym)
    return fix(''.join(out))
cmu = {}
for line in open(f'{S}/src-data/cmu/cmudict.dict', encoding='utf8'):
    parts = line.split('#')[0].split()
    if parts and '(' not in parts[0]:
        cmu.setdefault(parts[0], ipa(parts[1:]))
full = json.load(open(f'{S}/drive/moe-en-full.json'))
VAR = {'advertize': 'advertise', 'aggress': 'aggression', 'artifice': 'artifice', 'catalogue': 'catalog'}
out, miss = {}, []
for e in full:
    if e['have']:
        continue
    w = e['w'].lower()
    cand = [w, VAR.get(w, w), w.replace('ise', 'ize'), w.replace('our', 'or')]
    v = next((cmu[c] for c in cand if c in cmu), None)
    if not v and ' ' in w:
        parts = [cmu.get(x) for x in w.split()]
        v = ' '.join(parts) if all(parts) else None
    if v:
        out[e['w']] = v
    else:
        miss.append(e['w'])
json.dump(out, open(f'{S}/drive/ipa-map.json', 'w'), ensure_ascii=False)
print('ipa', len(out), 'missing', len(miss), miss)
