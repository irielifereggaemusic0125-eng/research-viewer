'use strict';
// Banshee 出品文ジェネレーター v1.0 (2026-08-19)
// 仕様: Banshee 商品説明生成ルール仕様書 v1.0 / 実物(m77773408928)の構造を実測して再現

const RULE = '―'.repeat(17);            // 通常の罫線 U+2015 ×17（実物と同一）
const KOBUTSU = '古物商許可証：愛知県公安委員会 第542652509100号';
const BANSHEE_TXT = '当ショップの商品は全て正規品です。古物商許可のもと、ブランド品を専門に扱う大手古物市場よりお譲りいただいております。';
let MODE = 'mercari', INV = [];

/* ── 日英変換（eBay用）。英語欄があればそれを最優先。
      辞書に無い日本語が残る値には ⚠ を付けて、気づかず日本語のまま出品するのを防ぐ。 ── */
const EN_DICT={'ブレスレット':'Bracelet','ネックレス':'Necklace','ペンダント':'Pendant','リング':'Ring','指輪':'Ring',
 'ピアス':'Earrings','イヤリング':'Earrings','バングル':'Bangle','チェーン':'Chain','財布':'Wallet','長財布':'Long Wallet',
 '三つ折り財布':'Trifold Wallet','二つ折り財布':'Bifold Wallet','バッグ':'Bag','ショルダーバッグ':'Shoulder Bag',
 'トートバッグ':'Tote Bag','ポーチ':'Pouch','サングラス':'Sunglasses','スカーフ':'Scarf','ストール':'Stole',
 'シルバー925':'Sterling Silver 925','シルバー':'Silver','レザー':'Leather','キャンバス':'Canvas','ナイロン':'Nylon',
 'ゴールド':'Gold','ホワイト':'White','ブラック':'Black','美品':'Excellent condition','新品':'New',
 'ドーヴ':'Dove','ヘロン':'Heron','クレーンベル':'Crane Bell','シルクリンク':'Silk Link','フロー':'Flow'};
const HAS_JP=s=>/[぀-ゟ゠-ヿ一-鿿]/.test(String(s));
function toEn(s){
  if(!s) return '';
  let out=String(s);
  Object.keys(EN_DICT).sort((a,b)=>b.length-a.length).forEach(k=>{ out=out.split(k).join(EN_DICT[k]); });
  out=out.replace(/\s+/g,' ').trim();
  return HAS_JP(out) ? '⚠ '+out : out;
}


const $ = id => document.getElementById(id);
const v = id => ($(id) ? ($(id).value || '').trim() : '');
const n = id => { const x = parseInt(v(id).replace(/[^\d-]/g, ''), 10); return isNaN(x) ? 0 : x; };
const ck = id => $(id) && $(id).checked;

function tg(id){ const b=$(id), a=$('a-'+id); b.classList.toggle('hide'); a.classList.toggle('op'); }
function setMode(m){ MODE=m; $('tabM').classList.toggle('on',m==='mercari'); $('tabE').classList.toggle('on',m==='ebay');
  $('paneM').classList.toggle('hide',m!=='mercari'); $('paneE').classList.toggle('hide',m!=='ebay'); gen(); }
function toast(t){ const e=$('toast'); e.textContent=t; e.classList.add('on'); setTimeout(()=>e.classList.remove('on'),1600); }
function cp(id){ const e=$(id); e.select(); e.setSelectionRange(0,999999);
  (navigator.clipboard?navigator.clipboard.writeText(e.value):Promise.reject()).then(()=>toast('コピーしました'))
   .catch(()=>{ try{document.execCommand('copy');toast('コピーしました');}catch(x){toast('コピーできませんでした');} }); }

/* ── 利益と、末尾罫線＝利益インジケーター ───────────────────────
   線1本 = 利益¥1,000（端数切り捨て）／1〜9本=全角「─」／10本以上=半角「-」
   ※ 変えるのは**最後の罫線だけ**。他の罫線は常に RULE のまま。 */
function grossJP(){ return Math.round(n('price')*0.9) - n('ship') - n('cost'); }
function indicator(profit){
  const k = Math.floor(profit/1000);
  if (k <= 0) return RULE;                       // 利益ゼロ以下は通常罫線（マーカーを出さない）
  return (k <= 9 ? '─' : '-').repeat(k);
}

/* ── タイトル（40字以内） ─────────────────────────────── */
function buildTitle(){
  const parts=[v('bEn'), v('bJa'), v('name'), v('model'), v('size'), v('color')].filter(Boolean);
  let t = parts.join(' ').replace(/\s+/g,' ').trim();
  if (t.length > 40){                            // 後ろ（カラー→サイズ→型番）から落として40字に収める
    for (const drop of [v('color'), v('size'), v('model'), v('bJa')]){
      if (!drop) continue;
      t = t.replace(' '+drop,'').trim();
      if (t.length <= 40) break;
    }
  }
  return t.slice(0,40);
}

/* ── 説明文 ──────────────────────────────────────── */
function detailLines(){
  const L=[];
  const add=(k,val)=>{ if(val) L.push(k+'：'+val); };
  add('ブランド', v('bEn') && v('bJa') ? `${v('bEn')}（${v('bJa')}）` : (v('bEn')||v('bJa')));
  add('デザイナー', v('designer'));
  add('モデル', v('name'));
  add('品番', v('model'));
  add('サイズ', v('size'));
  add('素材', v('mat'));
  if (v('meas')) L.push('全長：'+v('meas')+'（実測）');
  if (v('wt'))   L.push('重量：'+v('wt')+'（実測）');
  add('カラー', v('color'));
  add('付属品', v('acc'));
  add('参考定価', v('retail'));
  return L;
}
function tagLine(){
  const raw = v('tags').split(/[\s　]+/).filter(Boolean).map(x=>x.replace(/^#/,''));
  if (!raw.length) return '';
  return raw.map(x=>'#'+x).join(' ');
}

function buildDesc(){
  const A = v('tpl')==='A';
  const useB = ck('useBanshee'), useT = ck('useTag');
  const P=[];
  P.push('ご覧いただきありがとうございます(^^)');
  P.push(RULE);
  const head=[ [v('bEn'),v('bJa')].filter(Boolean).join(' '), v('name'),
               [v('designer'),v('mat')].filter(Boolean).join(' ') ].filter(Boolean);
  P.push(head.join('\n'));
  P.push(RULE);
  if (v('intro')) P.push(v('intro'));
  if (v('extra')) P.push('\n'+v('extra'));
  if (v('enSum')) P.push('\n'+v('enSum'));
  if (A && useT) P.push('\n#全商品Banshee');
  P.push(RULE);
  P.push('【商品詳細】');
  P.push(RULE);
  P.push(detailLines().join('\n'));
  if (ck('isAppa')) P.push('※平置き実寸のため、多少の誤差はご了承ください');
  P.push(RULE);
  P.push('【状態／Condition】');
  P.push(RULE);
  P.push(v('cond'));
  if (v('enCond')) P.push('\n'+v('enCond'));
  if (A && useB){
    P.push(RULE);
    P.push('【Bansheeについて】');
    P.push(RULE);
    P.push(BANSHEE_TXT + '\n\n' + KOBUTSU);
  }
  P.push('__IND__');                                   // 最後の罫線＝利益インジケーター
  P.push('ご不明な点はお気軽にコメントください(^^)');
  const tl = tagLine();
  if (tl) P.push('\n'+tl);
  return P.join('\n').replace('__IND__', indicator(grossJP()));
}

/* ── 1000字超過時の自動圧縮（仕様の優先順位どおり） ──────────── */
function compress(){
  const steps=[
    ()=>{ if(v('enSum')){ $('enSum').value=''; return '英語サマリーを削除'; } },
    ()=>{ const t=v('tags').split(/[\s　]+/).filter(Boolean); const u=[...new Set(t)];
          if(u.length<t.length){ $('tags').value=u.join(' '); return '重複ハッシュタグを削除'; }
          if(u.length>8){ $('tags').value=u.slice(0,8).join(' '); return 'ハッシュタグを8個に削減'; } },
    ()=>{ if(v('extra')){ $('extra').value=''; return '補足文を削除'; } },
    ()=>{ if(v('color')){ $('color').value=''; return 'カラー欄を削除'; } },
    ()=>{ if(v('enCond')){ $('enCond').value=''; return '英語（状態）を削除'; } },
  ];
  const done=[];
  for(const s of steps){
    if (buildDesc().length <= 1000) break;
    const r = s(); if (r) done.push(r);
  }
  gen();
  const len = $('outD').value.length;
  toast(done.length ? (done.join('／')+' → '+len+'字') : (len<=1000?'既に1000字以内です':'これ以上は自動削減できません'));
}

/* ── メルカリのカテゴリ提案 ───────────────────────────── */
function catHint(){
  const s = (v('name')+' '+v('mat')+' '+v('bEn')).toLowerCase();
  const m = [
    [/ブレスレット|バングル|bracelet/i, 'レディース > アクセサリー > ブレスレット（メンズ品ならメンズ > アクセサリー > ブレスレット）'],
    [/ネックレス|ペンダント|necklace/i, 'レディース > アクセサリー > ネックレス'],
    [/リング|指輪|ring/i, 'レディース > アクセサリー > リング(指輪)'],
    [/ピアス|イヤリング/i, 'レディース > アクセサリー > ピアス(片耳用/両耳用)'],
    [/財布|ウォレット|wallet/i, 'レディース > 小物 > 財布（長財布/折り財布を選択）'],
    [/バッグ|トート|ショルダー|bag/i, 'レディース > バッグ > ショルダーバッグ 等'],
    [/サングラス|メガネ|眼鏡/i, 'レディース > 小物 > サングラス/メガネ'],
    [/スカーフ|ストール|カレ/i, 'レディース > 小物 > バンダナ/スカーフ'],
    [/tシャツ|シャツ|トップス|スウェット|パーカー/i, 'メンズ or レディース > トップス > 該当種別'],
    [/時計|watch/i, 'メンズ > 時計 > 腕時計(アナログ)'],
    [/シフトノブ|カー|車/i, '自動車・オートバイ > 自動車パーツ > 内装品、シート'],
    [/homepod|スピーカー|マウス|トラックボール|キーボード/i, '家電・スマホ・カメラ > PC/タブレット or オーディオ機器'],
  ].find(([re])=>re.test(s));
  return m ? m[1] : '（商品名から判定できませんでした。メルカリの検索で同型番の出品がどのカテゴリかを確認してください）';
}

/* ── eBay ──────────────────────────────────────── */
function usdPrice(){
  const fx=parseFloat(v('fx'))||159.3;
  const ask=Math.round(n('price')*1.10);
  const u=Math.ceil((ask/fx)/5)*5-0.05;
  return {usd:u, jpy:Math.round(u*fx)};
}
function ebayRows(){
  const p=usdPrice();
  const fx=parseFloat(v('fx'))||159.3, fee=(parseFloat(v('fee'))||15)/100, ish=n('ishp')||4000;
  const net=Math.round(p.usd*fx*(1-fee)) - ish;
  const en=[v('bEn'), v('enName')||toEn(v('name')), v('enMat')||toEn(v('mat')), v('model'), v('size')].filter(Boolean).join(' ');
  const title=(en+' Japan').slice(0,80);
  return [
    ['Title', title, `${title.length}/80字。ブランド英を先頭・一般語で埋める`],
    ['Category', 'Jewelry & Watches > Fashion Jewelry > 該当種別', '迷ったら同型番の他出品のカテゴリを踏襲'],
    ['Condition', 'Pre-owned', '新品タグ付きなら New with tags'],
    ['Condition description', v('cond') ? '（日本語の状態メモを英訳して入れる）' : '未入力', '傷・くすみを正直に'],
    ['Brand', v('bEn') || '—', 'Item specifics の最重要項目'],
    ['Type', v('enName')||toEn(v('name')) || '—', 'Bracelet / Necklace / Ring 等。⚠ が付いたら英語欄に手入力する'],
    ['Material / Metal', v('enMat')||toEn(v('mat')) || '—', 'Sterling Silver 等。素材の誤りは返品理由になる'],
    ['Metal Purity', /925/.test(v('mat')) ? '925' : '—', ''],
    ['Length', v('meas') || '—', 'cm表記のまま可'],
    ['Total Weight', v('wt') || '—', ''],
    ['Model', v('model') || '—', ''],
    ['Department', 'Unisex Adult', ''],
    ['Country/Region of Manufacture', '（現物の刻印で確認）', '推測で入れない'],
    ['Photos', '12枚以上・白背景・刻印アップ必須', ''],
    ['Description', '下の HTML を貼付', 'iframe内はクリップボード貼付（cmd+a→cmd+v）が確実'],
    ['Format', 'Buy It Now / GTC（無期限）', ''],
    ['Price', `US $${p.usd.toFixed(2)}（≒¥${p.jpy.toLocaleString()}）`, `想定手取り ¥${net.toLocaleString()} / 粗利 ¥${(net-n('cost')).toLocaleString()}`],
    ['Best Offer', `自動承認 $${(p.usd*0.9).toFixed(0)} / 自動拒否 $${(p.usd*0.72).toFixed(0)} 未満`, '床(L)を下回らない額にする'],
    ['Quantity', '1', ''],
    ['Shipping', 'Standard Shipping from outside US（5〜10営業日）・送料無料', 'サービスは1つに統一。Economyは追跡不明so避ける'],
    ['Handling time', '2 business days', ''],
    ['Item location', 'Aichi, Japan', ''],
    ['Returns', 'アカウント設定に従う（説明文と矛盾させない）', ''],
    ['出品時刻', '13〜15時JST（米国夜）', '1〜2件/日。まとめ出しはBANリスク'],
  ];
}
function ebayHTML(){
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const rows=[['Brand',v('bEn')],['Model',v('enName')||toEn(v('name'))],['Material',v('enMat')||toEn(v('mat'))],['Length',v('meas')],
              ['Weight',v('wt')],['Included',v('acc')]].filter(r=>r[1]);
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:760px;line-height:1.65;color:#222">
<h2 style="margin:0 0 4px;font-size:20px">${esc(v('bEn'))} ${esc(v('enName')||toEn(v('name')))}</h2>
<p style="margin:0 0 18px;color:#666">Authentic pre-owned item, shipped from Japan.</p>
<h3 style="font-size:15px;border-bottom:1px solid #ddd;padding-bottom:6px">Details</h3>
<table style="border-collapse:collapse;font-size:14px">
${rows.map(r=>`  <tr><td style="padding:6px 14px 6px 0;color:#666">${esc(r[0])}</td><td style="padding:6px 0">${esc(r[1])}</td></tr>`).join('\n')}
</table>
<h3 style="font-size:15px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:22px">Condition</h3>
<p style="font-size:14px">${esc(v('enCond')||'Pre-owned. Please refer to the photos for details.')}</p>
<h3 style="font-size:15px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:22px">Authenticity</h3>
<p style="font-size:14px">Guaranteed authentic. We are a licensed secondhand dealer in Japan.<br>
Secondhand Dealer License: Aichi Prefectural Public Safety Commission No. 542652509100</p>
<h3 style="font-size:15px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:22px">Shipping</h3>
<p style="font-size:14px">Ships from Japan with tracking. Import duties and taxes are the buyer's responsibility.</p>
</div>`;
}
function cpEbay(){
  const t=ebayRows().map((r,i)=>`${i+1}. ${r[0]}\n   ${r[1]}`).join('\n');
  navigator.clipboard.writeText(t).then(()=>toast('入力ガイドをコピーしました')).catch(()=>toast('コピーできませんでした'));
}

/* ── 生成 ────────────────────────────────────────── */
function onTpl(){ const A=v('tpl')==='A'; $('useBanshee').checked=A; $('useTag').checked=A; gen(); }
function gen(){
  const t=buildTitle(), d=buildDesc();
  $('outT').value=t; $('outD').value=d;
  const cT=$('cT'), cD=$('cD');
  cT.textContent=`${t.length} / 40`; cT.className='cnt '+(t.length<=40&&t.length>0?'ok':'ng');
  cD.textContent=`${d.length} / 1000`; cD.className='cnt '+(d.length<=1000?'ok':'ng');
  const g=grossJP(), k=Math.floor(g/1000);
  $('profBox').innerHTML=`粗利（売値×0.9 − 送料 − 仕入）= <b>¥${g.toLocaleString()}</b>
    <div class="ind">末尾の罫線 → ${k>0?`${k}本（${k<=9?'全角─':'半角-'}）`:'利益ゼロ以下so通常罫線'}<br>${indicator(g)}</div>`;
  $('catHint').innerHTML='<b>メルカリ カテゴリ候補</b>：'+catHint();
  if (MODE==='ebay'){
    const p=usdPrice(), fx=parseFloat(v('fx'))||159.3, fee=(parseFloat(v('fee'))||15)/100, ish=n('ishp')||4000;
    const net=Math.round(p.usd*fx*(1-fee))-ish;
    $('profE').innerHTML=`出品 <b>US $${p.usd.toFixed(2)}</b>（≒¥${p.jpy.toLocaleString()}）／手取り ¥${net.toLocaleString()}／粗利 <b>¥${(net-n('cost')).toLocaleString()}</b>`;
    $('ebList').innerHTML=ebayRows().map((r,i)=>`<div class="eb-row"><div class="eb-n">${i+1}</div><div class="eb-b">
      <div class="eb-f">${r[0]}</div><div class="eb-v${/^\d|US \$/.test(r[1])?' mono':''}">${r[1]}</div>
      ${r[2]?`<div class="eb-hint">${r[2]}</div>`:''}</div></div>`).join('');
    $('outH').value=ebayHTML();
  }
}

/* ── 在庫読み込み ─────────────────────────────────── */
(async()=>{
  try{
    const r=await fetch('data/inventory.json?t='+Date.now(),{cache:'no-store'});
    const d=await r.json(); INV=d.items||[];
    const sel=$('kanri');
    INV.forEach((it,i)=>{ const o=document.createElement('option');
      o.value=String(i); o.textContent=`${it.kanri_no}  ${(it.name||'').slice(0,22)}`; sel.appendChild(o); });
    $('kanriNote').textContent=`在庫 ${INV.length}件を読み込みました（更新 ${d.updated_at||'-'}）`;
  }catch(e){ $('kanriNote').textContent='在庫データを読み込めませんでした（手入力で使えます）'; }
  gen();
})();
function pickKanri(){
  const i=$('kanri').value; if(i==='') return;
  const it=INV[+i]; if(!it) return;
  $('name').value=it.name||'';
  $('price').value=it.actual_price||it.list_price||'';
  $('cost').value=it.buy_price||'';
  if(it.souryo) $('ship').value=it.souryo;
  const cat=(it.category||'');
  $('tpl').value=/アパレル|古着|家電|カー|服/.test(cat)?'B':'A';
  $('isAppa').checked=/アパレル|古着|服/.test(cat);
  onTpl();
  toast(it.kanri_no+' を読み込みました');
}
