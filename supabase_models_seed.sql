-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- case_models 修正・投入スクリプト
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1) brand カラムを追加（既に存在する場合はスキップ）
ALTER TABLE case_models
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';

-- 2) designs の model_id 参照を先に外してから case_models を全削除
UPDATE designs SET model_id = NULL WHERE model_id IS NOT NULL;
DELETE FROM case_models;

-- 3) 正しいデータを挿入（slug は images/{slug}_BLK.png のファイル名と一致させること）
INSERT INTO case_models (brand, name, slug, width_mm, height_mm) VALUES
  -- ── iPhone ──────────────────────────────────────────────────
  ('iPhone', 'iPhone SE',       'ip-Se',    67.3, 138.4),
  ('iPhone', 'iPhone 14',       'ip-14',    71.5, 146.7),
  ('iPhone', 'iPhone 14 Pro',   'ip-14Pro', 71.5, 147.5),
  ('iPhone', 'iPhone 15',       'ip-15',    71.5, 147.6),
  ('iPhone', 'iPhone 15 Pro',   'ip-15Pro', 71.5, 146.6),
  ('iPhone', 'iPhone 16',       'ip-16',    71.5, 147.6),
  ('iPhone', 'iPhone 16 Pro',   'ip-16Pro', 71.5, 149.6),
  ('iPhone', 'iPhone 16e',      'ip-16e',   67.3, 138.8),
  ('iPhone', 'iPhone 17',       'ip-17',    71.5, 150.9),
  ('iPhone', 'iPhone 17 Pro',   'ip-17Pro', 71.5, 149.6),
  ('iPhone', 'iPhone 17e',      'ip-17e',   67.3, 138.8),
  -- ── Google Pixel ─────────────────────────────────────────────
  ('Google Pixel', 'Pixel 7a',   'px-7a',  72.9, 152.4),
  ('Google Pixel', 'Pixel 8a',   'px-8a',  72.7, 152.1),
  ('Google Pixel', 'Pixel 9',    'px-9',   68.5, 152.4),
  ('Google Pixel', 'Pixel 9a',   'px-9a',  71.1, 154.0),
  ('Google Pixel', 'Pixel 10',   'px-10',  70.1, 152.8),
  ('Google Pixel', 'Pixel 10a',  'px-10a', 71.0, 153.0),
  -- ── Galaxy ───────────────────────────────────────────────────
  ('Galaxy', 'Galaxy S22',       'g-S22',  70.6, 146.0),
  ('Galaxy', 'Galaxy S23',       'g-S23',  70.9, 146.3),
  ('Galaxy', 'Galaxy S24',       'g-S24',  70.6, 147.0),
  ('Galaxy', 'Galaxy A25',       'g-A25',  76.5, 161.0),
  -- ── AQUOS ────────────────────────────────────────────────────
  ('AQUOS', 'AQUOS sense8',      'aq-Sense8', 73.0, 153.0),
  ('AQUOS', 'AQUOS sense9',      'aq-Sense9', 73.0, 154.0),
  ('AQUOS', 'AQUOS wish3',       'aq-Wish3',  70.0, 146.0),
  ('AQUOS', 'AQUOS wish4',       'aq-Wish4',  70.0, 148.0),
  ('AQUOS', 'AQUOS wish5',       'aq-Wish5',  70.0, 148.0),
  -- ── Arrows ───────────────────────────────────────────────────
  ('Arrows', 'arrows We2',       'f-We2',     74.0, 160.0),
  ('Arrows', 'arrows We2 Plus',  'f-We2Plus', 74.0, 162.0),
  -- ── Kyocera ──────────────────────────────────────────────────
  ('Kyocera', 'Kyocera Android One', 'k-Active', 70.0, 146.0);
