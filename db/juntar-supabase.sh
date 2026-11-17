#!/bin/sh
# Junta os scripts num arquivo só, para colar no SQL Editor do Supabase.
# O arquivo com os docentes (db/privado/004_docentes.sql) entra junto, mas o resultado fica fora do git.
cd "$(dirname "$0")"
{ echo "-- Oferta de Disciplinas EAM | esquema completo para o Supabase (gerado por db/juntar-supabase.sh)"
  for f in 001_esquema.sql 002_regras.sql 003_dados_dti.sql privado/004_docentes.sql; do
    [ -f "$f" ] && { printf '\n-- ===== %s =====\n' "$f"; cat "$f"; }
  done
} > privado/supabase_completo.sql
echo "db/privado/supabase_completo.sql gerado"
