// ==UserScript==
// @name         Banshee 出品情報グラバー
// @namespace    https://banshee.local/
// @version      1.0.0
// @description  メルカリ/ラクマ/ヤフフリ/ヤフオクの商品ページから型番・素材・サイズ等の事実情報と画像URLを拾い、Banshee出品文ジェネレーターへ渡す
// @match        https://jp.mercari.com/item/*
// @match        https://fril.jp/item/*
// @match        https://item.fril.jp/*
// @match        https://paypayfleamarket.yahoo.co.jp/item/*
// @match        https://auctions.yahoo.co.jp/jp/auction/*
// @updateURL    https://irielifereggaemusic0125-eng.github.io/research-viewer/banshee_listing_grab.user.js
// @downloadURL  https://irielifereggaemusic0125-eng.github.io/research-viewer/banshee_listing_grab.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/* 使い方: 商品ページ右下の「📝 出品文へ」を押すと、出品文ジェネレーターが新規タブで開き
   フォームに事実情報が入った状態になる。画像URLも一覧で渡す。

   方針: 拾うのは**事実情報だけ**（型番/素材/サイズ/カラー/付属品/定価）。
   相手の文章・キャッチコピー・ハッシュタグ・古物商番号は渡さない（丸写しは規約と著作権の問題so）。
   画像は「URLの一覧」を渡すだけで、自動ダウンロードはしない。 */

(function () {
  'use strict';
  const APP = 'https://irielifereggaemusic0125-eng.github.io/research-viewer/listing.html';

  const site = () => {
    const h = location.hostname;
    if (h.includes('mercari')) return 'メルカリ';
    if (h.includes('fril')) return 'ラクマ';
    if (h.includes('paypayfleamarket')) return 'ヤフフリ';
    if (h.includes('auctions.yahoo')) return 'ヤフオク';
    return '不明';
  };
  const meta = (sel) => (document.querySelector(sel) || {}).content || '';
  const mainText = () => (document.querySelector('main') || document.body).innerText || '';

  function descText() {
    const t = mainText();
    for (const [s, e] of [['商品の説明', '商品の情報'], ['商品説明', '商品の情報'],
                          ['商品の説明', 'この商品を'], ['商品説明', '配送について']]) {
      const i = t.indexOf(s), j = t.indexOf(e);
      if (i >= 0) return t.slice(i + s.length, j > i ? j : i + 2500).trim();
    }
    return t.slice(0, 2500);
  }

  function grab(re, src) { const m = src.match(re); return m ? m[1].trim().replace(/[　\s]+$/, '').slice(0, 60) : ''; }

  function extract() {
    const d = descText();
    const title = meta('meta[property="og:title"]') || document.title;
    const price = (meta('meta[property="product:price:amount"]')
      || (mainText().match(/[¥￥]\s*([\d,]{4,9})/) || [])[1] || '').replace(/[^\d]/g, '');

    // 画像URL（サムネの重複を除き、可能なら大きい版に寄せる）
    // 商品写真だけを拾う。出品者アイコン(/members/)・UI素材は除外し、原寸(/orig/)を優先する
    const all = [...document.querySelectorAll('img')].map(i => i.src)
      .filter(u => /^https?:/.test(u))
      .filter(u => !/icon|logo|avatar|profile|sprite|badge|members\//i.test(u))
      .map(u => u.replace(/\?.*$/, ''));
    const orig = all.filter(u => /\/orig\/|\/detail\//.test(u));
    const imgs = [...new Set(orig.length ? orig : all)].slice(0, 20);

    return {
      src: site(),
      raw: d,                                  // 元テキスト（アプリ側の手動抽出用に保持）
      name:   grab(/(?:モデル名?|商品名|アイテム名)\s*[:：]\s*([^\n]+)/, d),
      model:  grab(/(?:型番|品番|型式|モデル番号|参照番号|Ref)\s*[:：]\s*([^\n]+)/, d),
      mat:    grab(/(?:素材|材質|マテリアル|Material)\s*[:：]\s*([^\n]+)/, d),
      size:   grab(/(?:サイズ|SIZE|Size)\s*[:：]\s*([^\n]+)/, d),
      color:  grab(/(?:カラー|色|Color)\s*[:：]\s*([^\n]+)/, d),
      acc:    grab(/(?:付属品|付属)\s*[:：]\s*([^\n]+)/, d),
      retail: grab(/(?:参考定価|定価|新品価格|希望小売価格)\s*[:：]\s*([^\n]+)/, d),
      wt:     grab(/(?:重量|重さ|Weight)\s*[:：]\s*([^\n]+)/, d),
      meas:   grab(/(?:全長|実寸|実測|縦|横|幅)\s*[:：]\s*([^\n]+)/, d),
      bEn:    grab(/(?:ブランド名?|BRAND|Brand)\s*[:：]\s*([^\n]+)/, d),
      cond:   (d.split(/[。\n]/).map(s => s.trim())
                .filter(s => s && s.length < 90 && /(傷|キズ|スレ|擦れ|汚れ|使用感|美品|良品|ダメージ|くすみ|目立|状態)/.test(s))
                .filter(s => !/^[#＃]/.test(s) && !/古物商|許可証|即購入|値下げ|発送|フォロー|プロフィール/.test(s))
                .slice(0, 3).join('。') || ''),
      price: price,
      images: imgs,
      _title: title
    };
  }

  function send() {
    const o = extract();
    const filled = ['name','model','mat','size','color','acc','retail','wt','meas','bEn','cond']
      .filter(k => o[k]).length;
    const json = JSON.stringify(o);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    if (b64.length > 60000) { alert('データが大きすぎます。説明文が長い商品は手動でコピーしてください。'); return; }
    window.open(APP + '#d=' + encodeURIComponent(b64), '_blank');
    note(`${filled}項目 + 画像${o.images.length}枚 を渡しました`);
  }

  function copyOnly() {
    const o = extract();
    navigator.clipboard.writeText(o.raw).then(() => note('説明文をコピーしました（アプリの「他セラーの説明文から取り込む」に貼付）'))
      .catch(() => note('コピーできませんでした'));
  }

  let noteEl;
  function note(t) {
    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.style.cssText = 'position:fixed;right:14px;bottom:104px;z-index:2147483647;background:#000;color:#fff;' +
        'padding:9px 14px;border-radius:16px;font-size:12px;max-width:260px;opacity:0;transition:.25s;pointer-events:none';
      document.body.appendChild(noteEl);
    }
    noteEl.textContent = t; noteEl.style.opacity = '.94';
    setTimeout(() => { noteEl.style.opacity = '0'; }, 2600);
  }

  function ui() {
    if (document.getElementById('bs-grab')) return;
    const wrap = document.createElement('div');
    wrap.id = 'bs-grab';
    wrap.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;display:flex;flex-direction:column;gap:7px';
    const mk = (label, bg, fg, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `min-height:42px;padding:0 16px;border-radius:21px;border:none;background:${bg};color:${fg};` +
        'font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35);font-family:-apple-system,sans-serif';
      b.onclick = fn;
      return b;
    };
    wrap.appendChild(mk('📝 出品文へ', 'linear-gradient(180deg,#ffa41c,#ff8f00)', '#1a1300', send));
    wrap.appendChild(mk('📋 説明文コピー', '#333', '#eee', copyOnly));
    document.body.appendChild(wrap);
  }

  ui();
  new MutationObserver(() => ui()).observe(document.body, { childList: true, subtree: false });
})();
