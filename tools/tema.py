"""Ubah blok @media (prefers-color-scheme: dark) supaya bisa dipaksa lewat <html data-theme="light|dark">.

  - tanpa data-theme  -> ikut pengaturan HP (seperti dulu)
  - data-theme="dark" -> selalu gelap
  - data-theme="light"-> selalu terang

Setiap blok gelap menjadi dua:
  @media (prefers-color-scheme: dark) { html:not([data-theme="light"]) SEL { ... } }
  html[data-theme="dark"] SEL { ... }
Dijalankan sekali per file (berhenti kalau file sudah pernah diubah).
"""
import re, sys

AUTO = ':not([data-theme="light"])'
FORCE = '[data-theme="dark"]'
MEDIA = '@media (prefers-color-scheme: dark) {'


def block_end(s, i):
    """i = posisi '{' pembuka; kembalikan posisi '}' penutup yang cocok."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return j
    raise ValueError('kurung tidak seimbang')


def split_sel(sel):
    out, depth, cur = [], 0, ''
    for ch in sel:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ',' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    out.append(cur)
    return [x.strip() for x in out if x.strip()]


def prefix(sel, cond):
    res = []
    for s in split_sel(sel):
        if s.startswith(':root'): res.append('html' + cond + s[5:])
        elif re.match(r'html(?![\w-])', s): res.append('html' + cond + s[4:])
        else: res.append('html' + cond + ' ' + s)
    return ', '.join(res)


def rules(body, cond):
    out, i = [], 0
    while True:
        k = body.find('{', i)
        if k < 0: break
        e = block_end(body, k)
        sel = body[i:k].strip()
        out.append(prefix(sel, cond) + ' {' + body[k + 1:e] + '}')
        i = e + 1
    return out


def convert(css):
    if 'data-theme' in css: return css, 0
    out, i, n = '', 0, 0
    while True:
        k = css.find(MEDIA, i)
        if k < 0: out += css[i:]; break
        o = k + len(MEDIA) - 1
        e = block_end(css, o)
        body = css[o + 1:e]
        auto = rules(body, AUTO); force = rules(body, FORCE)
        out += css[i:k] + MEDIA + '\n  ' + '\n  '.join(auto) + '\n}\n' + '\n'.join(force)
        i = e + 1; n += 1
    return out, n


if __name__ == '__main__':
    for f in sys.argv[1:]:
        css = open(f).read()
        new, n = convert(css)
        open(f, 'w').write(new)
        print(f, n, 'blok')
