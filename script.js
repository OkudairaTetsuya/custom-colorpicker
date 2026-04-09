/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   スマホケース カラーシミュレーター — script.js
   依存なし（Vanilla JS）・低スペック端末対応
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  'use strict';

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     状態（State）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var hue          = 200;    // 0 – 360
  var saturation   = 0.75;   // 0 – 1  (左→右)
  var value        = 0.90;   // 0 – 1  (下→上)
  var dragging     = false;
  var currentColor = 'BLK';  // 'BLK' | 'BGE'

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     DOM 参照
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var svMap        = document.getElementById('sv-map');
  var svCursor     = document.getElementById('sv-cursor');
  var hueSlider    = document.getElementById('hue-slider');
  var baseLayer    = document.getElementById('base-layer');
  var hexChip      = document.getElementById('hex-chip');
  var hexCode      = document.getElementById('hex-code');
  var copyBtn      = document.getElementById('copy-btn');
  var copyMsg      = document.getElementById('copy-msg');
  var textureLayer = document.getElementById('texture-layer');
  var frameLayer   = document.getElementById('frame-layer');

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Color Math: HSV → RGB → HEX
     ─────────────────────────────
     H: 0–360  S: 0–1  V: 0–1
     R,G,B: 0–255
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function hsvToRgb(h, s, v) {
    var i = Math.floor(h / 60) % 6;
    var f = (h / 60) - Math.floor(h / 60);
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    var table = [
      [v, t, p],
      [q, v, p],
      [p, v, t],
      [p, q, v],
      [t, p, v],
      [v, p, q]
    ];
    return table[i].map(function (c) {
      return Math.round(c * 255);
    });
  }

  function rgbToHex(r, g, b) {
    function hex2(n) {
      return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    }
    return '#' + hex2(r) + hex2(g) + hex2(b);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     描画 (render)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function render() {
    /*
      SV マップの背景グラデーション:
        最下層: 選択中の純粋な Hue 色
        中間層: 左(白)→右(透明)  ← Saturation 軸
        最上層: 上(透明)→下(黒)  ← Value 軸（反転）
    */
    svMap.style.background =
      'linear-gradient(to bottom, transparent, #000),' +
      'linear-gradient(to right, #fff, transparent),' +
      'hsl(' + hue + ', 100%, 50%)';

    /* カーソル位置（%指定） */
    svCursor.style.left = (saturation * 100) + '%';
    svCursor.style.top  = ((1 - value)  * 100) + '%';

    /* 選択色を計算 */
    var rgb = hsvToRgb(hue, saturation, value);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase();

    /* ケースのベースカラーに反映 */
    baseLayer.style.backgroundColor = hex;

    /* HEX 表示を更新 */
    hexChip.style.backgroundColor = hex;
    hexCode.textContent            = hex;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ポインタ座標ユーティリティ
     ─ マウス / タッチ 両対応
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function getClientXY(e) {
    var src = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  /* ポインタ位置から S・V を更新 */
  function updateSVFromPointer(e) {
    var rect = svMap.getBoundingClientRect();
    var p    = getClientXY(e);
    saturation = Math.max(0, Math.min(1, (p.x - rect.left) / rect.width));
    value      = Math.max(0, Math.min(1, 1 - (p.y - rect.top)  / rect.height));
    render();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SV マップ イベント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* ── マウス ── */
  svMap.addEventListener('mousedown', function (e) {
    dragging = true;
    updateSVFromPointer(e);
  });

  document.addEventListener('mousemove', function (e) {
    if (dragging) updateSVFromPointer(e);
  });

  document.addEventListener('mouseup', function () {
    dragging = false;
  });

  /* ── タッチ ── */
  svMap.addEventListener('touchstart', function (e) {
    e.preventDefault();   // スクロール抑制
    dragging = true;
    updateSVFromPointer(e);
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (dragging) {
      e.preventDefault(); // ドラッグ中のスクロール抑制
      updateSVFromPointer(e);
    }
  }, { passive: false });

  document.addEventListener('touchend', function () {
    dragging = false;
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Hue スライダー イベント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  hueSlider.addEventListener('input', function () {
    hue = parseInt(this.value, 10);
    render();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     機種 / ベースカラー切り替え
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* 画像パスを更新（texture は共通、frame のみ色別） */
  function updateImages() {
    frameLayer.src = './images/' + currentColor + '_frame.png';
  }

  /* BLK / BGE トグル */
  ['BLK', 'BGE'].forEach(function (color) {
    document.getElementById('toggle-' + color).addEventListener('click', function () {
      currentColor = color;
      document.querySelectorAll('.toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.color === color);
      });
      updateImages();
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     コピーボタン
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var copyTimer = null;

  function showCopyMsg() {
    copyMsg.classList.add('visible');
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () {
      copyMsg.classList.remove('visible');
    }, 2500);
  }

  copyBtn.addEventListener('click', function () {
    var hex = hexCode.textContent;

    /* navigator.clipboard が使える場合（HTTPS / localhost） */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hex).then(showCopyMsg);
      return;
    }

    /* フォールバック: file:// など非セキュアコンテキスト向け */
    var ta = document.createElement('textarea');
    ta.value = hex;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showCopyMsg();
    } catch (e) {}
    document.body.removeChild(ta);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期描画
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  hueSlider.value = hue;
  render();

}());
