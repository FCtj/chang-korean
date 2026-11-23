# 일본어 예문 가나 읽기 대조 (SudachiPy) — 사용: from jread import same
import re, warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)
from sudachipy import dictionary
_tok = dictionary.Dictionary().create()
P = re.compile(r'[\s、。？！「」『』〜～…（）()・,.?!:：%％0-9０-９A-Za-zＡ-Ｚａ-ｚー]')
VAR = [('ワタクシ', 'ワタシ'), ('ニッポン', 'ニホン'), ('アス', 'アシタ'), ('ナニ', 'ナ@'), ('ナン', 'ナ@'), ('コンニチ', 'キョウ'), ('サクジツ', 'キノウ'), ('ミョウニチ', 'アシタ'), ('ヒトリ', 'ヒトリ'), ('ジュウブン', 'ジュウブン')]
def kata(s): return ''.join(chr(ord(c)+0x60) if 'ぁ'<=c<='ゖ' else c for c in s)
def norm(s):
    s = P.sub('', kata(s))
    for a, b in VAR: s = s.replace(a, b)
    return s
def sudachi(ex): return ''.join(m.reading_form() for m in _tok.tokenize(ex))
def same(ex, rom):
    a, b = norm(rom), norm(sudachi(ex))
    return a == b, b
