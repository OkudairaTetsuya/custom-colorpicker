/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   管理画面 — admin.js
   Supabase + Fabric.js + opentype.js
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  'use strict';

  var CANVAS_W = 300;
  var CANVAS_H = 600;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Supabase クライアント
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('your-project-id')) {
    document.body.innerHTML = '<p style="padding:40px;color:red">supabase.config.js の設定が未完了です</p>';
    throw new Error('Supabase not configured');
  }
  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     認証
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var loginScreen   = document.getElementById('login-screen');
  var adminScreen   = document.getElementById('admin-screen');
  var loginForm     = document.getElementById('login-form');
  var passwordInput = document.getElementById('password-input');
  var loginError    = document.getElementById('login-error');

  function isAuthed() { return sessionStorage.getItem('admin_authed') === '1'; }

  function showAdmin() {
    loginScreen.style.display = 'none';
    adminScreen.style.display = 'block';
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var expected = window.ADMIN_PASSWORD || '';
    if (!expected || expected === 'your-admin-password-here') {
      showToast('ADMIN_PASSWORD を supabase.config.js に設定してください', 'error');
      return;
    }
    if (passwordInput.value === expected) {
      sessionStorage.setItem('admin_authed', '1');
      loginError.style.visibility = 'hidden';
      showAdmin();
      initAdmin();
    } else {
      loginError.style.visibility = 'visible';
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    sessionStorage.removeItem('admin_authed');
    loginScreen.style.display = 'flex';
    adminScreen.style.display = 'none';
  });

  if (isAuthed()) {
    showAdmin();
    initAdmin();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     タブ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = this.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(function (b) {
          b.classList.toggle('active', b.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-pane').forEach(function (p) {
          p.style.display = p.id === 'tab-' + tab ? 'block' : 'none';
        });
        if (tab === 'models') loadModels();
      });
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     トースト通知
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var toastEl    = document.getElementById('toast');
  var toastTimer = null;

  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className   = 'toast visible' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 3500);
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ユーティリティ
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('ja-JP') + '\u00A0' +
      d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     デザイン一覧
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var designsTbody = document.getElementById('designs-tbody');
  var designsCount = document.getElementById('designs-count');
  var designsEmpty = document.getElementById('designs-empty');
  var cachedModels = [];

  function loadDesigns() {
    sb.from('designs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { showToast('デザイン取得失敗: ' + res.error.message, 'error'); return; }
        var rows = res.data || [];
        designsCount.textContent = rows.length + ' 件';
        designsTbody.innerHTML   = '';
        designsEmpty.style.display = rows.length ? 'none' : 'block';
        rows.forEach(function (d) { designsTbody.appendChild(buildDesignRow(d)); });
      });
  }

  function buildDesignRow(d) {
    var tr = document.createElement('tr');

    /* プレビュー */
    var tdPrev = document.createElement('td');
    if (d.preview_url) {
      var img = document.createElement('img');
      img.src       = d.preview_url;
      img.className = 'thumb';
      img.alt       = 'preview';
      tdPrev.appendChild(img);
    } else { tdPrev.textContent = '—'; }

    /* 作成日時 */
    var tdDate = document.createElement('td');
    tdDate.textContent = formatDate(d.created_at);
    tdDate.className   = 'mono small';

    /* テキスト */
    var tdText = document.createElement('td');
    tdText.textContent = d.text_value || '(なし)';

    /* 背景色 */
    var tdColor = document.createElement('td');
    var swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = d.base_color || '#ccc';
    var code = document.createElement('code');
    code.textContent = (d.base_color || '').toUpperCase();
    tdColor.appendChild(swatch);
    tdColor.appendChild(code);

    /* 出力設定 */
    var tdExp = document.createElement('td');
    tdExp.className = 'export-cell';

    var sel = document.createElement('select');
    sel.className = 'model-sel';
    if (d.model_id) sel.dataset.modelId = d.model_id;
    buildModelOptions(sel);
    /* フロントで選んだ機種を初期選択 */
    if (d.model_id) sel.value = d.model_id;

    var btn = document.createElement('button');
    btn.textContent = 'SVG 出力';
    btn.className   = 'btn-export';
    btn.addEventListener('click', function () {
      var opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) { showToast('機種を選択してください', 'error'); return; }
      exportSVG(d, {
        name    : opt.dataset.name,
        widthMm : parseFloat(opt.dataset.w),
        heightMm: parseFloat(opt.dataset.h),
      });
    });

    tdExp.appendChild(sel);
    tdExp.appendChild(btn);

    tr.append(tdPrev, tdDate, tdText, tdColor, tdExp);
    return tr;
  }

  function buildModelOptions(sel) {
    sel.innerHTML = '<option value="">— 機種を選択 —</option>';
    cachedModels.forEach(function (m) {
      var o = document.createElement('option');
      o.value       = m.id;
      o.dataset.name = m.name;
      o.dataset.w    = m.width_mm;
      o.dataset.h    = m.height_mm;
      o.textContent  = m.name + '\u00A0(' + m.width_mm + '\u00D7' + m.height_mm + 'mm)';
      sel.appendChild(o);
    });
  }

  function refreshAllModelSelects() {
    /* 各行のセレクトを再構築し、data-model-id 属性で選択を復元 */
    document.querySelectorAll('.model-sel').forEach(function (sel) {
      var savedId = sel.dataset.modelId || sel.value;
      buildModelOptions(sel);
      if (savedId) sel.value = savedId;
    });
  }

  document.getElementById('refresh-designs-btn').addEventListener('click', function () {
    loadModels(true);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     機種マスター
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var modelsTbody    = document.getElementById('models-tbody');
  var modelsEmpty    = document.getElementById('models-empty');
  var addModelForm   = document.getElementById('add-model-form');
  var modelBrandEl   = document.getElementById('model-brand');
  var modelNameEl    = document.getElementById('model-name');
  var modelSlugEl    = document.getElementById('model-slug');
  var modelWidthEl   = document.getElementById('model-width');
  var modelHeightEl  = document.getElementById('model-height');

  function loadModels(thenDesigns) {
    return sb.from('case_models')
      .select('*')
      .order('name', { ascending: true })
      .then(function (res) {
        if (res.error) { showToast('機種取得失敗: ' + res.error.message, 'error'); return; }
        cachedModels = res.data || [];
        modelsTbody.innerHTML = '';
        modelsEmpty.style.display = cachedModels.length ? 'none' : 'block';
        cachedModels.forEach(function (m) { modelsTbody.appendChild(buildModelRow(m)); });
        refreshAllModelSelects();
        if (thenDesigns) loadDesigns();
      });
  }

  function buildModelRow(m) {
    var tr = document.createElement('tr');

    /* 編集可能セル */
    function eCell(val, field, type) {
      var td    = document.createElement('td');
      var span  = document.createElement('span');
      span.textContent = val;
      span.className   = 'ev';
      var input = document.createElement('input');
      input.type       = type || 'text';
      input.value      = val;
      input.className  = 'ei';
      input.style.display = 'none';
      if (type === 'number') input.step = '0.01';
      td.dataset.field    = field;
      td.dataset.original = val;
      td.append(span, input);
      return td;
    }

    var cells = [
      eCell(m.brand || '',  'brand'),
      eCell(m.name,         'name'),
      eCell(m.slug,         'slug'),
      eCell(m.width_mm,     'width_mm',  'number'),
      eCell(m.height_mm,    'height_mm', 'number'),
    ];

    /* 操作 */
    var tdAct = document.createElement('td');
    tdAct.className = 'action-cell';

    var editBtn   = btn('編集', 'btn-sm');
    var saveBtn   = btn('保存', 'btn-sm btn-primary', true);
    var cancelBtn = btn('取消', 'btn-sm', true);
    var delBtn    = btn('削除', 'btn-sm btn-danger');

    editBtn.addEventListener('click', function () {
      cells.forEach(function (td) {
        td.querySelector('.ev').style.display = 'none';
        td.querySelector('.ei').style.display = 'inline-block';
      });
      toggle(editBtn, saveBtn, cancelBtn, delBtn);
    });

    cancelBtn.addEventListener('click', function () {
      cells.forEach(function (td) {
        td.querySelector('.ei').value = td.dataset.original;
        td.querySelector('.ev').style.display = '';
        td.querySelector('.ei').style.display = 'none';
      });
      toggle(saveBtn, cancelBtn, editBtn, delBtn);
    });

    saveBtn.addEventListener('click', function () {
      var updates = {};
      cells.forEach(function (td) { updates[td.dataset.field] = td.querySelector('.ei').value; });
      sb.from('case_models').update(updates).eq('id', m.id).then(function (res) {
        if (res.error) { showToast('更新失敗: ' + res.error.message, 'error'); return; }
        showToast('更新しました');
        loadModels();
      });
    });

    delBtn.addEventListener('click', function () {
      if (!confirm('"' + m.name + '" を削除しますか？')) return;
      sb.from('case_models').delete().eq('id', m.id).then(function (res) {
        if (res.error) { showToast('削除失敗: ' + res.error.message, 'error'); return; }
        showToast('削除しました');
        loadModels();
      });
    });

    tdAct.append(editBtn, saveBtn, cancelBtn, delBtn);
    cells.forEach(function (c) { tr.appendChild(c); });
    tr.appendChild(tdAct);
    return tr;
  }

  function btn(label, cls, hidden) {
    var b = document.createElement('button');
    b.textContent    = label;
    b.className      = cls;
    b.style.display  = hidden ? 'none' : '';
    return b;
  }

  function toggle(hideA, hideB, showA, showB) {
    hideA.style.display = 'none';
    hideB.style.display = 'none';
    showA.style.display = '';
    showB.style.display = '';
  }

  /* 追加フォーム */
  document.getElementById('add-model-btn').addEventListener('click', function () {
    addModelForm.style.display = 'block';
    modelNameEl.focus();
  });

  document.getElementById('cancel-model-btn').addEventListener('click', function () {
    addModelForm.style.display = 'none';
    clearModelForm();
  });

  modelNameEl.addEventListener('input', function () {
    modelSlugEl.value = this.value.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  });

  function clearModelForm() {
    [modelBrandEl, modelNameEl, modelSlugEl, modelWidthEl, modelHeightEl].forEach(function (el) { el.value = ''; });
  }

  document.getElementById('submit-model-btn').addEventListener('click', function () {
    var brand  = modelBrandEl.value.trim();
    var name   = modelNameEl.value.trim();
    var slug   = modelSlugEl.value.trim();
    var width  = parseFloat(modelWidthEl.value);
    var height = parseFloat(modelHeightEl.value);
    if (!brand || !name || !slug || isNaN(width) || isNaN(height)) {
      showToast('全ての項目を入力してください', 'error'); return;
    }
    sb.from('case_models').insert({ brand: brand, name: name, slug: slug, width_mm: width, height_mm: height })
      .then(function (res) {
        if (res.error) { showToast('追加失敗: ' + res.error.message, 'error'); return; }
        showToast(name + ' を追加しました');
        addModelForm.style.display = 'none';
        clearModelForm();
        loadModels();
      });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SVGエクスポート
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* フォントキャッシュ */
  var fontCache = {};

  /* フォント名 → WOFF CDN URL（fontsource via jsDelivr） */
  var FONT_WOFF = {
    'Roboto':
      'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5/files/roboto-latin-400-normal.woff',
    'Playfair Display':
      'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/files/playfair-display-latin-700-italic.woff',
    'Permanent Marker':
      'https://cdn.jsdelivr.net/npm/@fontsource/permanent-marker@5/files/permanent-marker-latin-400-normal.woff',
  };

  function loadOtFont(family) {
    if (fontCache[family]) return Promise.resolve(fontCache[family]);
    var url = FONT_WOFF[family] || FONT_WOFF['Roboto'];
    return new Promise(function (resolve, reject) {
      opentype.load(url, function (err, font) {
        if (err) { reject(err); } else { fontCache[family] = font; resolve(font); }
      });
    });
  }

  /* "matrix(a b c d e f)" をパース */
  function parseMatrix(t) {
    var d = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    if (!t) return d;
    var m = t.match(/matrix\(([^)]+)\)/);
    if (!m) return d;
    var v = m[1].trim().split(/[\s,]+/).map(Number);
    return { a: v[0], b: v[1], c: v[2], d: v[3], e: v[4], f: v[5] };
  }

  /* style 属性から特定プロパティを抽出 */
  function styleVal(styleStr, prop) {
    var re = new RegExp(prop + '\\s*:\\s*([^;]+)');
    var m  = styleStr.match(re);
    return m ? m[1].trim() : null;
  }

  /* SVG内の <text> 要素を opentype.js でパス化 */
  function textToPath(svgString) {
    var doc  = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    var els  = Array.from(doc.querySelectorAll('text'));
    if (!els.length) return Promise.resolve(svgString);

    var jobs = els.map(function (textEl) {
      var parentG   = textEl.parentElement;
      var m         = parseMatrix(parentG ? parentG.getAttribute('transform') : '');
      var family    = textEl.getAttribute('font-family') || 'Roboto';
      var fontSize  = parseFloat(textEl.getAttribute('font-size') || '36');
      var styleStr  = textEl.getAttribute('style') || '';
      var fill      = styleVal(styleStr, 'fill') || '#000000';
      var opacity   = styleVal(styleStr, 'opacity') || '1';

      return loadOtFont(family).then(function (font) {
        var dAttr = '';
        Array.from(textEl.querySelectorAll('tspan')).forEach(function (ts) {
          var text = ts.textContent;
          if (!text) return;
          var tx = parseFloat(ts.getAttribute('x') || '0');
          var ty = parseFloat(ts.getAttribute('y') || '0');
          var p  = font.getPath(text, tx, ty, fontSize);
          p.transform(m.a, m.b, m.c, m.d, m.e, m.f);
          dAttr += p.toPathData(3);
        });

        if (!dAttr || !parentG || !parentG.parentElement) return;

        var pathEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d',       dAttr);
        pathEl.setAttribute('fill',    fill);
        pathEl.setAttribute('opacity', opacity);
        parentG.parentElement.replaceChild(pathEl, parentG);

      }).catch(function (err) {
        console.warn('[textToPath] フォント読み込み失敗 (' + family + '):', err.message);
        /* フォールバック: <text> 要素をそのまま維持 */
      });
    });

    return Promise.all(jobs).then(function () {
      return new XMLSerializer().serializeToString(doc);
    });
  }

  /* SVG後処理:
     - width/height を mm 単位に書き換え
     - viewBox を 0 0 W H に正規化（上部余白の除去）
     - clipPath でキャンバス外へのはみ出しをマスク
  */
  function processSvg(svgStr, wMm, hMm) {
    var parser = new DOMParser();
    var doc    = parser.parseFromString(svgStr, 'image/svg+xml');
    var svgEl  = doc.querySelector('svg');
    if (!svgEl) return svgStr;

    /* viewBox からピクセル寸法を取得 */
    var vbParts = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    var pxW = (vbParts.length >= 4 && vbParts[2] > 0) ? vbParts[2]
            : parseFloat(svgEl.getAttribute('width'))  || 300;
    var pxH = (vbParts.length >= 4 && vbParts[3] > 0) ? vbParts[3]
            : parseFloat(svgEl.getAttribute('height')) || 600;

    /* mm 寸法を設定・viewBox を 0 起点に正規化 */
    svgEl.setAttribute('width',    wMm + 'mm');
    svgEl.setAttribute('height',   hMm + 'mm');
    svgEl.setAttribute('viewBox',  '0 0 ' + pxW + ' ' + pxH);
    svgEl.setAttribute('overflow', 'hidden');

    /* 背景色 <rect>（x=0 y=0 で全面を覆うもの）を除去
       → Illustratorで余白に見える原因のため、テキストのみのオーバーレイとして出力 */
    Array.from(svgEl.childNodes).forEach(function (node) {
      if (node.nodeType !== 1 || node.tagName.toLowerCase() !== 'rect') return;
      var x = parseFloat(node.getAttribute('x') || '0');
      var y = parseFloat(node.getAttribute('y') || '0');
      var w = parseFloat(node.getAttribute('width')  || '0');
      var h = parseFloat(node.getAttribute('height') || '0');
      if (x === 0 && y === 0 && Math.abs(w - pxW) < 1 && Math.abs(h - pxH) < 1) {
        svgEl.removeChild(node);
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }

  /* 絵文字を含む文字列かチェック */
  function containsEmoji(str) {
    return /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(str);
  }

  /* エクスポートメイン */
  function exportSVG(design, model) {
    /* 絵文字チェック: canvas_json 内のテキストを確認 */
    try {
      var jsonObj = JSON.parse(design.canvas_json);
      var hasEmoji = (jsonObj.objects || []).some(function (o) {
        return (o.type === 'i-text' || o.type === 'text') && containsEmoji(o.text || '');
      });
      if (hasEmoji) {
        if (!confirm('このデザインには絵文字が含まれています。\n絵文字は opentype.js でパス化できないため SVG に正しく出力されません。\n\nそのまま出力しますか？')) return;
      }
    } catch (e) { /* JSON解析失敗は無視して続行 */ }

    showToast('SVG を生成中…');

    /* 一時キャンバスを生成して canvas_json を復元 */
    var tmpEl = document.createElement('canvas');
    tmpEl.style.display = 'none';
    document.body.appendChild(tmpEl);

    var fc = new fabric.Canvas(tmpEl, {
      width              : CANVAS_W,
      height             : CANVAS_H,
      enableRetinaScaling: false,
    });

    fc.loadFromJSON(design.canvas_json, function () {

      /* texture / frame (Image) を除去 */
      fc.getObjects('image').forEach(function (img) { fc.remove(img); });

      /* キャンバス境界からはみ出しているテキストを完全に削除
         getBoundingRect(true, true) = 絶対座標・回転考慮済みのバウンディングボックス */
      var cW = fc.width, cH = fc.height;
      fc.getObjects().filter(function (o) {
        return o.type === 'i-text' || o.type === 'text';
      }).forEach(function (obj) {
        var b = obj.getBoundingRect(true, true);
        if (b.left < 0 || b.top < 0 ||
            b.left + b.width  > cW ||
            b.top  + b.height > cH) {
          fc.remove(obj);
        }
      });
      fc.renderAll();

      /* SVG 生成 → 正規化・クリップ → テキストパス化 → ダウンロード */
      var rawSvg = fc.toSVG();
      var mmSvg  = processSvg(rawSvg, model.widthMm, model.heightMm);

      textToPath(mmSvg).then(function (finalSvg) {
        var date     = new Date(design.created_at || Date.now())
          .toISOString().slice(0, 10).replace(/-/g, '');
        var safeName = (model.name || 'unknown').replace(/\s+/g, '_');
        var filename = design.id.slice(0, 8) + '_' + safeName + '_' + date + '.svg';

        var blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(filename + ' をダウンロードしました');
      }).catch(function (err) {
        showToast('SVG生成エラー: ' + err.message, 'error');
      }).then(function () {
        fc.dispose();
        document.body.removeChild(tmpEl);
      });
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期化
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function initAdmin() {
    initTabs();
    loadModels(true); /* 機種取得 → デザイン取得 */
  }

}());
