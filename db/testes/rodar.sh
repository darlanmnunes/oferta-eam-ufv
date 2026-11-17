#!/bin/sh
# Aplica o esquema num banco descartável (só dados públicos da DTI) e percorre as regras de acesso.
set -e
cd "$(dirname "$0")/.."
SEM_PRIVADO=1 OFERTA_BANCO=oferta_teste sh aplicar-local.sh >/dev/null 2>&1
if saida=$(psql -q -v ON_ERROR_STOP=1 -d oferta_teste -f testes/fluxo.sql 2>&1 >/dev/null); then ok=1; else ok=0; fi
echo "$saida" | sed -n 's/.*NOTICE:  //p; /ERROR/p'
dropdb oferta_teste
[ "$ok" = 1 ] && echo "Teste do banco concluído sem falhas." || { echo "TESTE FALHOU"; exit 1; }
