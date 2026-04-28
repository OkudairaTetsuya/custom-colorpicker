/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   管理画面 — admin.js
   Supabase + Fabric.js + opentype.js
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  'use strict';

  var CANVAS_W = 300;
  var CANVAS_H = 600;

  /* SVG出力時の上部オフセット
     フレーム画像はキャンバス全体（top=0）にフィットしているため不要（= 0） */
  var EXPORT_TOP_OFFSET_MM = 0;

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
        if (tab === 'models')        loadModels();
        if (tab === 'stamps')        loadStampTab();
        if (tab === 'color-presets') loadColorPresetTab();
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

    /* ID */
    var tdId = document.createElement('td');
    tdId.textContent = d.id || '—';
    tdId.className   = 'design-id mono small';

    /* 背景色 */
    var tdColor = document.createElement('td');
    var swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = d.base_color || '#ccc';
    var code = document.createElement('code');
    code.textContent = (d.base_color || '').toUpperCase();
    tdColor.appendChild(swatch);
    tdColor.appendChild(code);
    if (d.is_out_of_gamut) {
      var gamutBadge = document.createElement('span');
      gamutBadge.className   = 'gamut-badge';
      gamutBadge.title       = 'CMYK印刷色再現外（ΔE>4）';
      gamutBadge.textContent = '⚠ 色ズレ注意';
      tdColor.appendChild(gamutBadge);
    }

    /* 出力設定 */
    var tdExp = document.createElement('td');

    var expWrap = document.createElement('div');
    expWrap.className = 'export-cell';

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

    expWrap.appendChild(sel);
    expWrap.appendChild(btn);
    tdExp.appendChild(expWrap);

    /* 削除ボタン */
    var tdDel = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.className   = 'btn-sm btn-danger';
    delBtn.addEventListener('click', function () {
      if (!confirm('ID: ' + d.id + '\nこのデザインを削除しますか？')) return;
      /* Storage のプレビュー画像を削除 */
      if (d.preview_url) {
        var previewPath = d.preview_url.split('/previews/')[1];
        if (previewPath) sb.storage.from('previews').remove([decodeURIComponent(previewPath)]);
      }
      /* DB レコードを削除 */
      sb.from('designs').delete().eq('id', d.id).then(function (res) {
        if (res.error) { showToast('削除失敗: ' + res.error.message, 'error'); return; }
        showToast('削除しました: ' + d.id);
        tr.remove();
      });
    });
    tdDel.appendChild(delBtn);

    tr.append(tdPrev, tdDate, tdText, tdId, tdColor, tdExp, tdDel);
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

  /* ── ID検索 ── */
  var searchInput    = document.getElementById('search-id-input');
  var searchBtn      = document.getElementById('search-id-btn');
  var searchClearBtn = document.getElementById('search-clear-btn');

  function searchById(id) {
    id = id.trim();
    if (!id) { loadModels(true); return; }
    sb.from('designs')
      .select('*')
      .ilike('id', '%' + id + '%')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { showToast('検索失敗: ' + res.error.message, 'error'); return; }
        var rows = res.data || [];
        designsCount.textContent = rows.length + ' 件（検索結果）';
        designsTbody.innerHTML   = '';
        designsEmpty.style.display = rows.length ? 'none' : 'block';
        rows.forEach(function (d) { designsTbody.appendChild(buildDesignRow(d)); });
        searchClearBtn.style.display = '';
      });
  }

  searchBtn.addEventListener('click', function () {
    searchById(searchInput.value);
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') searchById(this.value);
  });

  searchClearBtn.addEventListener('click', function () {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
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
    'Sacramento':
      'https://cdn.jsdelivr.net/npm/@fontsource/sacramento@5/files/sacramento-latin-400-normal.woff',
    'Alex Brush':
      'https://cdn.jsdelivr.net/npm/@fontsource/alex-brush@5/files/alex-brush-latin-400-normal.woff',
    'Noto Serif JP':
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-jp@5/files/noto-serif-jp-japanese-400-normal.woff',
    'Noto Sans':
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5/files/noto-sans-jp-japanese-400-normal.woff',
  };

  /* シンボルフォント候補URL（順番に試す） */
  var SYMBOL_FONT_URLS = [
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-symbols@5/files/noto-sans-symbols-symbols-400-normal.woff',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-symbols@5/files/noto-sans-symbols-all-400-normal.woff',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-symbols-2@5/files/noto-sans-symbols-2-symbols-400-normal.woff',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-symbols-2@5/files/noto-sans-symbols-2-all-400-normal.woff',
    /* DejaVu Sans TTF: ♥♡ を含む信頼性の高いフォールバック */
    'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
  ];

  function loadSymbolFont() {
    if (fontCache['_symbol']) return Promise.resolve(fontCache['_symbol']);
    /* URLを順番に試して最初に成功したものを使う */
    return SYMBOL_FONT_URLS.reduce(function (chain, url) {
      return chain.catch(function () {
        return fetch(url)
          .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer(); })
          .then(function (buf) {
            var font = opentype.parse(buf);
            fontCache['_symbol'] = font;
            return font;
          });
      });
    }, Promise.reject(new Error('start')));
  }

  function loadOtFont(family) {
    if (fontCache[family]) return Promise.resolve(fontCache[family]);
    var url = FONT_WOFF[family] || FONT_WOFF['Roboto'];

    /* fetch + parse を試み、失敗したら opentype.load() XHR にフォールバック */
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (buf) {
        var font = opentype.parse(buf);
        fontCache[family] = font;
        return font;
      })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          opentype.load(url, function (err, font) {
            if (err) { reject(err); }
            else { fontCache[family] = font; resolve(font); }
          });
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
      var family    = (textEl.getAttribute('font-family') || 'Roboto').replace(/['"]/g, '').trim();
      var fontSize  = parseFloat(textEl.getAttribute('font-size') || '36');
      var styleStr  = textEl.getAttribute('style') || '';
      var fill      = styleVal(styleStr, 'fill') || '#000000';
      var opacity   = styleVal(styleStr, 'opacity') || '1';

      /* CJK 文字を含むか判定（日本語フォールバック選択に使用） */
      function hasCjk(str) { return /[\u3000-\u9FFF\uF900-\uFAFF]/.test(str); }

      /* 2D アフィン行列をパスコマンドに手動適用（opentype.js 版依存を避けるため） */
      function applyMatrix(p) {
        p.commands.forEach(function (cmd) {
          if (cmd.x !== undefined) {
            var nx = m.a * cmd.x + m.c * cmd.y + m.e;
            var ny = m.b * cmd.x + m.d * cmd.y + m.f;
            cmd.x = nx; cmd.y = ny;
          }
          if (cmd.x1 !== undefined) {
            var nx1 = m.a * cmd.x1 + m.c * cmd.y1 + m.e;
            var ny1 = m.b * cmd.x1 + m.d * cmd.y1 + m.f;
            cmd.x1 = nx1; cmd.y1 = ny1;
          }
          if (cmd.x2 !== undefined) {
            var nx2 = m.a * cmd.x2 + m.c * cmd.y2 + m.e;
            var ny2 = m.b * cmd.x2 + m.d * cmd.y2 + m.f;
            cmd.x2 = nx2; cmd.y2 = ny2;
          }
        });
      }

      /* 1文字ずつフォントを選んでパスを生成（シンボルフォントへのフォールバック対応）
         - プライマリフォントにグリフがない文字は symbolFont を使用
         - サロゲートペア（絵文字など）も Array.from で正しく分割 */
      function tryFont(font, symbolFont) {
        var dAttr  = '';
        var errMsg = '';
        var tspans = Array.from(textEl.querySelectorAll('tspan'));
        if (!tspans.length) tspans = [textEl];
        tspans.forEach(function (ts) {
          var text = ts.textContent;
          if (!text) return;
          var tx = parseFloat(ts.getAttribute('x') || textEl.getAttribute('x') || '0');
          var ty = parseFloat(ts.getAttribute('y') || textEl.getAttribute('y') || '0');
          var tsFontSize = parseFloat(ts.getAttribute('font-size') || '') || fontSize;
          var x = tx;
          Array.from(text).forEach(function (ch) {
            try {
              /* グリフが存在するフォントを選択 */
              var useFont = font;
              if (font.charToGlyph(ch).index === 0 && symbolFont) {
                if (symbolFont.charToGlyph(ch).index !== 0) useFont = symbolFont;
              }
              var p = useFont.getPath(ch, x, ty, tsFontSize);
              applyMatrix(p);
              dAttr += p.toPathData(3);
              x += useFont.getAdvanceWidth(ch, tsFontSize);
            } catch (e) {
              errMsg = (e && e.message) ? e.message : String(e);
            }
          });
        });
        if (errMsg) showToast('文字変換エラー: ' + effectiveFamily + ' — ' + errMsg, 'error');
        return dAttr;
      }

      /* テキスト内容を確認してCJK含むかチェック */
      var allText = Array.from(textEl.querySelectorAll('tspan'))
        .map(function (ts) { return ts.textContent; }).join('');

      /* CJK文字を含む場合は最初から日本語フォントを使う
         （Roboto で変換すると .notdef 箱になりフォールバックが発動しないため） */
      var CJK_FONTS = { 'Noto Serif JP': true, 'Noto Sans': true };
      var effectiveFamily = (hasCjk(allText) && !CJK_FONTS[family])
        ? 'Noto Serif JP'
        : family;

      return Promise.all([
        loadOtFont(effectiveFamily),
        loadSymbolFont().catch(function () { return null; }), /* 失敗しても続行 */
      ]).then(function (results) {
        return tryFont(results[0], results[1]);
      }).then(function (dAttr) {
        if (!dAttr) {
          /* パスデータが空 = フォントは読めたが字形が生成されなかった */
          showToast('パスなし: ' + effectiveFamily + ' "' + allText.slice(0, 10) + '"', 'error');
          return;
        }
        if (!parentG || !parentG.parentElement) return;
        var pathEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d',       dAttr);
        pathEl.setAttribute('fill',    fill || textEl.getAttribute('fill') || '#000000');
        pathEl.setAttribute('opacity', opacity);
        parentG.parentElement.replaceChild(pathEl, parentG);

      }).catch(function (err) {
        showToast('アウトライン化失敗: ' + effectiveFamily + ' — ' + (err ? (err.message || err) : '不明'), 'error');
      });
    });

    return Promise.all(jobs).then(function () {
      return new XMLSerializer().serializeToString(doc);
    });
  }

  /* SVG後処理:
     - width/height を mm 単位に書き換え
     - viewBox はキャンバス実寸のまま（スケール変更なし）
     - 上部余白分だけ translate で全コンテンツを上にずらす
     - clipPath でキャンバス外へのはみ出しをマスク
  */
  function processSvg(svgStr, wMm, hMm, topOffsetMm) {
    var parser = new DOMParser();
    var doc    = parser.parseFromString(svgStr, 'image/svg+xml');
    var svgEl  = doc.querySelector('svg');
    if (!svgEl) return svgStr;

    /* Fabric が出力した実際のキャンバスサイズを viewBox から取得 */
    var vb  = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    var pxW = (vb.length >= 4 && vb[2] > 0) ? vb[2] : CANVAS_W;
    var pxH = (vb.length >= 4 && vb[3] > 0) ? vb[3] : CANVAS_H;

    /* 上部オフセット: フレーム画像の非印刷エリア分（mm → px）
       コンテンツを offsetPx 分上にずらすことで canvas y=offsetPx が物理 0mm に一致
       viewBox 高さは変えないのでスケール（X/Y 等倍）が保たれる */
    var offsetPx = topOffsetMm ? Math.round((topOffsetMm / hMm) * pxH) : 0;

    svgEl.setAttribute('width',               wMm + 'mm');
    svgEl.setAttribute('height',              hMm + 'mm');
    svgEl.setAttribute('viewBox',             '0 0 ' + pxW + ' ' + pxH);
    svgEl.setAttribute('preserveAspectRatio', 'none');
    svgEl.removeAttribute('overflow');

    /* defs・desc・背景 rect 以外の直接子を translate グループでまとめてオフセット適用
       背景 rect は translate しないでそのまま残し、明示的なピクセル値に修正する
       （100% のままだと translate 後に下端に空白が生じるため） */
    if (offsetPx > 0) {
      var toMove = [];
      Array.from(svgEl.childNodes).forEach(function (node) {
        if (node.nodeType !== 1) return;
        var tag = node.tagName.toLowerCase();
        if (tag === 'defs' || tag === 'desc') return;
        /* 背景 rect: translate しない。100% → 実ピクセルに書き換えてそのまま残す */
        if (tag === 'rect' &&
            (node.getAttribute('width') === '100%' ||
             parseFloat(node.getAttribute('width')) >= pxW * 0.9)) {
          node.setAttribute('x', '0');
          node.setAttribute('y', '0');
          node.setAttribute('width',  String(pxW));
          node.setAttribute('height', String(pxH));
          return; /* toMove に追加しない */
        }
        toMove.push(node);
      });
      if (toMove.length) {
        var g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'translate(0,' + (-offsetPx) + ')');
        toMove.forEach(function (child) {
          svgEl.removeChild(child);
          g.appendChild(child);
        });
        svgEl.appendChild(g);
      }
    }

    return new XMLSerializer().serializeToString(doc);
  }

  /* テキストパス化後のSVGにclipPathを追加（はみ出しをIllustratorでも確実にマスク）
     - Illustrator は <g transform="..."> に直接 clip-path を付けると
       クリップ座標をローカル座標系で解釈してズレる
     - 対策: transform のないラッパー <g clip-path="..."> で全コンテンツをまとめる */
  function applyClipPath(svgStr) {
    /* v20260413c — wrapper-g 方式 */
    var parser = new DOMParser();
    var doc    = parser.parseFromString(svgStr, 'image/svg+xml');
    var svgEl  = doc.querySelector('svg');
    if (!svgEl) return svgStr;

    /* processSvg が正規化した viewBox から寸法を読み取る
       viewBox = "0 0 pxW pxH" 形式（translate でオフセット済みのため y=0 固定） */
    var vb     = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    var pxW    = (vb.length >= 4 && vb[2] > 0) ? vb[2] : CANVAS_W;
    var pxH    = (vb.length >= 4 && vb[3] > 0) ? vb[3] : CANVAS_H;

    /* defs を確保 */
    var defs = doc.querySelector('defs');
    if (!defs) {
      defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svgEl.insertBefore(defs, svgEl.firstChild);
    }

    /* 既存の canvas-clip を除去してから再定義 */
    var old = defs.querySelector('#canvas-clip');
    if (old) defs.removeChild(old);

    var cp = doc.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    cp.setAttribute('id', 'canvas-clip');
    var cr = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    cr.setAttribute('x', '0'); cr.setAttribute('y', '0');
    cr.setAttribute('width',  String(pxW));
    cr.setAttribute('height', String(pxH));
    cp.appendChild(cr);
    defs.appendChild(cp);

    /* defs・desc 以外の直接子を収集しながら個別 clip-path を除去 */
    var children = [];
    Array.from(svgEl.childNodes).forEach(function (node) {
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'defs' || tag === 'desc') return;
      /* 個別に付いている古い clip-path を外す */
      node.removeAttribute('clip-path');
      /* 背景 rect の 100% をピクセル値に確定させる（Illustrator 対策） */
      if (tag === 'rect') {
        if (node.getAttribute('width')  === '100%') node.setAttribute('width',  String(pxW));
        if (node.getAttribute('height') === '100%') node.setAttribute('height', String(pxH));
      }
      children.push(node);
    });

    /* transform なしのラッパー <g> に clip-path を一括適用
       → クリップ座標が SVG ルート座標系と一致し Illustrator でもズレない */
    var wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.setAttribute('clip-path', 'url(#canvas-clip)');
    children.forEach(function (node) {
      svgEl.removeChild(node);
      wrapper.appendChild(node);
    });
    svgEl.appendChild(wrapper);

    return new XMLSerializer().serializeToString(doc);
  }

  /* 絵文字を含む文字列かチェック */
  /* ♥(U+2665) と ♡(U+2661) は除外して絵文字チェック */
  function containsEmoji(str) {
    return /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(str.replace(/[♥♡]/g, ''));
  }

  /* エクスポートメイン */
  function exportSVG(design, model) {
    /* 絵文字チェック & キャンバスサイズ取得 */
    var savedCanvasW = CANVAS_W;
    var savedCanvasH = CANVAS_H;
    try {
      var jsonObj = JSON.parse(design.canvas_json);
      var hasEmoji = (jsonObj.objects || []).some(function (o) {
        return (o.type === 'i-text' || o.type === 'text') && containsEmoji(o.text || '');
      });
      if (hasEmoji) {
        if (!confirm('このデザインには絵文字が含まれています。\n絵文字は opentype.js でパス化できないため SVG に正しく出力されません。\n\nそのまま出力しますか？')) return;
      }
      /* キャンバス幅を mm アスペクト比から計算
         → X/Y スケールを一致させることで伸縮なし（preserveAspectRatio="none" でも等倍）*/
      if (model.widthMm && model.heightMm) {
        savedCanvasH = CANVAS_H;
        savedCanvasW = Math.round(CANVAS_H * model.widthMm / model.heightMm);
      }
    } catch (e) { /* JSON解析失敗は無視して続行 */ }

    showToast('SVG を生成中…');

    /* 一時キャンバスを生成して canvas_json を復元 */
    var tmpEl = document.createElement('canvas');
    tmpEl.style.display = 'none';
    document.body.appendChild(tmpEl);

    var fc = new fabric.Canvas(tmpEl, {
      width              : savedCanvasW,
      height             : savedCanvasH,
      enableRetinaScaling: false,
    });

    fc.loadFromJSON(design.canvas_json, function () {

      /* texture / frame (Image) を除去 */
      fc.getObjects('image').forEach(function (img) { fc.remove(img); });
      fc.renderAll();

      /* SVG 生成 → mm正規化 → テキストパス化 → clipPath適用 → ダウンロード
         ※ clipPath は textToPath の後に適用する（パス化と干渉しないよう分離） */
      var rawSvg = fc.toSVG();
      var mmSvg  = processSvg(rawSvg, model.widthMm, model.heightMm, EXPORT_TOP_OFFSET_MM);

      textToPath(mmSvg).then(function (pathSvg) {
        /* アウトライン化できなかった <text> が残っていれば通知 */
        var remaining = (pathSvg.match(/<text[\s>]/g) || []).length;
        if (remaining > 0) {
          showToast(remaining + '件のテキストをアウトライン化できませんでした', 'error');
        }
        /* テキストパス化済みSVGにclipPathを追加してはみ出しを除去 */
        var finalSvg = applyClipPath(pathSvg);
        var date     = new Date(design.created_at || Date.now())
          .toISOString().slice(0, 10).replace(/-/g, '');
        var safeName  = (model.name || 'unknown').replace(/\s+/g, '_');
        var filename  = design.id.slice(0, 8) + '_' + safeName + '_' + date + '.svg';

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

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     スタンプ管理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var cachedCats   = [];
  var cachedStamps = [];

  /* ─── カテゴリ ─── */
  var catsTbody = document.getElementById('cats-tbody');
  var catsEmpty = document.getElementById('cats-empty');

  function loadStampTab() {
    loadCats(true);
  }

  function loadCats(thenStamps) {
    sb.from('stamp_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showToast('カテゴリ取得失敗: ' + res.error.message, 'error'); return; }
        cachedCats = res.data || [];
        catsTbody.innerHTML = '';
        catsEmpty.style.display = cachedCats.length ? 'none' : 'block';
        cachedCats.forEach(function (c) { catsTbody.appendChild(buildCatRow(c)); });
        rebuildCatSelects();
        if (thenStamps) loadStamps();
      });
  }

  function buildCatRow(c) {
    var tr = document.createElement('tr');

    /* タグ色 */
    var tdColor = document.createElement('td');
    var chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.style.background = c.tag_color || '#6366f1';
    chip.title = c.tag_color || '#6366f1';
    tdColor.appendChild(chip);

    /* 名前 */
    var tdName = document.createElement('td');
    tdName.textContent = c.name;

    /* 並び順 */
    var tdSort = document.createElement('td');
    tdSort.textContent = c.sort_order;

    /* 操作 */
    var tdAct = document.createElement('td');
    var editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.className = 'btn-sm';
    editBtn.addEventListener('click', function () { openEditCatModal(c); });

    var delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.className = 'btn-sm btn-danger';
    delBtn.addEventListener('click', function () {
      if (!confirm(c.name + ' を削除しますか？')) return;
      sb.from('stamp_categories').delete().eq('id', c.id)
        .then(function (res) {
          if (res.error) { showToast('削除失敗: ' + res.error.message, 'error'); return; }
          showToast(c.name + ' を削除しました');
          loadCats(true);
        });
    });

    var wrap = document.createElement('div');
    wrap.className = 'export-cell';
    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    tdAct.appendChild(wrap);

    tr.append(tdColor, tdName, tdSort, tdAct);
    return tr;
  }

  /* カテゴリ追加フォーム */
  var addCatForm    = document.getElementById('add-cat-form');
  var catNameEl     = document.getElementById('cat-name');
  var catTagColorEl = document.getElementById('cat-tag-color');
  var catTagHexEl   = document.getElementById('cat-tag-color-hex');
  var catSortEl     = document.getElementById('cat-sort');

  /* color input ↔ hex text 同期 */
  catTagColorEl.addEventListener('input', function () { catTagHexEl.value = this.value; });
  catTagHexEl.addEventListener('input', function () {
    if (/^#[0-9a-fA-F]{6}$/.test(this.value)) catTagColorEl.value = this.value;
  });

  document.getElementById('add-cat-btn').addEventListener('click', function () {
    addCatForm.style.display = 'block';
    catNameEl.focus();
  });
  document.getElementById('cancel-cat-btn').addEventListener('click', function () {
    addCatForm.style.display = 'none';
    clearCatForm();
  });

  function clearCatForm() {
    catNameEl.value     = '';
    catTagColorEl.value = '#6366f1';
    catTagHexEl.value   = '#6366f1';
    catSortEl.value     = '0';
  }

  document.getElementById('submit-cat-btn').addEventListener('click', function () {
    var name  = catNameEl.value.trim();
    var color = catTagHexEl.value.trim() || '#6366f1';
    var sort  = parseInt(catSortEl.value, 10) || 0;
    if (!name) { showToast('カテゴリ名を入力してください', 'error'); return; }
    sb.from('stamp_categories').insert({ name: name, tag_color: color, sort_order: sort })
      .then(function (res) {
        if (res.error) { showToast('追加失敗: ' + res.error.message, 'error'); return; }
        showToast(name + ' を追加しました');
        addCatForm.style.display = 'none';
        clearCatForm();
        loadCats(true);
      });
  });

  /* カテゴリ編集モーダル（インライン簡易） */
  function openEditCatModal(c) {
    var name  = prompt('カテゴリ名', c.name);
    if (name === null) return;
    var color = prompt('タグカラー (HEX)', c.tag_color || '#6366f1');
    if (color === null) return;
    var sort  = parseInt(prompt('並び順', c.sort_order), 10);
    if (isNaN(sort)) sort = c.sort_order;
    sb.from('stamp_categories').update({ name: name.trim(), tag_color: color.trim(), sort_order: sort }).eq('id', c.id)
      .then(function (res) {
        if (res.error) { showToast('更新失敗: ' + res.error.message, 'error'); return; }
        showToast('更新しました');
        loadCats(true);
      });
  }

  /* カテゴリセレクト再構築（スタンプ追加フォーム用） */
  var stampCatSelEl = document.getElementById('stamp-category-sel');
  function rebuildCatSelects() {
    stampCatSelEl.innerHTML = '<option value="">— カテゴリなし —</option>';
    cachedCats.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      stampCatSelEl.appendChild(o);
    });
  }

  /* ─── スタンプ ─── */
  var stampsTbody = document.getElementById('stamps-tbody');
  var stampsEmpty = document.getElementById('stamps-empty');

  function loadStamps() {
    sb.from('stamps')
      .select('*, stamp_categories(name, tag_color)')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { showToast('スタンプ取得失敗: ' + res.error.message, 'error'); return; }
        cachedStamps = res.data || [];
        stampsTbody.innerHTML = '';
        stampsEmpty.style.display = cachedStamps.length ? 'none' : 'block';
        cachedStamps.forEach(function (s) { stampsTbody.appendChild(buildStampRow(s)); });
      });
  }

  function buildStampRow(s) {
    var tr = document.createElement('tr');

    /* プレビュー */
    var tdPrev = document.createElement('td');
    var img = document.createElement('img');
    img.src = s.svg_url;
    img.className = 'stamp-thumb';
    img.alt = s.name;
    tdPrev.appendChild(img);

    /* 名前 */
    var tdName = document.createElement('td');
    tdName.textContent = s.name;

    /* カテゴリ */
    var tdCat = document.createElement('td');
    var cat = s.stamp_categories;
    if (cat) {
      var chip = document.createElement('span');
      chip.className = 'tag-chip tag-chip-sm';
      chip.style.background = cat.tag_color || '#6366f1';
      var catLabel = document.createElement('span');
      catLabel.textContent = cat.name;
      catLabel.style.marginLeft = '6px';
      tdCat.appendChild(chip);
      tdCat.appendChild(catLabel);
    } else {
      tdCat.textContent = '—';
    }

    /* 並び順 */
    var tdSort = document.createElement('td');
    tdSort.textContent = s.sort_order;

    /* 色変更 */
    var tdColor = document.createElement('td');
    tdColor.textContent = s.allow_color_change ? '✓' : '—';
    tdColor.style.textAlign = 'center';
    tdColor.style.color = s.allow_color_change ? '#34c759' : '#8e8e93';

    /* 操作 */
    var tdAct = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.className = 'btn-sm btn-danger';
    delBtn.addEventListener('click', function () {
      if (!confirm(s.name + ' を削除しますか？')) return;
      /* Storageからも削除 */
      var path = s.svg_url.split('/stamps/')[1];
      if (path) sb.storage.from('stamps').remove([decodeURIComponent(path)]);
      sb.from('stamps').delete().eq('id', s.id)
        .then(function (res) {
          if (res.error) { showToast('削除失敗: ' + res.error.message, 'error'); return; }
          showToast(s.name + ' を削除しました');
          loadStamps();
        });
    });

    var wrap = document.createElement('div');
    wrap.className = 'export-cell';
    wrap.appendChild(delBtn);
    tdAct.appendChild(wrap);

    tr.append(tdPrev, tdName, tdCat, tdSort, tdColor, tdAct);
    return tr;
  }

  /* スタンプ追加フォーム */
  var addStampForm      = document.getElementById('add-stamp-form');
  var stampNameEl       = document.getElementById('stamp-name');
  var stampSortEl       = document.getElementById('stamp-sort');
  var stampSvgFileEl    = document.getElementById('stamp-svg-file');
  var stampSvgPreview   = document.getElementById('stamp-svg-preview');
  var stampAllowColorEl = document.getElementById('stamp-allow-color');
  var pendingSvgText    = null;

  document.getElementById('add-stamp-btn').addEventListener('click', function () {
    rebuildCatSelects();
    addStampForm.style.display = 'block';
    stampNameEl.focus();
  });
  document.getElementById('cancel-stamp-btn').addEventListener('click', function () {
    addStampForm.style.display = 'none';
    clearStampForm();
  });

  stampSvgFileEl.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      pendingSvgText = e.target.result;
      stampSvgPreview.innerHTML = pendingSvgText;
      /* プレビュー内SVGのサイズ固定 */
      var svgEl = stampSvgPreview.querySelector('svg');
      if (svgEl) { svgEl.style.width = '64px'; svgEl.style.height = '64px'; }
    };
    reader.readAsText(file);
  });

  function clearStampForm() {
    stampNameEl.value       = '';
    stampSortEl.value       = '0';
    stampSvgFileEl.value    = '';
    stampAllowColorEl.checked = false;
    stampSvgPreview.innerHTML = 'SVGをここに表示';
    pendingSvgText = null;
  }

  document.getElementById('submit-stamp-btn').addEventListener('click', function () {
    var name           = stampNameEl.value.trim();
    var catId          = stampCatSelEl.value || null;
    var sort           = parseInt(stampSortEl.value, 10) || 0;
    var allowColor     = stampAllowColorEl.checked;
    var file           = stampSvgFileEl.files[0];

    if (!name)   { showToast('スタンプ名を入力してください', 'error'); return; }
    if (!file)   { showToast('SVGファイルを選択してください', 'error'); return; }
    if (!pendingSvgText) { showToast('SVGの読み込みに失敗しました', 'error'); return; }

    var filename = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var blob = new Blob([pendingSvgText], { type: 'image/svg+xml' });

    sb.storage.from('stamps').upload(filename, blob, { contentType: 'image/svg+xml', upsert: false })
      .then(function (res) {
        if (res.error) { showToast('アップロード失敗: ' + res.error.message, 'error'); return; }
        var urlRes = sb.storage.from('stamps').getPublicUrl(filename);
        var svgUrl = urlRes.data.publicUrl;
        return sb.from('stamps').insert({ name: name, category_id: catId, svg_url: svgUrl, sort_order: sort, allow_color_change: allowColor });
      })
      .then(function (res) {
        if (!res) return; /* アップロード失敗時はskip */
        if (res.error) { showToast('DB保存失敗: ' + res.error.message, 'error'); return; }
        showToast(name + ' を追加しました');
        addStampForm.style.display = 'none';
        clearStampForm();
        loadStamps();
      });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     カラープリセット管理
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var cachedPresetCats   = [];
  var cachedColorPresets = [];
  var presetCatsTbody    = document.getElementById('preset-cats-tbody');
  var presetCatsEmpty    = document.getElementById('preset-cats-empty');
  var presetsTbody       = document.getElementById('presets-tbody');
  var presetsEmpty       = document.getElementById('presets-empty');

  function loadColorPresetTab() { loadPresetCats(true); }

  function loadPresetCats(thenPresets) {
    sb.from('color_preset_categories').select('*').order('sort_order')
      .then(function (res) {
        if (res.error) { showToast('カテゴリ取得失敗: ' + res.error.message, 'error'); return; }
        cachedPresetCats = res.data || [];
        presetCatsTbody.innerHTML = '';
        presetCatsEmpty.style.display = cachedPresetCats.length ? 'none' : 'block';
        cachedPresetCats.forEach(function (c) { presetCatsTbody.appendChild(buildPresetCatRow(c)); });
        if (thenPresets) loadColorPresets();
      });
  }

  function loadColorPresets() {
    sb.from('color_presets').select('*').order('sort_order')
      .then(function (res) {
        if (res.error) { showToast('プリセット取得失敗: ' + res.error.message, 'error'); return; }
        cachedColorPresets = res.data || [];
        presetsTbody.innerHTML = '';
        presetsEmpty.style.display = cachedColorPresets.length ? 'none' : 'block';
        cachedColorPresets.forEach(function (p) { presetsTbody.appendChild(buildPresetRow(p)); });
      });
  }

  function buildPresetCatRow(c) {
    var tr = document.createElement('tr');
    var chip = document.createElement('span');
    chip.className = 'tag-chip'; chip.style.background = c.tag_color || '#6366f1';
    var tdColor = document.createElement('td'); tdColor.appendChild(chip);
    var tdName  = eCell(c.name,       'name');
    var tdSort  = eCell(c.sort_order, 'sort_order', 'number');
    var tdAct   = document.createElement('td');
    var saveBtn = btn('保存', 'btn-sm');
    saveBtn.addEventListener('click', function () {
      var updates = {};
      [tdName, tdSort].forEach(function (td) {
        var input = td.querySelector('input');
        if (input) updates[td.dataset.field] = input.type === 'number' ? parseInt(input.value,10)||0 : input.value.trim();
      });
      sb.from('color_preset_categories').update(updates).eq('id', c.id)
        .then(function (res) {
          if (res.error) { showToast('更新失敗: ' + res.error.message, 'error'); return; }
          showToast('更新しました'); loadPresetCats(true);
        });
    });
    var delBtn2 = btn('削除', 'btn-sm btn-danger');
    delBtn2.addEventListener('click', function () {
      if (!confirm(c.name + ' を削除しますか？')) return;
      sb.from('color_preset_categories').delete().eq('id', c.id)
        .then(function (res) {
          if (res.error) { showToast('削除失敗: ' + res.error.message, 'error'); return; }
          showToast(c.name + ' を削除しました'); loadPresetCats(true);
        });
    });
    tdAct.appendChild(saveBtn); tdAct.appendChild(delBtn2);
    tr.append(tdColor, tdName, tdSort, tdAct);
    return tr;
  }

  function buildPresetRow(p) {
    var tr = document.createElement('tr');
    var swatch = document.createElement('span');
    swatch.className = 'swatch'; swatch.style.background = p.hex;
    var tdSwatch = document.createElement('td'); tdSwatch.appendChild(swatch);
    var tdName   = eCell(p.name,       'name');
    var tdHex    = eCell(p.hex,        'hex');
    var tdSort   = eCell(p.sort_order, 'sort_order', 'number');

    var tdCat  = document.createElement('td');
    var catSel = document.createElement('select');
    catSel.className = 'ei';
    cachedPresetCats.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      if (c.id === p.category_id) o.selected = true;
      catSel.appendChild(o);
    });
    tdCat.appendChild(catSel);

    var tdAct   = document.createElement('td');
    var saveBtn = btn('保存', 'btn-sm');
    saveBtn.addEventListener('click', function () {
      var updates = { category_id: catSel.value || null };
      [tdName, tdHex, tdSort].forEach(function (td) {
        var input = td.querySelector('input');
        if (input) updates[td.dataset.field] = input.type === 'number' ? parseInt(input.value,10)||0 : input.value.trim();
      });
      sb.from('color_presets').update(updates).eq('id', p.id)
        .then(function (res) {
          if (res.error) { showToast('更新失敗: ' + res.error.message, 'error'); return; }
          swatch.style.background = updates.hex || p.hex;
          showToast('更新しました');
        });
    });
    var delBtn2 = btn('削除', 'btn-sm btn-danger');
    delBtn2.addEventListener('click', function () {
      if (!confirm((p.name || p.hex) + ' を削除しますか？')) return;
      sb.from('color_presets').delete().eq('id', p.id)
        .then(function (res) {
          if (res.error) { showToast('削除失敗: ' + res.error.message, 'error'); return; }
          showToast('削除しました'); loadColorPresets();
        });
    });
    tdAct.appendChild(saveBtn); tdAct.appendChild(delBtn2);
    tr.append(tdSwatch, tdName, tdHex, tdCat, tdSort, tdAct);
    return tr;
  }

  document.getElementById('add-preset-cat-btn').addEventListener('click', function () {
    var name  = prompt('カテゴリ名');
    if (!name) return;
    var color = prompt('タグ色（HEX）', '#6366f1') || '#6366f1';
    sb.from('color_preset_categories')
      .insert({ name: name.trim(), tag_color: color, sort_order: cachedPresetCats.length * 10 })
      .then(function (res) {
        if (res.error) { showToast('追加失敗: ' + res.error.message, 'error'); return; }
        showToast(name + ' を追加しました'); loadPresetCats(true);
      });
  });
  document.getElementById('refresh-preset-cats-btn').addEventListener('click', function () { loadPresetCats(true); });

  document.getElementById('add-preset-btn').addEventListener('click', function () {
    if (!cachedPresetCats.length) { showToast('先にカテゴリを作成してください', 'error'); return; }
    var hex = prompt('HEXカラー（例: #FF5733）');
    if (!hex) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex.trim())) { showToast('正しいHEX形式で入力（例: #FF5733）', 'error'); return; }
    hex = hex.trim().toUpperCase();
    var name  = prompt('色の名前（任意）', '') || '';
    var catId = cachedPresetCats[0].id;
    if (cachedPresetCats.length > 1) {
      var choices = cachedPresetCats.map(function (c, i) { return (i + 1) + ': ' + c.name; }).join('\n');
      var idx = parseInt(prompt('カテゴリ番号\n' + choices), 10);
      if (idx >= 1 && idx <= cachedPresetCats.length) catId = cachedPresetCats[idx - 1].id;
    }
    sb.from('color_presets')
      .insert({ hex: hex, name: name, category_id: catId, sort_order: cachedColorPresets.length * 10 })
      .then(function (res) {
        if (res.error) { showToast('追加失敗: ' + res.error.message, 'error'); return; }
        showToast(hex + ' を追加しました'); loadColorPresets();
      });
  });
  document.getElementById('refresh-presets-btn').addEventListener('click', function () { loadColorPresets(); });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
     初期化
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function initAdmin() {
    initTabs();
    loadModels(true); /* 機種取得 → デザイン取得 */
  }

}());
