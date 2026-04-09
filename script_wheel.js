/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   スマホケース カラーシミュレーター (カラーホイール版) — script_wheel.js
   依存なし（Vanilla JS）
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  'use strict';

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     状態（State）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var hue          = 200;   // 0 – 360
  var saturation   = 0.75;  // 0 – 1
  var value        = 0.90;  // 0 – 1
  var dragging     = false;
  var currentColor = 'BLK';

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     DOM 参照
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var colorWheel   = document.getElementById('color-wheel');
  var wheelOverlay = document.getElementById('wheel-overlay');
  var wheelCursor  = document.getElementById('wheel-cursor');
  var valueSlider  = document.getElementById('value-slider');
  var baseLayer    = document.getElementById('base-layer');
  var hexChip      = document.getElementById('hex-chip');
  var hexCode      = document.getElementById('hex-code');
  var copyBtn      = document.getElementById('copy-btn');
  var copyMsg      = document.getElementById('copy-msg');
  var textureLayer = document.getElementById('texture-layer');
  var frameLayer   = document.getElementById('frame-layer');

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Color Math: HSV → RGB → HEX
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function hsvToRgb(h, s, v) {
    var i = Math.floor(h / 60) % 6;
    var f = (h / 60) - Math.floor(h / 60);
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    return [
      [v, t, p], [q, v, p], [p, v, t],
      [p, q, v], [t, p, v], [v, p, q]
    ][i].map(function (c) { return Math.round(c * 255); });
  }

  function rgbToHex(r, g, b) {
    function h2(n) { return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'); }
    return '#' + h2(r) + h2(g) + h2(b);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     描画 (render)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function render() {
    /* 明度オーバーレイ: opacity = 1 - V */
    wheelOverlay.style.opacity = (1 - value).toFixed(3);

    /*
      ホイール上のカーソル位置（極座標 → デカルト座標）
        0° = 12時方向(上) = Hue 0
        angle_rad = (hue - 90) * π / 180
        left% = (0.5 + S * 0.5 * cos(angle)) * 100
        top%  = (0.5 + S * 0.5 * sin(angle)) * 100
    */
    var angle = (hue - 90) * Math.PI / 180;
    wheelCursor.style.left = (0.5 + saturation * 0.5 * Math.cos(angle)) * 100 + '%';
    wheelCursor.style.top  = (0.5 + saturation * 0.5 * Math.sin(angle)) * 100 + '%';

    /* 明度スライダーのグラデーション（黒 → 現在のHue色） */
    valueSlider.style.background =
      'linear-gradient(to right, #000, hsl(' + hue + ', 100%, 50%))';

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
     ポインタユーティリティ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function getClientXY(e) {
    var src = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  /*
    ホイール上のポインタ位置から Hue と Saturation を計算
      dx, dy = ポインタ - ホイール中心
      H = atan2(dy, dx) → 12時方向が Hue 0 になるよう +90° 補正
      S = distance / radius (1でクリップ)
  */
  function updateHSFromWheel(e) {
    var rect = colorWheel.getBoundingClientRect();
    var p    = getClientXY(e);
    var cx   = rect.left + rect.width  / 2;
    var cy   = rect.top  + rect.height / 2;
    var dx   = p.x - cx;
    var dy   = p.y - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var r    = rect.width / 2;

    saturation = Math.min(1, dist / r);
    hue        = ((Math.atan2(dy, dx) * 180 / Math.PI + 90) + 360) % 360;
    render();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ホイール イベント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  colorWheel.addEventListener('mousedown', function (e) {
    dragging = true;
    updateHSFromWheel(e);
  });

  colorWheel.addEventListener('touchstart', function (e) {
    e.preventDefault();
    dragging = true;
    updateHSFromWheel(e);
  }, { passive: false });

  document.addEventListener('mousemove', function (e) {
    if (dragging) updateHSFromWheel(e);
  });

  document.addEventListener('touchmove', function (e) {
    if (dragging) {
      e.preventDefault();
      updateHSFromWheel(e);
    }
  }, { passive: false });

  document.addEventListener('mouseup',  function () { dragging = false; });
  document.addEventListener('touchend', function () { dragging = false; });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     明度スライダー
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  valueSlider.addEventListener('input', function () {
    value = parseInt(this.value, 10) / 100;
    render();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     BLK / BGE 切り替え
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function updateImages() {
    frameLayer.src = './images/' + currentColor + '_frame.png';
  }

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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hex).then(showCopyMsg);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = hex;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); showCopyMsg(); } catch (e) {}
    document.body.removeChild(ta);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期描画
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  valueSlider.value = Math.round(value * 100);
  render();

}());
