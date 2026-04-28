-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Supabase セットアップ SQL
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


-- ── 1. designs テーブル ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS designs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  canvas_json TEXT        NOT NULL,
  base_color  TEXT        NOT NULL DEFAULT '#3399FF',
  preview_url TEXT,
  base_skin   TEXT        NOT NULL DEFAULT 'BLK',
  text_value  TEXT        NOT NULL DEFAULT '',
  font_family TEXT        NOT NULL DEFAULT 'Roboto',
  font_size   INTEGER     NOT NULL DEFAULT 36,
  text_color  TEXT        NOT NULL DEFAULT '#FFFFFF',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. RLS: 匿名 INSERT / SELECT を許可 ─────────────────────
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_designs"
  ON designs FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_designs"
  ON designs FOR SELECT TO anon
  USING (true);


-- ── 3. Storage: previews バケット ───────────────────────────
--    ダッシュボード Storage > New bucket > name: "previews" > Public ON
--    でも作成可。SQL で作る場合は以下を実行:
INSERT INTO storage.buckets (id, name, public)
VALUES ('previews', 'previews', true)
ON CONFLICT (id) DO NOTHING;

-- Storage ポリシー: 匿名アップロード・読み取り許可
CREATE POLICY "anon_upload_previews"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'previews');

CREATE POLICY "anon_read_previews"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'previews');


-- ── 4. case_models テーブル ─────────────────────────────────
CREATE TABLE IF NOT EXISTS case_models (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT         NOT NULL,
  slug        TEXT         NOT NULL UNIQUE,
  width_mm    NUMERIC(7,2) NOT NULL,
  height_mm   NUMERIC(7,2) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE case_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_case_models"
  ON case_models FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_case_models"
  ON case_models FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_case_models"
  ON case_models FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_delete_case_models"
  ON case_models FOR DELETE TO anon USING (true);

-- サンプルデータ
INSERT INTO case_models (name, slug, width_mm, height_mm, sort_order) VALUES
  ('iPhone 15',       'iphone-15',       71.5,  155.7, 10),
  ('iPhone 15 Pro',   'iphone-15-pro',   71.5,  159.9, 20),
  ('iPhone 15 Plus',  'iphone-15-plus',  77.8,  171.9, 30),
  ('iPhone 14',       'iphone-14',       71.5,  147.5, 40),
  ('Galaxy S24',      'galaxy-s24',      70.6,  147.0, 50)
ON CONFLICT (slug) DO NOTHING;


-- ── 5. color_preset_categories テーブル ────────────────────
CREATE TABLE IF NOT EXISTS color_preset_categories (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT         NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  tag_color  TEXT         NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE color_preset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_color_preset_categories" ON color_preset_categories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_color_preset_categories" ON color_preset_categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_color_preset_categories" ON color_preset_categories FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_color_preset_categories" ON color_preset_categories FOR DELETE TO anon USING (true);


-- ── 6. color_presets テーブル ────────────────────────────────
CREATE TABLE IF NOT EXISTS color_presets (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID         REFERENCES color_preset_categories(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL DEFAULT '',
  hex         TEXT         NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE color_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_color_presets" ON color_presets FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_color_presets" ON color_presets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_color_presets" ON color_presets FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_color_presets" ON color_presets FOR DELETE TO anon USING (true);


-- ── 7. 古いデータの自動削除（オプション / 30日後） ─────────
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup_old_designs', '0 3 * * *',
--   $$DELETE FROM designs WHERE created_at < now() - INTERVAL '30 days'$$);
