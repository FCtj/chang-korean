# 영어판 발음(IPA): 강세 표시(ˈ ˌ)를 음절 첫 자음 묶음 앞으로 (kˈlaɪənt → ˈklaɪənt, əpˈruv → əˈpruv)
# 최대 두음 원칙: 강세 앞뒤 자음 묶음 중 영어 음절 첫머리로 올 수 있는 가장 긴 끝부분 앞에 강세
import os as _os
ROOT = _os.getcwd()  # 저장소 루트에서 실행
WORK = _os.environ.get('CK_WORK', ROOT + '/tools/_work')  # 내려받은 원본·중간 결과 (git 밖)
import glob, re, sys
VOW = set('aeiouæɑɔəɛɪʊʌɜɝɚɒ')
MARK = set('ˈˌ')
ONSETS = {
    'pr', 'br', 'tr', 'dr', 'kr', 'gr', 'fr', 'θr', 'ʃr', 'pl', 'bl', 'kl', 'gl', 'fl', 'sl',
    'sp', 'st', 'sk', 'sm', 'sn', 'sw', 'sf', 'tw', 'kw', 'dw', 'gw', 'θw', 'sw',
    'pj', 'bj', 'kj', 'fj', 'mj', 'hj', 'vj', 'nj', 'gj',
    'spr', 'str', 'skr', 'spl', 'skw', 'skj', 'spj',
}

def tokens(s):
    out, i = [], 0
    while i < len(s):
        if s[i:i + 2] in ('tʃ', 'dʒ'):
            out.append(s[i:i + 2]); i += 2
        else:
            out.append(s[i]); i += 1
    return out

def is_cons(t):
    return t not in MARK and t != 'ː' and t != ' ' and not any(ch in VOW for ch in t) and t not in '-.'

def onset_ok(ts):
    if len(ts) <= 1:
        return len(ts) == 0 or ts[0] not in ('ŋ',)
    return ''.join(ts) in ONSETS

def fix(ipa):
    t = tokens(ipa)
    changed = True
    while changed:
        changed = False
        for i, tk in enumerate(t):
            if tk not in MARK:
                continue
            # 강세 앞 자음들
            j = i
            while j > 0 and is_cons(t[j - 1]):
                j -= 1
            before = t[j:i]
            k = i + 1
            while k < len(t) and is_cons(t[k]):
                k += 1
            after = t[i + 1:k]
            if not before:
                continue
            cluster = before + after
            word_start = j == 0 or t[j - 1] == ' '
            # 단어 첫머리면 자음 전부, 아니면 가능한 가장 긴 두음
            best = len(after)
            for n in range(len(cluster), len(after), -1):
                if word_start and n == len(cluster):
                    best = n; break
                if onset_ok(cluster[len(cluster) - n:]):
                    best = n; break
            move = best - len(after)
            if move > 0:
                new_pos = i - move
                t.pop(i)
                t.insert(new_pos, tk)
                changed = True
                break
    return ''.join(t)

if __name__ == '__main__':
    write = '--write' in sys.argv
    R = re.compile(r"(\['(?:[^'\\]|\\.)*', ')((?:[^'\\]|\\.)*)(', ')")
    total = 0
    for f in sorted(glob.glob(ROOT + '/src/data/en/*.ts')):
        s = open(f, encoding='utf8').read()
        n = [0]
        samples = []
        def rep(m):
            new = fix(m.group(2))
            if new != m.group(2):
                n[0] += 1
                if len(samples) < 6:
                    samples.append(f'{m.group(2)}→{new}')
            return m.group(1) + new + m.group(3)
        s2 = R.sub(rep, s)
        total += n[0]
        print(f.split('/')[-1], n[0], ' '.join(samples))
        if write:
            open(f, 'w', encoding='utf8').write(s2)
    print('total', total, '(write)' if write else '(preview)')
