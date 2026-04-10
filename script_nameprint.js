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
  /* 本体カラー */
  var bgHue = 200, bgSat = 0.75, bgVal = 0.90, bgDrag = false;
  /* 文字色 */
  var tcHue = 0,   tcSat = 0,    tcVal = 1.00, tcDrag = false;

  var currentBase = 'BLK';
  var currentFont = 'Roboto';
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
  var copyBtn    = document.getElementById('copy-btn');
  var copyMsg    = document.getElementById('copy-msg');

  var tcSvMap    = document.getElementById('tc-sv-map');
  var tcSvCursor = document.getElementById('tc-sv-cursor');
  var tcHueSl    = document.getElementById('tc-hue-slider');
  var tcHexChip  = document.getElementById('tc-hex-chip');
  var tcHexCode  = document.getElementById('tc-hex-code');

  var textInput  = document.getElementById('text-input');
  var fontSelect = document.getElementById('font-select');
  var fontSizeEl = document.getElementById('font-size');
  var sizeBadge  = document.getElementById('size-badge');

  var canvasWrap  = document.getElementById('canvas-wrap');
  var canvasStage = document.getElementById('canvas-stage');

  var saveBtn      = document.getElementById('save-btn');
  var shareModal   = document.getElementById('share-modal');
  var shareUrlInput = document.getElementById('share-url-input');
  var shareCopyBtn = document.getElementById('share-copy-btn');
  var shareCopyMsg = document.getElementById('share-copy-msg');
  var shareCloseBtn = document.getElementById('share-close-btn');
  var errorToast   = document.getElementById('error-toast');
  var loadOverlay  = document.getElementById('load-overlay');

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

  /* レスポンシブスケーリング */
  function scaleCanvas() {
    var available = canvasStage.clientWidth;
    var scale = Math.min(1, available / CANVAS_W);
    canvasWrap.style.transform = 'scale(' + scale + ')';
    canvasWrap.style.transformOrigin = 'top center';
    canvasStage.style.height = Math.ceil(CANVAS_H * scale) + 'px';
  }
  window.addEventListener('resize', scaleCanvas);
  scaleCanvas();

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     画像ロード（texture + frame）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function loadImages(baseColor) {
    if (textureObj) { canvas.remove(textureObj); textureObj = null; }
    if (frameObj)   { canvas.remove(frameObj);   frameObj   = null; }

    var loaded = 0;
    function onLoad() {
      if (++loaded === 2) {
        canvas.bringToFront(textureObj);
        canvas.bringToFront(frameObj);
        canvas.renderAll();
      }
    }

    fabric.Image.fromURL('./images/texture.png', function (img) {
      img.set({
        left: 0, top: 0,
        scaleX: CANVAS_W / img.width,
        scaleY: CANVAS_H / img.height,
        selectable: false, evented: false,
        globalCompositeOperation: 'multiply',
      });
      canvas.add(img);
      textureObj = img;
      onLoad();
    });

    fabric.Image.fromURL('./images/' + baseColor + '_frame.png', function (img) {
      img.set({
        left: 0, top: 0,
        scaleX: CANVAS_W / img.width,
        scaleY: CANVAS_H / img.height,
        selectable: false, evented: false,
        globalCompositeOperation: 'source-over',
      });
      canvas.add(img);
      frameObj = img;
      onLoad();
    });
  }

  loadImages(currentBase);

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
      var idx = textureObj ? canvas.getObjects().indexOf(textureObj) : canvas.getObjects().length;
      canvas.insertAt(activeText, Math.max(0, idx));
      canvas.setActiveObject(activeText);
    }
    return activeText;
  }

  function updateText(text) {
    var t = ensureText(text);
    t.set('text', text);
    if (textureObj) canvas.bringToFront(textureObj);
    if (frameObj)   canvas.bringToFront(frameObj);
    canvas.renderAll();
  }

  textInput.addEventListener('input', function () { updateText(this.value); });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     フォント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  fontSelect.addEventListener('change', function () {
    currentFont = this.value;
    if (!activeText) return;
    document.fonts.load('700 1em "' + currentFont + '"').then(function () {
      activeText.set('fontFamily', currentFont);
      canvas.renderAll();
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
      var top = pos === 'top' ? 70 : pos === 'center' ? CANVAS_H / 2 : CANVAS_H - 70;
      activeText.set({ left: CANVAS_W / 2, top: top });
      activeText.setCoords();
      canvas.renderAll();
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     コピーボタン（背景色HEX）
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var copyTimer = null;
  function showCopyMsg() {
    copyMsg.classList.add('visible');
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () { copyMsg.classList.remove('visible'); }, 2500);
  }
  copyBtn.addEventListener('click', function () {
    var hex = hexCode.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hex).then(showCopyMsg); return;
    }
    var ta = document.createElement('textarea');
    ta.value = hex;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopyMsg(); } catch (e) {}
    document.body.removeChild(ta);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ユーティリティ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    /* フォールバック (古いブラウザ) */
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

    /* 1. Canvas JSON（カスタムプロパティを含めてシリアライズ） */
    var canvasJson = JSON.stringify(
      canvas.toJSON(['globalCompositeOperation', 'selectable', 'evented'])
    );

    /* 2. プレビュー画像生成（500px幅・JPEG 0.75） */
    var previewDataUrl = canvas.toDataURL({
      format    : 'jpeg',
      quality   : 0.75,
      multiplier: 500 / CANVAS_W,
    });
    var previewBlob = dataURLtoBlob(previewDataUrl);
    var filename    = id + '.jpg';

    /* 3. Storage アップロード → DB 保存 */
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
        });
      })
      .then(function (insertResult) {
        if (insertResult.error) throw insertResult.error;

        /* 4. 共有URL発行 */
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

        /* Canvas 復元 */
        canvas.loadFromJSON(data.canvas_json, function () {
          /* オブジェクト参照を再割り当て */
          activeText = null; textureObj = null; frameObj = null;
          canvas.getObjects().forEach(function (obj) {
            if (obj.type === 'i-text' || obj.type === 'text') {
              activeText = obj;
            } else if (obj.type === 'image') {
              if (obj.globalCompositeOperation === 'multiply') {
                textureObj = obj;
              } else {
                frameObj = obj;
              }
            }
          });
          canvas.renderAll();
          showLoadOverlay(false);
        });

        /* UI 同期 */
        currentBase        = data.base_skin   || 'BLK';
        currentFont        = data.font_family || 'Roboto';
        currentSize        = data.font_size   || 36;
        textInput.value    = data.text_value  || '';
        fontSelect.value   = currentFont;
        fontSizeEl.value   = currentSize;
        sizeBadge.textContent = currentSize;

        /* カラートグルボタン */
        document.querySelectorAll('.toggle-btn').forEach(function (b) {
          b.classList.toggle('active', b.dataset.color === currentBase);
        });

        /* 本体カラー表示 */
        var bgHex = (data.base_color || '#3399FF').toUpperCase();
        hexChip.style.backgroundColor = bgHex;
        hexCode.textContent            = bgHex;
        var bgHsv = hexToHsv(bgHex);
        bgHue = bgHsv[0]; bgSat = bgHsv[1]; bgVal = bgHsv[2];
        hueSlider.value = Math.round(bgHue);
        renderBg();

        /* 文字色表示 */
        var tcHex = (data.text_color || '#FFFFFF').toUpperCase();
        tcHexChip.style.backgroundColor = tcHex;
        tcHexCode.textContent            = tcHex;
        var tcHsv = hexToHsv(tcHex);
        tcHue = tcHsv[0]; tcSat = tcHsv[1]; tcVal = tcHsv[2];
        tcHueSl.value = Math.round(tcHue);
        renderTc();
      })
      .catch(function (err) {
        console.error('loadDesign error:', err);
        showError('デザインの読み込みに失敗しました：' + (err.message || '通信エラー'));
        showLoadOverlay(false);
      });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     アコーディオン
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* 右カラム: 排他的アコーディオン（常に1つだけ開く） */
  var exclusiveIds = ['body-text', 'body-layout', 'body-bgcolor'];

  function openExclusive(targetId) {
    exclusiveIds.forEach(function (id) {
      var body   = document.getElementById(id);
      var header = document.querySelector('[data-target="' + id + '"]');
      if (!body || !header) return;
      if (id === targetId) {
        body.style.maxHeight = body.scrollHeight + 'px';
        header.classList.add('open');
        body.addEventListener('transitionend', function onEnd() {
          body.style.maxHeight = 'none';
          body.removeEventListener('transitionend', onEnd);
        });
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        requestAnimationFrame(function () { body.style.maxHeight = '0'; });
        header.classList.remove('open');
      }
    });
  }

  exclusiveIds.forEach(function (id) {
    var header = document.querySelector('[data-target="' + id + '"]');
    if (!header) return;
    header.addEventListener('click', function () {
      if (this.classList.contains('open')) return; /* 既に開いていれば何もしない */
      openExclusive(id);
    });
  });

  /* プレビュー: 単独トグル（排他グループ外） */
  (function () {
    var header = document.querySelector('[data-target="body-preview"]');
    if (!header) return;
    header.addEventListener('click', function () {
      var body   = document.getElementById('body-preview');
      var isOpen = this.classList.contains('open');
      if (isOpen) {
        body.style.maxHeight = body.scrollHeight + 'px';
        requestAnimationFrame(function () { body.style.maxHeight = '0'; });
        header.classList.remove('open');
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        header.classList.add('open');
        body.addEventListener('transitionend', function onEnd() {
          body.style.maxHeight = 'none';
          body.removeEventListener('transitionend', onEnd);
          scaleCanvas();
        });
      }
    });
  })();

  /* 初期状態: プレビューとテキスト設定を即展開 */
  (function () {
    ['body-preview', 'body-text'].forEach(function (id) {
      var body   = document.getElementById(id);
      var header = document.querySelector('[data-target="' + id + '"]');
      if (!body || !header) return;
      body.style.transition = 'none';
      body.style.maxHeight  = 'none';
      header.classList.add('open');
      requestAnimationFrame(function () {
        body.style.transition = '';
        if (id === 'body-preview') scaleCanvas();
      });
    });
  })();

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期描画
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  hueSlider.value  = bgHue;
  tcHueSl.value    = tcHue;
  fontSizeEl.value = currentSize;
  renderBg();
  renderTc();

  /* URLにidが含まれている場合は復元 */
  loadDesignFromUrl();

}());
