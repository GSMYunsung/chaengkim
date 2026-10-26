#!/usr/bin/env python3
"""Builds one self-contained report page (report.html) for a Maestro run folder.

Usage: report.py maestro-report/<run>
Reads results.json, each scenario's log.txt and screenshots; embeds screenshots as small JPEGs.
"""
import base64, datetime, glob, html, json, os, re, subprocess, sys, tempfile

run = sys.argv[1]
results = json.load(open(os.path.join(run, 'results.json'), encoding='utf-8'))


def thumb(png: str) -> str:
    """Screenshot → 360px-wide JPEG data URI (sips ships with macOS)."""
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 't.jpg')
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '--resampleWidth', '360',
                        png, '--out', out], capture_output=True, check=False)
        data = open(out if os.path.exists(out) else png, 'rb').read()
    kind = 'jpeg' if os.path.exists(out) else 'png'
    return f'data:image/{kind};base64,' + base64.b64encode(data).decode()


def failure_reason(log: str) -> str:
    lines = [re.sub(r'\x1b\[[0-9;]*m', '', l).rstrip() for l in log.splitlines()]
    keep = [l.strip() for l in lines if re.search(r'FAILED|not found|Assertion|is not visible|Error|❌', l)]
    return '\n'.join(dict.fromkeys(keep[-6:])) or '\n'.join(l for l in lines[-8:] if l.strip())


def caption(png: str) -> str:
    name = os.path.splitext(os.path.basename(png))[0]
    return re.sub(r'^\d+-', '', name).replace('-', ' ')


cards = []
for r in results:
    folder = os.path.join(run, r['id'])
    shots = sorted(p for p in glob.glob(os.path.join(folder, '**', '*.png'), recursive=True))
    log = open(os.path.join(folder, 'log.txt'), encoding='utf-8', errors='replace').read() \
        if os.path.exists(os.path.join(folder, 'log.txt')) else ''
    reason = '' if r['status'] == 'pass' else failure_reason(log)
    figs = ''.join(
        f'<figure><img src="{thumb(p)}" alt="{html.escape(caption(p))}" loading="lazy">'
        f'<figcaption>{html.escape(caption(p))}</figcaption></figure>'
        for p in shots)
    cards.append(f'''
<article class="case {r['status']}" id="{html.escape(r['id'])}">
  <header>
    <span class="pill {r['status']}">{'통과' if r['status'] == 'pass' else '실패'}</span>
    <h2>{html.escape(r['title'])}</h2>
    <span class="secs">{r['seconds']}초</span>
  </header>
  {f'<pre class="reason">{html.escape(reason)}</pre>' if reason else ''}
  {f'<div class="shots">{figs}</div>' if figs else '<p class="none">스크린샷 없음</p>'}
</article>''')

passed = sum(r['status'] == 'pass' for r in results)
failed = len(results) - passed
total = sum(r['seconds'] for r in results)
stamp = os.path.basename(run.rstrip('/'))
try:
    when = datetime.datetime.strptime(stamp, '%Y%m%d-%H%M%S').strftime('%Y년 %m월 %d일 %H:%M')
except ValueError:
    when = stamp
verdict = '모든 시나리오 통과' if failed == 0 else f'{failed}개 시나리오 실패'

page = f'''<title>챙김 화면 테스트</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: a run summary on top, then one card per scenario in run order with its screenshots in a row. */
:root {{
  --bg: #f6f7fb; --surface: #ffffff; --ink: #1f2330; --sub: #5f6678; --line: #e2e5ee;
  --accent: #3e4fff; --pass: #13795b; --pass-bg: #e3f5ee; --fail: #b4232c; --fail-bg: #fde8e8;
  --body: 'IBM Plex Sans KR', 'Apple SD Gothic Neo', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #12141b; --surface: #1b1e28; --ink: #eceef5; --sub: #a3a9b8; --line: #2c3040;
  --accent: #8a95ff; --pass: #5fd3a8; --pass-bg: #163329; --fail: #ff8f8f; --fail-bg: #3a1c1f; color-scheme: dark;
}} }}
:root[data-theme="dark"] {{
  --bg: #12141b; --surface: #1b1e28; --ink: #eceef5; --sub: #a3a9b8; --line: #2c3040;
  --accent: #8a95ff; --pass: #5fd3a8; --pass-bg: #163329; --fail: #ff8f8f; --fail-bg: #3a1c1f; color-scheme: dark;
}}
body {{ background: var(--bg); color: var(--ink); font-family: var(--body); line-height: 1.55;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 28px 48px; }}
main {{ max-width: 1040px; margin: 0 auto; display: grid; gap: 14px; }}
.top {{ display: grid; gap: 10px; margin-bottom: 8px; }}
.top h1 {{ font-size: 28px; line-height: 1.2; margin: 0; letter-spacing: -0.02em; text-wrap: balance; }}
.meta {{ color: var(--sub); font-size: 14px; margin: 0; }}
.verdict {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }}
.chip {{ font: 600 13px var(--body); padding: 5px 11px; border-radius: 999px; background: var(--surface);
  border: 1px solid var(--line); font-variant-numeric: tabular-nums; }}
.chip.big {{ font-size: 15px; }}
.chip.pass {{ color: var(--pass); background: var(--pass-bg); border-color: transparent; }}
.chip.fail {{ color: var(--fail); background: var(--fail-bg); border-color: transparent; }}
.case {{ background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px;
  display: grid; gap: 12px; min-width: 0; }}
.case.fail {{ border-color: var(--fail); }}
.case header {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }}
.case h2 {{ font-size: 16px; margin: 0; flex: 1; min-width: 0; }}
.pill {{ font: 600 12px var(--body); padding: 3px 9px; border-radius: 999px; }}
.pill.pass {{ color: var(--pass); background: var(--pass-bg); }}
.pill.fail {{ color: var(--fail); background: var(--fail-bg); }}
.secs {{ color: var(--sub); font: 500 12px var(--mono); font-variant-numeric: tabular-nums; }}
.reason {{ margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--fail-bg); color: var(--fail);
  font: 500 12px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }}
.shots {{ display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }}
figure {{ margin: 0; flex: 0 0 auto; width: 150px; display: grid; gap: 6px; }}
figure img {{ width: 100%; border-radius: 12px; border: 1px solid var(--line); display: block; }}
figcaption {{ font-size: 12px; color: var(--sub); }}
.none {{ margin: 0; font-size: 13px; color: var(--sub); }}
a {{ color: var(--accent); }}
</style>
<main>
  <section class="top">
    <h1>챙김 화면 테스트</h1>
    <p class="meta">{html.escape(when)} · iOS 시뮬레이터 · 개발 빌드 · Maestro · 총 {total}초</p>
    <div class="verdict">
      <span class="chip big {'pass' if failed == 0 else 'fail'}">{verdict}</span>
      <span class="chip pass">통과 {passed}</span>
      <span class="chip {'fail' if failed else ''}">실패 {failed}</span>
      <span class="chip">시나리오 {len(results)}</span>
    </div>
  </section>
  {''.join(cards)}
</main>
'''
open(os.path.join(run, 'report.html'), 'w', encoding='utf-8').write(page)
print(f'{passed}/{len(results)} passed')
