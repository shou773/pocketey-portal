#!/usr/bin/env python3
"""
Build the static pocketey.com site.

One page per language under /<lang>/, each fully rendered in that language
with hreflang alternates, plus root redirect, privacy, disclosure,
sitemap.xml and robots.txt.

Usage:  python3 build.py          -> writes ./dist
"""
import json, os, re, shutil, datetime

DOMAIN = "https://pocketey.com"
ORDER = ["en", "fr", "zh", "ko", "ja"]
HREF = {"en": "en", "fr": "fr", "zh": "zh-Hans", "ko": "ko", "ja": "ja"}
SRC = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(SRC, "dist")

L = json.load(open(os.path.join(SRC, "strings.json"), encoding="utf-8"))

# ---------- per-language page furniture ----------
META = {
 "en": ("Volumetric weight calculator for shipping from Japan",
        "Work out the chargeable weight of a parcel sent from Japan. Japan Post divides by 6000, couriers by 5000 — see all three, in five languages.",
        "Privacy", "Affiliate disclosure"),
 "fr": ("Calculateur de poids volumétrique pour les envois depuis le Japon",
        "Calculez le poids facturé d'un colis expédié depuis le Japon. Japan Post divise par 6000, les expressistes par 5000.",
        "Confidentialité", "Divulgation d'affiliation"),
 "zh": ("从日本寄件的体积重量计算器",
        "计算从日本寄出包裹的计费重量。日本邮政除以6000，快递公司除以5000——三者并列显示。",
        "隐私政策", "联盟披露"),
 "ko": ("일본 발송 부피 무게 계산기",
        "일본에서 보내는 소포의 청구 무게를 계산합니다. 일본우편은 6000, 특송사는 5000으로 나눕니다.",
        "개인정보", "제휴 고지"),
 "ja": ("日本からの発送の容積重量計算機",
        "日本から送る荷物の請求重量を計算します。日本郵便は6000、国際宅配便は5000で割ります。",
        "プライバシー", "アフィリエイト開示"),
}

DISCLOSE = {
 "en": "Some links on this site are affiliate links. If you use one, this site may earn a commission at no additional cost to you. It does not change the numbers above — the divisors are published industry standards, not opinions.",
 "fr": "Certains liens de ce site sont des liens d'affiliation. Si vous les utilisez, ce site peut percevoir une commission, sans coût supplémentaire pour vous. Cela ne change rien aux chiffres ci-dessus : les diviseurs sont des standards publiés, pas des opinions.",
 "zh": "本站部分链接为联盟链接。通过这些链接产生的交易，本站可能获得佣金，而您无需支付额外费用。这不会改变上方的计算结果——除数是公开的行业标准，并非本站的意见。",
 "ko": "이 사이트의 일부 링크는 제휴 링크입니다. 이용하시면 추가 비용 없이 이 사이트가 수수료를 받을 수 있습니다. 위 계산 결과는 달라지지 않습니다 — 제수는 공개된 업계 표준입니다.",
 "ja": "本サイトの一部のリンクはアフィリエイトリンクです。ご利用いただいた場合、追加費用なしに本サイトが報酬を得ることがあります。上の計算結果は変わりません。除数は公開された業界標準の値です。",
}

PRIVACY = {
 "en": ("Privacy", "This site stores nothing about you. There is no account, no login, and no email field. Everything you type into the calculator is processed in your own browser and is never sent to a server.",
        "Analytics", "A privacy-focused analytics script counts page views and which language version was viewed. It does not use cookies and does not identify individual visitors.",
        "Outbound links", "Links to shipping companies and government sites lead to third parties with their own privacy policies. This site has no control over them."),
 "fr": ("Confidentialité", "Ce site ne conserve rien vous concernant. Aucun compte, aucune connexion, aucun champ e-mail. Tout ce que vous saisissez est traité dans votre navigateur et n'est jamais envoyé à un serveur.",
        "Mesure d'audience", "Un script de mesure respectueux de la vie privée compte les pages vues et la version linguistique consultée. Il n'utilise pas de cookies et n'identifie personne.",
        "Liens sortants", "Les liens vers les transporteurs et les sites officiels mènent à des tiers ayant leurs propres politiques. Ce site n'a aucun contrôle sur elles."),
 "zh": ("隐私政策", "本站不保存任何关于您的信息。没有账户、没有登录、没有邮箱输入框。您在计算器中输入的一切都在您自己的浏览器中处理，不会发送到服务器。",
        "访问统计", "本站使用注重隐私的统计脚本，仅统计页面浏览量与所查看的语言版本。不使用 Cookie，也不识别个人访客。",
        "外部链接", "指向物流公司与政府网站的链接属于第三方，各有其隐私政策，本站无法控制。"),
 "ko": ("개인정보", "이 사이트는 귀하에 관한 어떤 정보도 저장하지 않습니다. 계정도, 로그인도, 이메일 입력란도 없습니다. 계산기에 입력한 내용은 모두 브라우저 안에서 처리되며 서버로 전송되지 않습니다.",
        "방문 분석", "개인정보를 수집하지 않는 분석 스크립트가 페이지 조회수와 열람된 언어 버전만 집계합니다. 쿠키를 사용하지 않으며 개별 방문자를 식별하지 않습니다.",
        "외부 링크", "운송사 및 정부 사이트로의 링크는 자체 정책을 가진 제3자로 연결됩니다. 본 사이트는 이를 통제하지 않습니다."),
 "ja": ("プライバシー", "本サイトは利用者に関する情報を一切保存しません。アカウントもログインもメールアドレスの入力欄もありません。計算機に入力した内容はすべてブラウザ内で処理され、サーバーに送信されることはありません。",
        "アクセス解析", "プライバシーに配慮した解析スクリプトが、ページビュー数と閲覧された言語版のみを集計します。Cookieは使用せず、個々の訪問者を識別しません。",
        "外部リンク", "配送会社や政府機関へのリンクは第三者のサイトであり、それぞれ独自のプライバシーポリシーがあります。本サイトは관여しません。"),
}
# fix a stray character in the ja privacy text
PRIVACY["ja"] = PRIVACY["ja"][:-1] + ("本サイトは関与しません。",)

LINKS = [
 ("Japan Post — international mail", "post.japanpost.jp", "https://www.post.japanpost.jp/int/index_en.html"),
 ("Japan Post — size and weight limits by country", "post.japanpost.jp", "https://www.post.japanpost.jp/int/service/dimension.html"),
 ("Japan Customs — export", "customs.go.jp", "https://www.customs.go.jp/english/"),
]

CSS = open(os.path.join(SRC, "site.css"), encoding="utf-8").read()
CALC_JS = open(os.path.join(SRC, "calc.js"), encoding="utf-8").read()


def hreflang_tags(page):
    """page is '' for the tool, or 'privacy'/'disclosure'."""
    tags = []
    for lang in ORDER:
        href = f"{DOMAIN}/{lang}/" + (f"{page}.html" if page else "")
        tags.append(f'<link rel="alternate" hreflang="{HREF[lang]}" href="{href}">')
    tags.append(f'<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/'
                + (f'{page}.html' if page else '') + '">')
    return "\n".join(tags)


def lang_switcher(cur, page):
    out = []
    for lang in ORDER:
        href = f"/{lang}/" + (f"{page}.html" if page else "")
        cls = ' aria-current="true"' if lang == cur else ""
        out.append(f'<a href="{href}"{cls}>{L[lang]["name"]}</a>')
    return "".join(out)


def head(lang, title, desc, page, canonical_page=""):
    return f"""<!DOCTYPE html>
<html lang="{HREF[lang]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{DOMAIN}/{lang}/{canonical_page}">
{hreflang_tags(page)}
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{DOMAIN}/{lang}/{canonical_page}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500;600&family=Inter:wght@400;500;600&family=Noto+Sans+JP:wght@400;500&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+KR:wght@400;500&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
"""


def tool_page(lang):
    t = L[lang]
    title, desc, privacy_label, disclose_label = META[lang]
    links = "".join(
        f'<a href="{u}" target="_blank" rel="noopener"><strong>{n}</strong><em>{d}</em></a>'
        for n, d, u in LINKS)
    return head(lang, title, desc, "") + f"""
<div class="hero"><div class="wrap">
  <nav class="langs">{lang_switcher(lang, "")}</nav>
  <div class="mark">Pocketey <span>/ ship</span></div>
  <h1>{t['h1']}</h1>
  <p>{t['lede']}</p>
</div></div>

<div class="wrap"><main>
  <div class="calc">
    <div class="row">
      <div class="f"><label for="l">{t['lL']}</label><input id="l" type="number" inputmode="decimal" value="38"></div>
      <div class="f"><label for="w">{t['lW']}</label><input id="w" type="number" inputmode="decimal" value="26"></div>
      <div class="f"><label for="h">{t['lH']}</label><input id="h" type="number" inputmode="decimal" value="26"></div>
    </div>
    <div class="f"><label for="kg">{t['lKg']}</label><input id="kg" type="number" inputmode="decimal" value="1.5" step="0.1"></div>
    <p class="hint">{t['hint']}</p>
    <div class="result" id="result"></div>
  </div>

  <section class="blk">
    <h2>{t['linksH']}</h2>
    <p class="blurb">{t['linksB']}</p>
    <div class="links">{links}</div>
  </section>

  <p class="note">{t['note']}</p>
  <p class="note">{DISCLOSE[lang]}</p>
  <footer>
    <a href="privacy.html">{privacy_label}</a> · <a href="disclosure.html">{disclose_label}</a><br>
    © {datetime.date.today().year} Pocketey
  </footer>
</main></div>

<script>
const T = {json.dumps({k: t[k] for k in
    ['charged','weighed','real','air','vBad','vMid','vOk','svc','div','billed','c','tip']},
    ensure_ascii=False)};
{CALC_JS}
</script>
</body>
</html>
"""


def simple_page(lang, kind):
    title, desc, privacy_label, disclose_label = META[lang]
    if kind == "privacy":
        p = PRIVACY[lang]
        heading = p[0]
        body = (f"<p>{p[1]}</p><h2>{p[2]}</h2><p>{p[3]}</p>"
                f"<h2>{p[4]}</h2><p>{p[5]}</p>")
    else:
        heading = disclose_label
        body = f"<p>{DISCLOSE[lang]}</p>"
    return head(lang, f"{heading} — Pocketey", desc, kind, f"{kind}.html") + f"""
<div class="hero slim"><div class="wrap">
  <nav class="langs">{lang_switcher(lang, kind)}</nav>
  <div class="mark"><a href="./">Pocketey <span>/ ship</span></a></div>
</div></div>
<div class="wrap"><main class="prose">
  <h1>{heading}</h1>
  {body}
  <footer><a href="./">← Pocketey</a><br>© {datetime.date.today().year} Pocketey</footer>
</main></div>
</body>
</html>
"""


def build():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)


    for lang in ORDER:
        d = os.path.join(DIST, lang)
        os.makedirs(d)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(tool_page(lang))
        open(os.path.join(d, "privacy.html"), "w", encoding="utf-8").write(simple_page(lang, "privacy"))
        open(os.path.join(d, "disclosure.html"), "w", encoding="utf-8").write(simple_page(lang, "disclosure"))

    # root: redirect to the visitor's language when we recognise it, else English
    root = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pocketey</title>
<link rel="canonical" href="%s/en/">
%s
<script>
var m={"fr":"fr","zh":"zh","ko":"ko","ja":"ja"};
var l=(navigator.language||"en").toLowerCase().split("-")[0];
location.replace("/"+(m[l]||"en")+"/");
</script>
<meta http-equiv="refresh" content="0; url=/en/">
</head>
<body><p><a href="/en/">Continue to Pocketey</a></p></body>
</html>
""" % (DOMAIN, hreflang_tags(""))
    open(os.path.join(DIST, "index.html"), "w", encoding="utf-8").write(root)

    today = datetime.date.today().isoformat()
    urls = []
    for page in ["", "privacy", "disclosure"]:
        for lang in ORDER:
            loc = f"{DOMAIN}/{lang}/" + (f"{page}.html" if page else "")
            alts = "".join(
                f'\n    <xhtml:link rel="alternate" hreflang="{HREF[o]}" '
                f'href="{DOMAIN}/{o}/{page + ".html" if page else ""}"/>'
                for o in ORDER)
            alts += (f'\n    <xhtml:link rel="alternate" hreflang="x-default" '
                     f'href="{DOMAIN}/en/{page + ".html" if page else ""}"/>')
            urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{today}</lastmod>{alts}\n  </url>")
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
               '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
               + "\n".join(urls) + "\n</urlset>\n")
    open(os.path.join(DIST, "sitemap.xml"), "w", encoding="utf-8").write(sitemap)

    open(os.path.join(DIST, "robots.txt"), "w", encoding="utf-8").write(
        f"User-agent: *\nAllow: /\n\nSitemap: {DOMAIN}/sitemap.xml\n")

    n = sum(len(f) for _, _, f in os.walk(DIST))
    print(f"built {n} files into {DIST}")


if __name__ == "__main__":
    build()
