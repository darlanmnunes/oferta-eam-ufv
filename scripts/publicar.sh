#!/bin/sh
# Gera o site e envia a pasta dist/ para o ramo gh-pages, que o GitHub Pages publica.
# Uso: npm run publicar   (as variáveis do Supabase vêm do .env)
set -e
cd "$(dirname "$0")/.."
npm run build
TMP=$(mktemp -d)
cp -R dist/. "$TMP"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "Publicação $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$(cd - >/dev/null && git remote get-url origin)" gh-pages
cd - >/dev/null
rm -rf "$TMP"
echo "Publicado no ramo gh-pages."
