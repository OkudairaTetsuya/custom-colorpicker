-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- スタンプ機能 マイグレーション
-- Supabase SQL Editor で実行してください
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. カテゴリテーブル
CREATE TABLE IF NOT EXISTS stamp_categories (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  tag_color  TEXT        NOT NULL DEFAULT '#6366f1',  -- カテゴリタブの表示色（HEX）
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. スタンプテーブル
CREATE TABLE IF NOT EXISTS stamps (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  category_id UUID        REFERENCES stamp_categories(id) ON DELETE SET NULL,
  svg_url     TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS 有効化
ALTER TABLE stamp_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamps            ENABLE ROW LEVEL SECURITY;

-- 4. 読み取りは全員OK（フロントエンドから匿名で参照）
CREATE POLICY "stamp_categories_public_read"
  ON stamp_categories FOR SELECT USING (true);

CREATE POLICY "stamps_public_read"
  ON stamps FOR SELECT USING (true);

-- 5. 書き込みはサービスロールのみ（管理画面はanon keyでINSERT/UPDATE/DELETEするため許可）
CREATE POLICY "stamp_categories_anon_write"
  ON stamp_categories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "stamps_anon_write"
  ON stamps FOR ALL USING (true) WITH CHECK (true);

-- 6. Storage バケット（stamps）
-- ※ Supabase ダッシュボード > Storage から手動作成してもOK
INSERT INTO storage.buckets (id, name, public)
VALUES ('stamps', 'stamps', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage RLS
CREATE POLICY "stamps_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stamps');

CREATE POLICY "stamps_storage_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stamps');

CREATE POLICY "stamps_storage_anon_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stamps');
