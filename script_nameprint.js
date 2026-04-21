/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   名入れカスタマイズ — script_nameprint.js
   Fabric.js + Vanilla JS + Supabase
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  'use strict';

  var CANVAS_W = 300;
  var CANVAS_H = 600;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ガマット（印刷色域）チェック
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var gamut = {
    originalHex : '#FFFFFF',
    printHex    : '#FFFFFF',
    deltaE      : 0,
    isWarning   : false,
    isPrint     : false,   /* 印刷プレビュー中か */
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     スタンプ状態
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var stampState = {
    cats        : [],
    stamps      : [],
    currentCatId: null,
  };

  /* デバウンス：連続入力中は判定を遅延させてパフォーマンスを確保 */
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, a); }, ms);
    };
  }

  /**
   * checkGamut(hex) → { printHex, deltaE, isWarning }
   *
   * Japan Color 2011 近似アルゴリズム:
   *  1. RGB → CMYK 変換（chroma-js）
   *  2. 総インク量制限 320%（日本カラー標準）
   *  3. ドットゲイン補正（中間調で約20%増）
   *  4. CMYK → RGB（再変換）
   *  5. ΔE2000 で色差を計算
   */
  function checkGamut(hex) {
    if (!window.chroma) return null;
    try {
      var orig = chroma(hex);
      var cmyk = orig.cmyk();               /* [c,m,y,k] 0–1 */
      var c = cmyk[0], m = cmyk[1], y = cmyk[2], k = cmyk[3];

      /* 総インク制限 320% */
      var total = c + m + y + k;
      if (total > 3.2) {
        var sc = 3.2 / total;
        c *= sc; m *= sc; y *= sc; k *= sc;
      }
      k = Math.min(k, 0.95);  /* K単体上限 95% */

      /* ドットゲイン補正（Yule-Nielsen 近似）*/
      function dg(v) { return v + 0.18 * v * (1 - v); }
      c = Math.min(1, dg(c));
      m = Math.min(1, dg(m));
      y = Math.min(1, dg(y));
      k = Math.min(1, dg(k));

      /* CMYK → RGB */
      var r = Math.round(255 * (1 - c) * (1 - k));
      var g = Math.round(255 * (1 - m) * (1 - k));
      var b = Math.round(255 * (1 - y) * (1 - k));
      var printed = chroma(r, g, b);

      var dE = chroma.deltaE(orig, printed);

      return {
        printHex : printed.hex().toUpperCase(),
        deltaE   : dE,
        isWarning: dE > 4,   /* ΔE > 4 で警告（印刷業界標準の許容差は ΔE ≤ 3） */
      };
    } catch (e) { return null; }
  }

  /* DOM 参照（初期化前なので関数内で取得する） */
  function getGamutEls() {
    return {
      warn    : document.getElementById('gamut-warning'),
      detBtn  : document.getElementById('gamut-detail-btn'),
      detail  : document.getElementById('gamut-detail'),
      swRgb   : document.getElementById('gamut-swatch-rgb'),
      swCmyk  : document.getElementById('gamut-swatch-cmyk'),
      dText   : document.getElementById('gamut-delta-text'),
      toggle  : document.getElementById('print-preview-toggle'),
    };
  }

  /* 警告 UI を更新する */
  function updateGamutUI(hex, result) {
    var el = getGamutEls();
    if (!el.warn) return;

    if (!result || !result.isWarning) {
      el.warn.classList.remove('visible');
      /* 印刷プレビュー中なら元の色に戻す */
      if (gamut.isPrint) {
        gamut.isPrint = false;
        if (el.toggle) el.toggle.checked = false;
        canvas.backgroundColor = hex;
        canvas.renderAll();
      }
      gamut.isWarning = false;
      return;
    }

    /* 状態保存 */
    gamut.originalHex = hex;
    gamut.printHex    = result.printHex;
    gamut.deltaE      = result.deltaE;
    gamut.isWarning   = true;

    /* スウォッチ更新 */
    if (el.swRgb)  el.swRgb.style.background  = hex;
    if (el.swCmyk) el.swCmyk.style.background = result.printHex;
    if (el.dText)  el.dText.textContent = 'ΔE ' + result.deltaE.toFixed(1);

    /* 印刷プレビュー中なら印刷色を即反映 */
    if (gamut.isPrint) {
      canvas.backgroundColor = result.printHex;
      canvas.renderAll();
    }

    el.warn.classList.add('visible');
  }

  /* デバウンス版ガマットチェック（300ms） */
  var debouncedGamutCheck = debounce(function (hex) {
    var result = checkGamut(hex);
    updateGamutUI(hex, result);
  }, 300);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ブランド表示順設定
     ここに書いた順番で上から表示。未記載のブランドはアルファベット順で末尾に追加。
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var BRAND_ORDER = [
    'iPhone',
    'Google Pixel',
    'Galaxy',
    'AQUOS',
    'Arrows',
    'Kyocera',
  ];

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
      var h = 600;
      /* キャンバス幅はmm比率から計算（画像比率ではなく）
         → フロント座標系とSVG出力のmm寸法が一致し、Illustratorでのズレを防ぐ */
      var w = (currentModel && currentModel.widthMm && currentModel.heightMm)
        ? Math.round(h * currentModel.widthMm / currentModel.heightMm)
        : Math.round(h * (img.width / img.height));
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

      renderBg();

      scaleCanvas();
      canvas.renderAll();

      if (canvasLoader) canvasLoader.classList.remove('active');
      /* 機種読み込み完了時に履歴をリセットして初期スナップショットを保存 */
      undoStack.length = 0;
      snapshotCanvas();
    }, { crossOrigin: 'anonymous' });
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

  /* 機種名から最初の数字を抽出（ソート用） */
  function extractModelNum(name) {
    var m = name.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /* 機種ステップへ進む */
  function showModelStep(brand) {
    msBrandLabelEl.textContent = brand;
    modelListEl.innerHTML = '';
    /* 数字が大きい順にソート */
    var sorted = (brandGroups[brand] || []).slice().sort(function (a, b) {
      return extractModelNum(b.name) - extractModelNum(a.name);
    });
    sorted.forEach(function (m) {
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
    if (!supabaseClient) {
      showError('Supabase が未設定のため機種リストを読み込めません');
      return;
    }
    supabaseClient.from('case_models')
      .select('*')
      .order('name', { ascending: true })
      .then(function (res) {
        if (res.error) { showError('機種リスト取得失敗: ' + res.error.message); return; }
        if (!res.data || res.data.length === 0) {
          showError('機種が登録されていません。管理画面から追加してください。');
          return;
        }

        /* modelMap と brandGroups を構築 */
        res.data.forEach(function (m) {
          modelMap[m.id] = m;
          var brand = (m.brand && m.brand.trim()) ? m.brand.trim() : 'その他';
          if (!brandGroups[brand]) brandGroups[brand] = [];
          brandGroups[brand].push(m);
        });

        /* ブランドをBRAND_ORDER順にソート（未記載はアルファベット順で末尾） */
        var sortedBrands = Object.keys(brandGroups).sort(function (a, b) {
          var ai = BRAND_ORDER.indexOf(a);
          var bi = BRAND_ORDER.indexOf(b);
          if (ai === -1 && bi === -1) return a.localeCompare(b, 'ja');
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

        /* ブランドボタンを生成 */
        brandGridEl.innerHTML = '';
        sortedBrands.forEach(function (brand) {
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

    /* 印刷プレビュー中でなければキャンバスに反映 */
    gamut.originalHex = hex;
    canvas.backgroundColor = gamut.isPrint ? gamut.printHex : hex;
    canvas.renderAll();
    hexChip.style.backgroundColor = hex;
    hexCode.textContent = hex;

    /* ガマット判定（デバウンス：ドラッグ中は重くならないよう遅延） */
    debouncedGamutCheck(hex);
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

  /* ♥(U+2665) と ♡(U+2661) は絵文字扱いせず許可 */
  var emojiRe = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;

  textInput.addEventListener('input', function () {
    /* ♥️ の絵文字バリアントセレクタ(U+FE0F)を除去してテキスト表示に変換 */
    this.value = this.value.replace(/([♥♡])\uFE0F/g, '$1');
    /* ♥♡ を一時退避 → 絵文字除去 → 復元 */
    if (emojiRe.test(this.value.replace(/[♥♡]/g, ''))) {
      var hearts = [];
      this.value = this.value.replace(/[♥♡]/g, function (m) {
        hearts.push(m); return '\x00';
      });
      this.value = this.value.replace(new RegExp(emojiRe.source, 'gu'), '');
      var hi = 0;
      this.value = this.value.replace(/\x00/g, function () { return hearts[hi++] || ''; });
      showError('絵文字はご利用いただけません（♥♡は使用可能です）');
    }
    updateText(this.value);
    refreshLayerList();
  });

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

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     テキストレイヤーパネル
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var layerListEl = document.getElementById('layer-list');

  function getTextObjects() {
    return canvas.getObjects().filter(function (o) {
      return o.type === 'i-text' || o.type === 'text';
    });
  }

  function getUserObjects() {
    return canvas.getObjects().filter(function (o) {
      return o.type === 'i-text' || o.type === 'text' || o.isStamp;
    });
  }

  function refreshLayerList() {
    layerListEl.innerHTML = '';
    var objs = getUserObjects();
    if (objs.length === 0) {
      var emp = document.createElement('p');
      emp.className = 'layer-empty';
      emp.textContent = 'レイヤーがありません';
      layerListEl.appendChild(emp);
      return;
    }

    /* 上レイヤー（高インデックス）を先頭に表示 */
    var reversed = objs.slice().reverse();
    var total = reversed.length;

    reversed.forEach(function (obj, listIdx) {
      var item = document.createElement('div');
      item.className = 'layer-item' + (obj === activeText ? ' active' : '');

      /* ラベル */
      var lbl = document.createElement('span');
      if (obj.isStamp) {
        lbl.className   = 'layer-label layer-label-stamp';
        lbl.textContent = '🖼 ' + (obj.stampName || 'スタンプ');
      } else {
        lbl.className   = 'layer-label' + (obj.text ? '' : ' layer-label-empty');
        lbl.textContent = obj.text || '（空）';
      }

      /* 上へボタン（リスト上 = z-order高く） */
      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'layer-order-btn';
      upBtn.textContent = '▲';
      upBtn.disabled = listIdx === 0;
      upBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var curIdx = canvas.getObjects().indexOf(obj);
        canvas.moveTo(obj, curIdx + 1);
        if (frameObj) canvas.bringToFront(frameObj);
        canvas.renderAll();
        refreshLayerList();
      });

      /* 下へボタン */
      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'layer-order-btn';
      downBtn.textContent = '▼';
      downBtn.disabled = listIdx === total - 1;
      downBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var curIdx = canvas.getObjects().indexOf(obj);
        if (curIdx > 0) canvas.moveTo(obj, curIdx - 1);
        canvas.renderAll();
        refreshLayerList();
      });

      /* 削除ボタン */
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'layer-del-btn';
      del.textContent = '✕';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        canvas.remove(obj);
        if (activeText === obj) { activeText = null; textInput.value = ''; }
        if (obj.isStamp) { /* スタンプ削除後は色行を更新 */ }
        canvas.renderAll();
        refreshLayerList();
      });

      item.appendChild(lbl);
      item.appendChild(upBtn);
      item.appendChild(downBtn);
      item.appendChild(del);

      /* クリックで選択 */
      item.addEventListener('click', function () {
        canvas.setActiveObject(obj);
        canvas.renderAll();
        syncControlsToText(obj);
        refreshLayerList();
      });

      layerListEl.appendChild(item);
    });
  }

  /* テキスト選択/解除でパネルも更新 */
  canvas.on('selection:created',  function () { refreshLayerList(); });
  canvas.on('selection:updated',  function () { refreshLayerList(); });
  canvas.on('selection:cleared',  function () { refreshLayerList(); });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     履歴（Undo）管理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var undoStack   = [];       /* JSONスナップショット配列 */
  var historyLock = false;    /* 復元中に再保存しないフラグ */
  var MAX_HISTORY = 30;
  var undoBtn     = document.getElementById('undo-btn');

  function snapshotCanvas() {
    if (historyLock) return;
    var json = JSON.stringify(canvas.toJSON(
      ['globalCompositeOperation', 'selectable', 'evented', 'isStamp', 'stampId', 'stampName']
    ));
    /* 直前と同じ状態なら積まない */
    if (undoStack.length && undoStack[undoStack.length - 1] === json) return;
    undoStack.push(json);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    undoBtn.disabled = undoStack.length <= 1;
  }

  /* デバウンス版スナップショット（テキスト入力中の連打防止） */
  var snapshotDebounced = debounce(snapshotCanvas, 400);

  /* オブジェクト追加・削除・移動・変形時に保存 */
  canvas.on('object:added',    snapshotCanvas);
  canvas.on('object:removed',  snapshotCanvas);
  canvas.on('object:modified', snapshotCanvas);
  /* テキスト編集中はデバウンスで保存 */
  canvas.on('text:changed',    snapshotDebounced);

  function undoCanvas() {
    if (undoStack.length <= 1) return;
    undoStack.pop(); /* 現在の状態を捨てる */
    var prev = undoStack[undoStack.length - 1];
    historyLock = true;
    canvas.loadFromJSON(prev, function () {
      /* フレーム・テキスト・スタンプ参照を再同期 */
      activeText = null; textureObj = null; frameObj = null;
      canvas.getObjects().forEach(function (obj) {
        if (obj.isFrame)   { frameObj   = obj; }
        if (obj.isTexture) { textureObj = obj; }
      });
      if (frameObj) canvas.bringToFront(frameObj);
      canvas.renderAll();
      refreshLayerList();
      historyLock = false;
      undoBtn.disabled = undoStack.length <= 1;
    });
  }

  undoBtn.addEventListener('click', undoCanvas);

  /* キーボード Ctrl+Z / Cmd+Z */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      /* テキスト編集中は標準のundoに任せる */
      var active = canvas.getActiveObject();
      if (active && active.isEditing) return;
      e.preventDefault();
      undoCanvas();
    }
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     テキスト追加
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  document.getElementById('add-text-btn').addEventListener('click', function () {
    var existingTexts = getTextObjects();
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
    refreshLayerList();
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ユーティリティ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function generateId() {
    /* 先頭 "sIm" 固定 + ランダム17文字 = 計20文字 */
    var chars  = 'abcdefghjkmnpqrstuvwxyz23456789';
    var arr    = new Uint8Array(17);
    crypto.getRandomValues(arr);
    var result = 'sIm';
    for (var i = 0; i < 17; i++) {
      result += chars[arr[i] % chars.length];
    }
    return result;
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

  function showShareModal(url, id) {
    document.getElementById('share-id-code').textContent = id || '';
    shareUrlInput.value = url;
    shareModal.style.display = 'flex';
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

    var id = generateId();

    var canvasData = canvas.toJSON(['globalCompositeOperation', 'selectable', 'evented', 'isStamp', 'stampId', 'stampName']);
    canvasData._canvasWidth  = CANVAS_W;
    canvasData._canvasHeight = CANVAS_H;
    var canvasJson = JSON.stringify(canvasData);

    var previewDataUrl = canvas.toDataURL({
      format    : 'jpeg',
      quality   : 0.75,
      multiplier: 500 / CANVAS_W,
    });
    var previewBlob = dataURLtoBlob(previewDataUrl);
    var filename    = id + '.jpg';

    /* プレビュー画像生成 */
    var previewDataUrl;
    try {
      previewDataUrl = canvas.toDataURL({
        format    : 'jpeg',
        quality   : 0.75,
        multiplier: 500 / CANVAS_W,
      });
    } catch (ex) {
      console.error('toDataURL failed:', ex);
      showError('プレビュー生成に失敗しました：' + (ex.message || ex));
      setBtnLoading(false);
      return;
    }
    var previewBlob = dataURLtoBlob(previewDataUrl);
    var filename    = id + '.jpg';

    supabaseClient.storage
      .from('previews')
      .upload(filename, previewBlob, { contentType: 'image/jpeg', upsert: false })
      .then(function (uploadResult) {
        if (uploadResult.error) {
          console.error('storage upload error:', uploadResult.error);
          throw new Error('[ストレージ] ' + uploadResult.error.message);
        }

        var urlResult  = supabaseClient.storage.from('previews').getPublicUrl(filename);
        var publicUrl  = urlResult.data.publicUrl;

        return supabaseClient.from('designs').insert({
          id              : id,
          canvas_json     : canvasJson,
          base_color      : (canvas.backgroundColor || '#3399FF').toUpperCase(),
          preview_url     : publicUrl,
          base_skin       : currentBase,
          text_value      : textInput.value,
          font_family     : currentFont,
          font_size       : currentSize,
          text_color      : currentTextColor(),
          model_id        : currentModel ? currentModel.id : null,
          is_out_of_gamut : gamut.isWarning,
        });
      })
      .then(function (insertResult) {
        if (insertResult.error) {
          console.error('db insert error:', insertResult.error);
          throw new Error('[DB] ' + insertResult.error.message);
        }

        var shareUrl = location.origin + location.pathname + '?id=' + id;
        setBtnLoading(false);
        showShareModal(shareUrl, id);
      })
      .catch(function (err) {
        console.error('saveDesign error:', err);
        showError('保存に失敗しました：' + (err.message || '通信エラー'));
        setBtnLoading(false);
      });
  }

  saveBtn.addEventListener('click', saveDesign);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ガマット UI イベント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  (function () {
    var el = getGamutEls();
    if (!el.warn) return;

    /* 「詳細を確認」トグル */
    if (el.detBtn && el.detail) {
      el.detBtn.addEventListener('click', function () {
        var open = el.detail.classList.toggle('open');
        el.detBtn.textContent = open ? '閉じる' : '詳細を確認';
      });
    }

    /* 印刷プレビュートグル */
    if (el.toggle) {
      el.toggle.addEventListener('change', function () {
        gamut.isPrint = this.checked;
        if (!gamut.isWarning) return;
        canvas.backgroundColor = gamut.isPrint ? gamut.printHex : gamut.originalHex;
        canvas.renderAll();
      });
    }
  }());

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     共有モーダル
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /* ID コピーボタン */
  var shareIdCopyTimer = null;
  document.getElementById('share-id-copy-btn').addEventListener('click', function () {
    var idText = document.getElementById('share-id-code').textContent;
    var onCopied = function () {
      var msg = document.getElementById('share-id-copy-msg');
      msg.classList.add('visible');
      clearTimeout(shareIdCopyTimer);
      shareIdCopyTimer = setTimeout(function () { msg.classList.remove('visible'); }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(idText).then(onCopied);
    } else {
      try { document.execCommand('copy'); onCopied(); } catch (e) {}
    }
  });

  /* URL コピーボタン */
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
     復元処理（ID指定）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function loadDesignById(id, onError) {
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
              } else if (obj.isStamp) {
                /* スタンプグループ: 追加のセットアップ不要（JSON復元で isStamp/stampId が復元される） */
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
            refreshLayerList();
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

          var bgHex = (data.base_color || '#FFFFFF').toUpperCase();
          hexChip.style.backgroundColor = bgHex;
          hexCode.textContent            = bgHex;
          var bgHsv = hexToHsv(bgHex);
          bgHue = bgHsv[0]; bgSat = bgHsv[1]; bgVal = bgHsv[2];
          hueSlider.value = Math.round(bgHue);
          renderBg();

          var tcHex = (data.text_color || '#000000').toUpperCase();
          tcHexChip.style.backgroundColor = tcHex;
          tcHexCode.textContent            = tcHex;
          var tcHsv = hexToHsv(tcHex);
          tcHue = tcHsv[0]; tcSat = tcHsv[1]; tcVal = tcHsv[2];
          tcHueSl.value = Math.round(tcHue);
          renderTc();

          /* ページ先頭へスクロール */
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      })
      .catch(function (err) {
        console.error('loadDesign error:', err);
        showLoadOverlay(false);
        if (typeof onError === 'function') {
          onError(err.message || '通信エラー');
        } else {
          showError('デザインの読み込みに失敗しました：' + (err.message || '通信エラー'));
        }
      });
  }

  /* URLパラメータからの自動復元 */
  function loadDesignFromUrl() {
    var id = new URLSearchParams(location.search).get('id');
    if (id) loadDesignById(id);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     スタンプ機能
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var stampCatTabsEl  = document.getElementById('stamp-cat-tabs');
  var stampGridEl     = document.getElementById('stamp-grid');
  var stampLoadingEl  = document.getElementById('stamp-loading');

  /* スタンプ＆カテゴリ取得 */
  function loadStamps() {
    if (!supabaseClient) return;
    Promise.all([
      supabaseClient.from('stamp_categories').select('*').order('sort_order'),
      supabaseClient.from('stamps').select('*').order('sort_order'),
    ]).then(function (results) {
      var catRes    = results[0];
      var stampRes  = results[1];
      if (catRes.error || stampRes.error) return;
      stampState.cats   = catRes.data  || [];
      stampState.stamps = stampRes.data || [];
      stampState.currentCatId = stampState.cats.length ? stampState.cats[0].id : null;
      renderStampCatTabs();
      renderStampGrid();
      if (stampLoadingEl) stampLoadingEl.style.display = 'none';
    });
  }

  /* カテゴリタブ描画 */
  function renderStampCatTabs() {
    stampCatTabsEl.innerHTML = '';
    if (!stampState.cats.length) return;

    stampState.cats.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stamp-cat-btn' + (cat.id === stampState.currentCatId ? ' active' : '');
      btn.dataset.catId = cat.id;
      btn.textContent   = cat.name;
      btn.style.setProperty('--cat-color', cat.tag_color || '#6366f1');
      btn.addEventListener('click', function () {
        stampState.currentCatId = cat.id;
        renderStampCatTabs();
        renderStampGrid();
      });
      stampCatTabsEl.appendChild(btn);
    });
  }

  /* スタンプグリッド描画 */
  function renderStampGrid() {
    stampGridEl.innerHTML = '';
    var filtered = stampState.currentCatId
      ? stampState.stamps.filter(function (s) { return s.category_id === stampState.currentCatId; })
      : stampState.stamps;

    if (!filtered.length) {
      var emp = document.createElement('p');
      emp.className   = 'stamp-empty';
      emp.textContent = 'スタンプがありません';
      stampGridEl.appendChild(emp);
      return;
    }

    filtered.forEach(function (stamp) {
      var btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'stamp-item';
      btn.title     = stamp.name;

      var img = document.createElement('img');
      img.src   = stamp.svg_url;
      img.alt   = stamp.name;
      img.style.width  = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      btn.appendChild(img);

      btn.addEventListener('click', function () {
        addStampToCanvas(stamp);
      });
      stampGridEl.appendChild(btn);
    });
  }

  /* キャンバスにスタンプを追加 */
  function addStampToCanvas(stamp) {
    if (!frameObj && !canvas.getObjects().length) return; /* 機種未選択 */
    fabric.loadSVGFromURL(stamp.svg_url, function (objects, options) {
      if (!objects || !objects.length) { showError('SVGの読み込みに失敗しました'); return; }

      var group = fabric.util.groupSVGElements(objects, options);
      var size  = Math.round(CANVAS_W * 0.3); /* キャンバス幅の30% */
      var scale = size / Math.max(group.width, group.height);
      group.set({
        left       : CANVAS_W / 2,
        top        : CANVAS_H / 2,
        originX    : 'center',
        originY    : 'center',
        scaleX     : scale,
        scaleY     : scale,
        selectable : true,
        evented    : true,
        isStamp    : true,
        stampId    : stamp.id,
        stampName  : stamp.name,
      });

      var idx = frameObj ? canvas.getObjects().indexOf(frameObj) : canvas.getObjects().length;
      canvas.insertAt(group, Math.max(0, idx));
      if (frameObj) canvas.bringToFront(frameObj);
      canvas.setActiveObject(group);
      canvas.renderAll();
      refreshLayerList();
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     フッター: ID入力で呼び出し
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  (function () {
    var recallInput = document.getElementById('recall-id-input');
    var recallBtn   = document.getElementById('recall-btn');
    var recallMsg   = document.getElementById('recall-msg');

    function doRecall() {
      var id = recallInput.value.trim();
      if (!id) {
        recallMsg.textContent = 'IDを入力してください';
        recallMsg.className   = 'recall-msg';
        return;
      }
      recallMsg.textContent = '';
      recallBtn.disabled    = true;
      loadDesignById(id, function (errMsg) {
        recallMsg.textContent = 'IDが見つかりません：' + errMsg;
        recallMsg.className   = 'recall-msg';
        recallBtn.disabled    = false;
      });
      /* 成功時はloadOverlayが消えてページトップへ。ボタンを戻す */
      setTimeout(function () { recallBtn.disabled = false; }, 5000);
    }

    recallBtn.addEventListener('click', doRecall);
    recallInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doRecall();
    });
  })();

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     モバイル ステップカルーセル
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var currentStep = 0;
  var totalSteps  = 6;

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
  /* スタンプ読み込み */
  loadStamps();
  /* レイヤーパネル初期表示 */
  refreshLayerList();
  /* URLにidが含まれている場合はデザイン復元 */
  if (new URLSearchParams(location.search).get('id')) loadDesignFromUrl();

}());
