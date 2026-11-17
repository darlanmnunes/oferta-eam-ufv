#!/bin/sh
# Recria o banco local e aplica o esquema. Uso: npm run db:local
# Se existir db/privado/004_docentes.sql (fora do git), também carrega os docentes e a oferta real.
set -e
cd "$(dirname "$0")"
BANCO="${OFERTA_BANCO:-oferta}"
dropdb --if-exists "$BANCO"
createdb "$BANCO"
for f in 000_local_auth.sql 001_esquema.sql 002_regras.sql 003_dados_dti.sql 005_situacao_semestre.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$BANCO" -f "$f"
done
if [ -z "$SEM_PRIVADO" ] && [ -f privado/004_docentes.sql ]; then psql -q -v ON_ERROR_STOP=1 -d "$BANCO" -f privado/004_docentes.sql; fi
echo "Banco $BANCO pronto."
