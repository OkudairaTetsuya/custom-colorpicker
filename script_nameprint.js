/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   名入れカスタマイズ — script_nameprint.js
   Fabric.js + Vanilla JS + Supabase
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  'use strict';

  var CANVAS_W = 300;
  var CANVAS_H = 600;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Supabase クライアント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var supabaseClient = (
    window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('your-project-id')
  ) ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     状態
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /* 本体カラー: デフォルト白 (#FFFFFF) */
  var bgHue = 0, bgSat = 0, bgVal = 1.0, bgDrag = false;
  /* 文字色: デフォルト黒 (#000000) */
  var tcHue = 0, tcSat = 0, tcVal = 0.0, tcDrag = false;

  var currentBase  = 'BLK';
  var currentModel = null;
  var currentFont  = 'Roboto';
  var currentSize = 36;
  var activeText  = null;
  var textureObj  = null;
  var frameObj    = null;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     DOM 参照
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var svMap      = document.getElementById('sv-map');
  var svCursor   = document.getElementById('sv-cursor');
  var hueSlider  = document.getElementById('hue-slider');
  var hexChip    = document.getElementById('hex-chip');
  var hexCode    = document.getElementById('hex-code');

  var tcSvMap    = document.getElementById('tc-sv-map');
  var tcSvCursor = document.getElementById('tc-sv-cursor');
  var tcHueSl    = document.getElementById('tc-hue-slider');
  var tcHexChip  = document.getElementById('tc-hex-chip');
  var tcHexCode  = document.getElementById('tc-hex-code');

  var textInput  = document.getElementById('text-input');
  var fontGrid   = document.getElementById('font-grid');
  var fontSizeEl = document.getElementById('font-size');
  var sizeBadge  = document.getElementById('size-badge');

  var canvasWrap    = document.getElementById('canvas-wrap');
  var canvasStage   = document.getElementById('canvas-stage');
  var canvasLoader  = document.getElementById('canvas-loader');

  var saveBtn       = document.getElementById('save-btn');
  var shareModal    = document.getElementById('share-modal');
  var shareUrlInput = document.getElementById('share-url-input');
  var shareCopyBtn  = document.getElementById('share-copy-btn');
  var shareCopyMsg  = document.getElementById('share-copy-msg');
  var shareCloseBtn = document.getElementById('share-close-btn');
  var errorToast    = document.getElementById('error-toast');
  var loadOverlay   = document.getElementById('load-overlay');

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Fabric.js グローバル設定（タッチ用大きめハンドル）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  fabric.Object.prototype.set({
    cornerSize         : 28,
    touchCornerSize    : 36,
    cornerStyle        : 'circle',
    transparentCorners : false,
    cornerColor        : '#ffffff',
    cornerStrokeColor  : 'rgba(0,0,0,0.25)',
    borderColor        : 'rgba(255,255,255,0.85)',
    borderScaleFactor  : 2,
    padding            : 8,
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Fabric.js 初期化
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var canvas = new fabric.Canvas('main-canvas', {
    width                 : CANVAS_W,
    height                : CANVAS_H,
    preserveObjectStacking: true,
    selection             : false,
    enableRetinaScaling   : true,
  });

  /* テキスト選択時にコントロールを同期 */
  function syncControlsToText(textObj) {
    activeText = textObj;
    textInput.value = textObj.text || '';
    currentFont = textObj.fontFamily || 'Roboto';
    currentSize = textObj.fontSize  || 36;
    fontSizeEl.value       = currentSize;
    sizeBadge.textContent  = currentSize;
    document.querySelectorAll('.font-card').forEach(function (c) {
      c.classList.toggle('selected', c.dataset.value === currentFont);
    });
    var fill = textObj.fill || '#FFFFFF';
    if (!/^#[0-9a-fA-F]{6}$/.test(fill)) fill = '#FFFFFF';
    var hsv = hexToHsv(fill);
    tcHue = hsv[0]; tcSat = hsv[1]; tcVal = hsv[2];
    tcHueSl.value = Math.round(tcHue);
    renderTc();
  }

  canvas.on('selection:created', function (e) {
    var obj = e.selected && e.selected[0];
    if (obj && (obj.type === 'i-text' || obj.type === 'text')) syncControlsToText(obj);
  });
  canvas.on('selection:updated', function (e) {
    var obj = e.selected && e.selected[0];
    if (obj && (obj.type === 'i-text' || obj.type === 'text')) syncControlsToText(obj);
  });

  /* レスポンシブスケーリング（最大60%高さ） */
  function scaleCanvas() {
    var available = canvasStage.clientWidth;
    var maxH = Math.round(CANVAS_H * 0.60);
    var scaleByW = available / CANVAS_W;
    var scaleByH = maxH / CANVAS_H;
    var scale = Math.min(1, scaleByW, scaleByH);
    canvasWrap.style.transform = 'scale(' + scale + ')';
    canvasWrap.style.transformOrigin = 'top center';
    canvasStage.style.height = Math.ceil(CANVAS_H * scale) + 'px';
  }
  window.addEventListener('resize', scaleCanvas);
  scaleCanvas();

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     画像ロード（frame）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function loadImages(baseColor) {
    if (textureObj) { canvas.remove(textureObj); textureObj = null; }
    if (frameObj)   { canvas.remove(frameObj);   frameObj   = null; }

    /* ローディングバー表示、背景を一旦クリア */
    if (canvasLoader) canvasLoader.classList.add('active');
    canvas.backgroundColor = null;
    canvas.renderAll();

    var frameUrl = currentModel
      ? './images/' + currentModel.slug + '_' + baseColor + '.png'
      : null;

    if (!frameUrl) {
      if (canvasLoader) canvasLoader.classList.remove('active');
      return;
    }

    fabric.Image.fromURL(frameUrl, function (img) {
      /* 画像の実寸に合わせてキャンバスをリサイズ（歪み防止） */
      var h = 600;
      var w = Math.round(h * (img.width / img.height));
      CANVAS_W = w; CANVAS_H = h;
      canvas.setWidth(w);
      canvas.setHeight(h);

      img.set({
        left: 0, top: 0,
        scaleX: w / img.width,
        scaleY: h / img.height,
        selectable: false, evented: false,
        globalCompositeOperation: 'source-over',
      });
      canvas.add(img);
      frameObj = img;
      canvas.bringToFront(frameObj);

      /* 画像ロード後に背景色を適用 */
      renderBg();

      scaleCanvas();
      canvas.renderAll();

      /* ローディングバー非表示 */
      if (canvasLoader) canvasLoader.classList.remove('active');
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     機種セレクター（ブランド→機種 2ステップ）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var msSelectorWrap  = document.getElementById('model-selector-wrap');
  var msBrandStep     = document.getElementById('ms-brand-step');
  var msModelStep     = document.getElementById('ms-model-step');
  var msBrandLabelEl  = document.getElementById('ms-brand-label');
  var brandGridEl     = document.getElementById('brand-grid');
  var modelListEl     = document.getElementById('model-list');
  var msBackBtn       = document.getElementById('ms-back-btn');
  var modelSelectedBar  = document.getElementById('model-selected-bar');
  var modelSelectedName = document.getElementById('model-selected-name');
  var modelChangeBtn    = document.getElementById('model-change-btn');
  var canvasPlaceholder = document.getElementById('canvas-placeholder');
  var modelMap          = {}; /* id → model オブジェクト */
  var brandGroups       = {}; /* brand → model[] */

  /* ブランドステップへ戻る */
  function showBrandStep() {
    msModelStep.classList.remove('ms-active');
    setTimeout(function () {
      msModelStep.style.display = 'none';
      msBrandStep.style.display = 'block';
    }, 260);
    msBrandStep.style.opacity = '1';
  }

  /* 機種ステップへ進む */
  function showModelStep(brand) {
    msBrandLabelEl.textContent = brand;
    modelListEl.innerHTML = '';
    (brandGroups[brand] || []).forEach(function (m) {
      var b = document.createElement('button');
      b.type      = 'button';
      b.className = 'model-item-btn';
      b.textContent = m.name;
      b.addEventListener('click', function () {
        applyModel(m);
        showModelChip(m.name);
      });
      modelListEl.appendChild(b);
    });
    msBrandStep.style.display = 'none';
    msModelStep.style.display = 'block';
    void msModelStep.offsetWidth; /* reflow でアニメーションリセット */
    msModelStep.classList.add('ms-active');
  }

  /* 選択済みチップを表示してキャンバスまでスクロール */
  function showModelChip(name) {
    msSelectorWrap.style.display = 'none';
    modelSelectedName.textContent = name;
    modelSelectedBar.classList.add('visible');
    setTimeout(function () {
      var rect    = canvasStage.getBoundingClientRect();
      var target  = window.scrollY + rect.top - 64;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, 80);
  }

  /* 「変更」→ブランド選択に戻す */
  modelChangeBtn.addEventListener('click', function () {
    modelSelectedBar.classList.remove('visible');
    msSelectorWrap.style.display = 'block';
    showBrandStep();
  });

  msBackBtn.addEventListener('click', showBrandStep);

  function applyModel(model) {
    currentModel = model;
    canvasPlaceholder.style.display = 'none';
    loadImages(currentBase);
    renderTc();
  }

  function loadModelList() {
    if (!supabaseClient) return;
    supabaseClient.from('case_models')
      .select('*')
      .order('name', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return;

        /* modelMap と brandGroups を構築 */
        res.data.forEach(function (m) {
          modelMap[m.id] = m;
          var brand = (m.brand && m.brand.trim()) ? m.brand.trim() : 'その他';
          if (!brandGroups[brand]) brandGroups[brand] = [];
          brandGroups[brand].push(m);
        });

        /* ブランドボタンを生成 */
        brandGridEl.innerHTML = '';
        Object.keys(brandGroups).sort().forEach(function (brand) {
          var b = document.createElement('button');
          b.type      = 'button';
          b.className = 'brand-btn';
          b.textContent = brand;
          b.addEventListener('click', function () { showModelStep(brand); });
          brandGridEl.appendChild(b);
        });
      });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Color Math: HSV ↔ RGB ↔ HEX
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function hsvToRgb(h, s, v) {
    var i = Math.floor(h / 60) % 6;
    var f = (h / 60) - Math.floor(h / 60);
    var p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i]
      .map(function (c) { return Math.round(c * 255); });
  }

  function rgbToHex(r, g, b) {
    function h2(n) { return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'); }
    return '#' + h2(r) + h2(g) + h2(b);
  }

  function hexToHsv(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var d = max - min;
    var h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s, v];
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     本体カラー ピッカー
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function renderBg() {
    svMap.style.background =
      'linear-gradient(to bottom, transparent, #000),' +
      'linear-gradient(to right, #fff, transparent),' +
      'hsl(' + bgHue + ', 100%, 50%)';
    svCursor.style.left = (bgSat * 100) + '%';
    svCursor.style.top  = ((1 - bgVal) * 100) + '%';

    var rgb = hsvToRgb(bgHue, bgSat, bgVal);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase();
    canvas.backgroundColor = hex;
    canvas.renderAll();
    hexChip.style.backgroundColor = hex;
    hexCode.textContent = hex;
  }

  function getXY(e) {
    var src = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  function updateBgSV(e) {
    var rect = svMap.getBoundingClientRect();
    var p = getXY(e);
    bgSat = Math.max(0, Math.min(1, (p.x - rect.left) / rect.width));
    bgVal = Math.max(0, Math.min(1, 1 - (p.y - rect.top) / rect.height));
    renderBg();
  }

  svMap.addEventListener('mousedown', function (e) { bgDrag = true; updateBgSV(e); });
  svMap.addEventListener('touchstart', function (e) {
    e.preventDefault(); bgDrag = true; updateBgSV(e);
  }, { passive: false });
  hueSlider.addEventListener('input', function () {
    bgHue = parseInt(this.value, 10); renderBg();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     文字色 ピッカー
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function renderTc() {
    tcSvMap.style.background =
      'linear-gradient(to bottom, transparent, #000),' +
      'linear-gradient(to right, #fff, transparent),' +
      'hsl(' + tcHue + ', 100%, 50%)';
    tcSvCursor.style.left = (tcSat * 100) + '%';
    tcSvCursor.style.top  = ((1 - tcVal) * 100) + '%';

    var rgb = hsvToRgb(tcHue, tcSat, tcVal);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase();
    tcHexChip.style.backgroundColor = hex;
    tcHexCode.textContent = hex;

    if (activeText) {
      activeText.set('fill', hex);
      canvas.renderAll();
    }
  }

  function updateTcSV(e) {
    var rect = tcSvMap.getBoundingClientRect();
    var p = getXY(e);
    tcSat = Math.max(0, Math.min(1, (p.x - rect.left) / rect.width));
    tcVal = Math.max(0, Math.min(1, 1 - (p.y - rect.top) / rect.height));
    renderTc();
  }

  tcSvMap.addEventListener('mousedown', function (e) { tcDrag = true; updateTcSV(e); });
  tcSvMap.addEventListener('touchstart', function (e) {
    e.preventDefault(); tcDrag = true; updateTcSV(e);
  }, { passive: false });
  tcHueSl.addEventListener('input', function () {
    tcHue = parseInt(this.value, 10); renderTc();
  });

  /* 共通ドラッグ解放 */
  document.addEventListener('mousemove', function (e) {
    if (bgDrag) updateBgSV(e);
    if (tcDrag) updateTcSV(e);
  });
  document.addEventListener('touchmove', function (e) {
    if (bgDrag) { e.preventDefault(); updateBgSV(e); }
    if (tcDrag) { e.preventDefault(); updateTcSV(e); }
  }, { passive: false });
  document.addEventListener('mouseup',  function () { bgDrag = false; tcDrag = false; });
  document.addEventListener('touchend', function () { bgDrag = false; tcDrag = false; });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     テキスト管理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function currentTextColor() {
    var rgb = hsvToRgb(tcHue, tcSat, tcVal);
    return rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase();
  }

  function ensureText(text) {
    if (!activeText) {
      activeText = new fabric.IText(text || '', {
        left      : CANVAS_W / 2,
        top       : CANVAS_H / 2,
        originX   : 'center',
        originY   : 'center',
        fontFamily: currentFont,
        fontSize  : currentSize,
        fill      : currentTextColor(),
        selectable: true,
        editable  : false,
        textAlign : 'center',
      });
      var idx = frameObj ? canvas.getObjects().indexOf(frameObj) : canvas.getObjects().length;
      canvas.insertAt(activeText, Math.max(0, idx));
      canvas.setActiveObject(activeText);
    }
    return activeText;
  }

  function updateText(text) {
    var t = ensureText(text);
    t.set('text', text);
    if (frameObj) canvas.bringToFront(frameObj);
    canvas.renderAll();
  }

  textInput.addEventListener('input', function () { updateText(this.value); });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ビジュアルフォントグリッド
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function selectFont(value) {
    currentFont = value;
    document.querySelectorAll('.font-card').forEach(function (card) {
      card.classList.toggle('selected', card.dataset.value === value);
    });
    if (!activeText) return;
    document.fonts.load('400 1em "' + currentFont + '"').then(function () {
      activeText.set('fontFamily', currentFont);
      canvas.renderAll();
    });
  }

  document.querySelectorAll('.font-card').forEach(function (card) {
    card.addEventListener('click', function () {
      selectFont(this.dataset.value);
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     フォントサイズ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  fontSizeEl.addEventListener('input', function () {
    currentSize = parseInt(this.value, 10);
    sizeBadge.textContent = currentSize;
    if (activeText) { activeText.set('fontSize', currentSize); canvas.renderAll(); }
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     BLK / BGE 切り替え
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  ['BLK', 'BGE'].forEach(function (color) {
    document.getElementById('toggle-' + color).addEventListener('click', function () {
      currentBase = color;
      document.querySelectorAll('.toggle-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.color === color);
      });
      loadImages(color);
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     配置ショートカット
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  document.querySelectorAll('.align-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!activeText) return;
      var pos = this.dataset.align;
      if (!pos) return;
      var top = pos === 'top' ? 70 : pos === 'center' ? CANVAS_H / 2 : CANVAS_H - 70;
      activeText.set({ left: CANVAS_W / 2, top: top });
      activeText.setCoords();
      canvas.renderAll();
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     回転ボタン
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  document.getElementById('rotate-cw').addEventListener('click', function () {
    if (!activeText) return;
    activeText.rotate((activeText.angle + 90) % 360);
    activeText.setCoords();
    canvas.renderAll();
  });
  document.getElementById('rotate-ccw').addEventListener('click', function () {
    if (!activeText) return;
    activeText.rotate((activeText.angle - 90 + 360) % 360);
    activeText.setCoords();
    canvas.renderAll();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     テキスト追加 / 削除
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  document.getElementById('add-text-btn').addEventListener('click', function () {
    var existingTexts = canvas.getObjects().filter(function (o) {
      return o.type === 'i-text' || o.type === 'text';
    });
    var offset = existingTexts.length * 70;
    var newText = new fabric.IText('', {
      left      : CANVAS_W / 2,
      top       : Math.min(CANVAS_H / 2 + offset, CANVAS_H - 70),
      originX   : 'center',
      originY   : 'center',
      fontFamily: currentFont,
      fontSize  : currentSize,
      fill      : currentTextColor(),
      selectable: true,
      editable  : false,
      textAlign : 'center',
    });
    var idx = frameObj ? canvas.getObjects().indexOf(frameObj) : canvas.getObjects().length;
    canvas.insertAt(newText, Math.max(0, idx));
    if (frameObj) canvas.bringToFront(frameObj);
    canvas.setActiveObject(newText);
    canvas.renderAll();
    activeText = newText;
    textInput.value = '';
    textInput.focus();
  });

  document.getElementById('del-text-btn').addEventListener('click', function () {
    if (!activeText) return;
    canvas.remove(activeText);
    activeText = null;
    textInput.value = '';
    canvas.renderAll();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ユーティリティ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function dataURLtoBlob(dataURL) {
    var arr  = dataURL.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n    = bstr.length;
    var u8   = new Uint8Array(n);
    while (n--) { u8[n] = bstr.charCodeAt(n); }
    return new Blob([u8], { type: mime });
  }

  var errorTimer = null;
  function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.add('visible');
    clearTimeout(errorTimer);
    errorTimer = setTimeout(function () { errorToast.classList.remove('visible'); }, 4500);
  }

  function setBtnLoading(isLoading) {
    saveBtn.disabled = isLoading;
    saveBtn.classList.toggle('loading', isLoading);
  }

  function showShareModal(url) {
    shareUrlInput.value = url;
    shareModal.style.display = 'flex';
    shareUrlInput.focus();
    shareUrlInput.select();
  }

  function hideShareModal() {
    shareModal.style.display = 'none';
  }

  function showLoadOverlay(visible) {
    loadOverlay.classList.toggle('hidden', !visible);
    loadOverlay.setAttribute('aria-hidden', String(!visible));
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     保存処理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function saveDesign() {
    if (!supabaseClient) {
      showError('Supabase が未設定です。supabase.config.js に認証情報を入力してください。');
      return;
    }
    setBtnLoading(true);

    var id = generateUUID();

    var canvasJson = JSON.stringify(
      canvas.toJSON(['globalCompositeOperation', 'selectable', 'evented'])
    );

    var previewDataUrl = canvas.toDataURL({
      format    : 'jpeg',
      quality   : 0.75,
      multiplier: 500 / CANVAS_W,
    });
    var previewBlob = dataURLtoBlob(previewDataUrl);
    var filename    = id + '.jpg';

    supabaseClient.storage
      .from('previews')
      .upload(filename, previewBlob, { contentType: 'image/jpeg', upsert: false })
      .then(function (uploadResult) {
        if (uploadResult.error) throw uploadResult.error;

        var urlResult  = supabaseClient.storage.from('previews').getPublicUrl(filename);
        var publicUrl  = urlResult.data.publicUrl;

        return supabaseClient.from('designs').insert({
          id          : id,
          canvas_json : canvasJson,
          base_color  : (canvas.backgroundColor || '#3399FF').toUpperCase(),
          preview_url : publicUrl,
          base_skin   : currentBase,
          text_value  : textInput.value,
          font_family : currentFont,
          font_size   : currentSize,
          text_color  : currentTextColor(),
          model_id    : currentModel ? currentModel.id : null,
        });
      })
      .then(function (insertResult) {
        if (insertResult.error) throw insertResult.error;

        var shareUrl = location.origin + location.pathname + '?id=' + id;
        setBtnLoading(false);
        showShareModal(shareUrl);
      })
      .catch(function (err) {
        console.error('saveDesign error:', err);
        showError('保存に失敗しました：' + (err.message || '通信エラー'));
        setBtnLoading(false);
      });
  }

  saveBtn.addEventListener('click', saveDesign);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     共有モーダル
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var shareCopyTimer = null;
  shareCopyBtn.addEventListener('click', function () {
    var url = shareUrlInput.value;
    var onCopied = function () {
      shareCopyMsg.classList.add('visible');
      clearTimeout(shareCopyTimer);
      shareCopyTimer = setTimeout(function () {
        shareCopyMsg.classList.remove('visible');
      }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(onCopied);
    } else {
      shareUrlInput.select();
      try { document.execCommand('copy'); onCopied(); } catch (e) {}
    }
  });
  shareCloseBtn.addEventListener('click', hideShareModal);
  shareModal.addEventListener('click', function (e) {
    if (e.target === shareModal) hideShareModal();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     復元処理（?id= パラメータ）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function loadDesignFromUrl() {
    var params = new URLSearchParams(location.search);
    var id     = params.get('id');
    if (!id) return;

    if (!supabaseClient) {
      showError('Supabase が未設定のため、デザインを読み込めません。');
      return;
    }

    showLoadOverlay(true);

    supabaseClient
      .from('designs')
      .select('*')
      .eq('id', id)
      .single()
      .then(function (result) {
        if (result.error) throw result.error;
        var data = result.data;
        if (!data) throw new Error('デザインが見つかりません');

        var modelPromise = data.model_id
          ? supabaseClient.from('case_models').select('*').eq('id', data.model_id).single()
              .then(function (mr) {
                if (!mr.error && mr.data) {
                  applyModel(mr.data);
                  showModelChip(mr.data.name);
                }
              })
          : Promise.resolve();

        return modelPromise.then(function () {
          scaleCanvas();

          canvas.loadFromJSON(data.canvas_json, function () {
            activeText = null; textureObj = null; frameObj = null;
            canvas.getObjects().forEach(function (obj) {
              if (obj.type === 'i-text' || obj.type === 'text') {
                if (!activeText) activeText = obj;
              } else if (obj.type === 'image') {
                if (obj.globalCompositeOperation === 'multiply') {
                  textureObj = obj;
                } else {
                  frameObj = obj;
                }
              }
            });
            if (activeText) syncControlsToText(activeText);
            canvas.renderAll();
            showLoadOverlay(false);
          });

          currentBase  = data.base_skin   || 'BLK';
          currentFont  = data.font_family || 'Roboto';
          currentSize  = data.font_size   || 36;
          textInput.value    = data.text_value  || '';
          selectFont(currentFont);
          fontSizeEl.value   = currentSize;
          sizeBadge.textContent = currentSize;

          document.querySelectorAll('.toggle-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.color === currentBase);
          });

          var bgHex = (data.base_color || '#3399FF').toUpperCase();
          hexChip.style.backgroundColor = bgHex;
          hexCode.textContent            = bgHex;
          var bgHsv = hexToHsv(bgHex);
          bgHue = bgHsv[0]; bgSat = bgHsv[1]; bgVal = bgHsv[2];
          hueSlider.value = Math.round(bgHue);
          renderBg();

          var tcHex = (data.text_color || '#FFFFFF').toUpperCase();
          tcHexChip.style.backgroundColor = tcHex;
          tcHexCode.textContent            = tcHex;
          var tcHsv = hexToHsv(tcHex);
          tcHue = tcHsv[0]; tcSat = tcHsv[1]; tcVal = tcHsv[2];
          tcHueSl.value = Math.round(tcHue);
          renderTc();
        });
      })
      .catch(function (err) {
        console.error('loadDesign error:', err);
        showError('デザインの読み込みに失敗しました：' + (err.message || '通信エラー'));
        showLoadOverlay(false);
      });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     モバイル ステップカルーセル
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var currentStep = 0;
  var totalSteps  = 5;

  function goToStep(n) {
    currentStep = Math.max(0, Math.min(totalSteps - 1, n));

    document.querySelectorAll('.step-card').forEach(function (card) {
      var idx = parseInt(card.dataset.stepIdx, 10);
      card.classList.toggle('active', idx === currentStep);
    });

    document.querySelectorAll('.step-dot').forEach(function (dot) {
      var step = parseInt(dot.dataset.step, 10);
      dot.classList.toggle('active', step === currentStep);
      dot.classList.toggle('done', step < currentStep);
    });

    var counter = document.getElementById('step-counter');
    if (counter) counter.textContent = (currentStep + 1) + ' / ' + totalSteps;

    var prevBtn = document.getElementById('step-prev-btn');
    var nextBtn = document.getElementById('step-next-btn');
    if (prevBtn) prevBtn.disabled = (currentStep === 0);
    if (nextBtn) {
      nextBtn.textContent = (currentStep === totalSteps - 1) ? '完了 ✓' : '次へ →';
    }
  }

  document.getElementById('step-prev-btn').addEventListener('click', function () {
    goToStep(currentStep - 1);
  });
  document.getElementById('step-next-btn').addEventListener('click', function () {
    if (currentStep < totalSteps - 1) {
      goToStep(currentStep + 1);
    } else {
      /* 完了: トップへスクロール → 保存ボタンをバウンス */
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function () {
        var btn = document.getElementById('save-btn');
        if (!btn) return;
        btn.classList.remove('bounce');
        void btn.offsetWidth; /* アニメーションリセット */
        btn.classList.add('bounce');
        btn.addEventListener('animationend', function () {
          btn.classList.remove('bounce');
        }, { once: true });
      }, 400); /* スクロール開始後に発火 */
    }
  });

  document.querySelectorAll('.step-dot').forEach(function (dot) {
    dot.addEventListener('click', function () {
      goToStep(parseInt(this.dataset.step, 10));
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PC アコーディオン（step-body）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var stepBodyIds = ['step-body-0','step-body-1','step-body-2','step-body-3','step-body-4'];

  function openStepBody(targetId) {
    var body   = document.getElementById(targetId);
    var header = document.querySelector('[data-target="' + targetId + '"]');
    if (!body || !header) return;
    var isOpen = header.classList.contains('open');
    if (isOpen) {
      /* 閉じる */
      body.style.maxHeight = body.scrollHeight + 'px';
      requestAnimationFrame(function () { body.style.maxHeight = '0'; });
      header.classList.remove('open');
    } else {
      /* 開く */
      body.style.maxHeight = body.scrollHeight + 'px';
      header.classList.add('open');
      body.addEventListener('transitionend', function onEnd() {
        body.style.maxHeight = 'none';
        body.removeEventListener('transitionend', onEnd);
      });
    }
  }

  stepBodyIds.forEach(function (id) {
    var header = document.querySelector('[data-target="' + id + '"]');
    if (!header) return;
    header.addEventListener('click', function () {
      /* PC のみ動作（モバイルでは pc-ac-header が display:none） */
      openStepBody(id);
    });
  });

  /* PC初期状態: step-body-0 を展開 */
  (function () {
    if (window.matchMedia('(min-width: 780px)').matches) {
      var body   = document.getElementById('step-body-0');
      var header = document.querySelector('[data-target="step-body-0"]');
      if (body && header) {
        body.style.transition = 'none';
        body.style.maxHeight  = 'none';
        header.classList.add('open');
        requestAnimationFrame(function () { body.style.transition = ''; });
      }
    }
  })();

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期描画
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  hueSlider.value  = bgHue;
  tcHueSl.value    = tcHue;
  fontSizeEl.value = currentSize;
  renderBg();
  renderTc();

  /* モバイル: 初期ステップ設定 */
  goToStep(0);

  /* 機種リスト読み込み */
  loadModelList();
  /* URLにidが含まれている場合はデザイン復元 */
  if (new URLSearchParams(location.search).get('id')) loadDesignFromUrl();

}());
