// Vercel ビルド時に環境変数から supabase.config.js を生成するスクリプト
const fs = require('fs');

const url   = (process.env.SUPABASE_URL      || '').trim();
const key   = (process.env.SUPABASE_ANON_KEY || '').trim();
const admin = (process.env.ADMIN_PASSWORD    || '').trim();

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL / SUPABASE_ANON_KEY が設定されていません');
  process.exit(1);
}
if (!admin) {
  console.error('ERROR: ADMIN_PASSWORD が設定されていません');
  process.exit(1);
}

fs.writeFileSync(
  'supabase.config.js',
  [
    `window.SUPABASE_URL      = ${JSON.stringify(url)};`,
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};`,
    `window.ADMIN_PASSWORD    = ${JSON.stringify(admin)};`,
  ].join('\n') + '\n'
);

console.log('supabase.config.js を生成しました');
