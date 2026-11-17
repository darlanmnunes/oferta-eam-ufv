"""Lê as planilhas de distribuição de aulas e o cadastro de docentes (pasta dados-fonte/privado, fora do git) e gera:

  db/privado/004_docentes.sql   docentes (com e-mail) e quem deu cada turma; fica fora do git
  src/dados/demo.json           docentes (sem e-mail) e a mesma distribuição, para o modo demonstração

Entradas em dados-fonte/privado:
  docentes.csv           apelido;nome;email;situacao   (situacao: ativo, afastado, aposentado, desligado)
  oferta_AAAA-S.xlsx     com a aba BASE_Turmas (uma linha por dia de aula): substitui a oferta do semestre
                         ou no formato antigo (DISCIPLINAS | TIPO | HORÁRIO | DOSAGEM | SALA | PROFESSORES):
                         só os docentes entram, casados com as turmas do Registro Escolar pelo código, tipo e número

Uso: python3 scripts/importar-planilhas.py [email-do-administrador]
"""
import csv
import json
import re
import sys
import unicodedata
from datetime import time
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / 'dados-fonte' / 'privado'
DTI = json.loads((RAIZ / 'src' / 'dados' / 'dti.json').read_text())
ADMIN = (sys.argv[1] if len(sys.argv) > 1 else '').strip().lower()

DIAS = {'segunda': 2, 'terca': 3, 'quarta': 4, 'quinta': 5, 'sexta': 6, 'sabado': 7}
SEM_SALA = {'', '-', 'DEC000', 'ACOMBINAR', 'ADEFINIR'}


def chave(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().strip()


cadastro = {}
with open(FONTE / 'docentes.csv', encoding='utf-8') as f:
    for linha in csv.DictReader(f, delimiter=';'):
        cadastro[chave(linha['apelido'])] = linha


def hora(v):
    if v is None or v == '':
        return None
    if isinstance(v, time):
        return f'{v.hour:02d}:{v.minute:02d}'
    m = re.match(r'^(\d{1,2}):(\d{2})', str(v).strip())
    return f'{int(m[1]):02d}:{m[2]}' if m else None


def sala(v):
    s = re.sub(r'\s+', '', str(v or '')).upper()
    return None if s in SEM_SALA or s.startswith('(') else s


def professor(v):
    out = []
    for p in re.split(r'\s*(?:/|,| e )\s*', re.sub(r'\s+', ' ', str(v or '')).strip()):
        if not p or p in {'-', '?'}:
            continue
        k = chave(p)
        if k not in cadastro:
            print(f'  aviso: "{p}" não está em docentes.csv; incluído só com o apelido')
            cadastro[k] = {'apelido': p, 'nome': p, 'email': '', 'situacao': 'desligado'}
        if k not in out:
            out.append(k)
    return out


def turmas_base(ws):
    """Aba BASE_Turmas: agrupa as linhas por disciplina, tipo e turma."""
    grupos = {}
    for r in ws.iter_rows(min_row=4, values_only=True):
        codigo = str(r[1] or '').strip()
        if not re.match(r'^[A-Z]{3} \d{3}$', codigo):
            continue
        tipo = {'T+P': 'TP'}.get(str(r[3]).strip(), str(r[3]).strip())
        numero = int(float(r[4] or 1))
        g = grupos.setdefault((codigo, tipo, numero), {
            'disciplina': codigo, 'nome': str(r[2] or '').strip(), 'tipo': tipo, 'numero': numero,
            'nivel': 'pos' if str(r[11] or '').lower().startswith('p') else 'grad',
            'docentes': [], 'horarios': [], 'obs': None})
        dia = DIAS.get(chave(str(r[5] or '')))
        h = {'dia': dia, 'inicio': hora(r[6]), 'fim': hora(r[7]), 'sala': sala(r[9]) if dia else None}
        if h['inicio'] or dia or 'combinar' in str(r[5] or '').lower():
            g['horarios'].append(h)
        if r[8] and not g['obs']:
            g['obs'] = str(r[8]).strip()
        for p in professor(r[10]):
            if p not in g['docentes']:
                g['docentes'].append(p)
    return list(grupos.values())


def professores_antigo(ws):
    """Formato antigo: devolve {(codigo, tipo, numero): [docentes]}. Acha a coluna DISCIPLINAS em qualquer posição."""
    out, col = {}, None
    for r in ws.iter_rows(values_only=True):
        if col is None:
            col = next((i for i, c in enumerate(r) if str(c or '').strip().upper() == 'DISCIPLINAS'), None)
            continue
        m = re.match(r'^\s*([A-Z]{3})\s*P?(\d{3})', str(r[col] or ''))
        if not m:
            continue
        ds = professor(r[col + 5])
        # "T1", "P2" ou "T1 e P1"
        for t in re.finditer(r'([TP])\s*(\d+)', str(r[col + 1] or '')):
            out[(f'{m[1]} {m[2]}', t[1], int(t[2]))] = ds
    return out


ofertas, atribuicoes, extras = {}, {}, {}
codigos_dti = {x['codigo'] for x in DTI['disciplinas']}
for arq in sorted(FONTE.glob('oferta_*.xlsx')):
    sem = re.search(r'(\d{4}-[12])', arq.name)[1]
    wb = openpyxl.load_workbook(arq, data_only=True)
    if 'BASE_Turmas' in wb.sheetnames:
        ofertas[sem] = turmas_base(wb['BASE_Turmas'])
        vagas = {(t['disciplina'], t['tipo'], t['numero']): t for t in DTI['turmas'] if t['semestre'] == sem}
        for t in ofertas[sem]:
            d = vagas.get((t['disciplina'], t['tipo'], t['numero']))
            t['vagas'], t['vagasCursos'] = (d['vagas'], d['vagasCursos']) if d else (None, None)
            if t['disciplina'] not in codigos_dti:
                extras[t['disciplina']] = {'codigo': t['disciplina'], 'nome': t['nome'], 'nivel': t['nivel']}
        print(f'{sem}: {len(ofertas[sem])} turmas da aba BASE_Turmas')
    else:
        atribuicoes[sem] = professores_antigo(wb.worksheets[0])
        print(f'{sem}: docentes de {len(atribuicoes[sem])} turmas (formato antigo)')

# todos do cadastro entram, mesmo sem turma (ex.: afastados)
docentes = sorted(cadastro, key=lambda k: chave(cadastro[k]['nome']))


def q(v):
    return 'null' if v is None or v == '' else "'" + str(v).replace("'", "''") + "'"


def eh_admin(d):
    return bool(ADMIN) and cadastro[d]['email'].lower() == ADMIN


sql = ['-- Docentes e distribuição real das turmas. Gerado por scripts/importar-planilhas.py. NÃO VERSIONAR.', '']
for d in docentes:
    c = cadastro[d]
    sql.append(f"insert into docentes (nome, apelido, email, situacao, admin) values ({q(c['nome'])}, {q(c['apelido'])}, "
               f"{q(c['email'].lower())}, {q(c['situacao'])}, {'true' if eh_admin(d) else 'false'}) on conflict do nothing;")
for e in extras.values():
    sql.append(f"insert into disciplinas (codigo, nome, nivel, periodicidade) values ({q(e['codigo'])}, {q(e['nome'])}, {q(e['nivel'])}, 'eventual') on conflict do nothing;")
for sem, mapa in atribuicoes.items():
    for (c, t, n), ds in mapa.items():
        for d in ds:
            sql.append(f"insert into turma_docentes (turma_id, docente_id) select t.id, d.id from turmas t, docentes d where t.semestre_id = {q(sem)} "
                       f"and t.disciplina_codigo = {q(c)} and t.tipo = {q(t)} and t.numero = {n} and d.apelido = {q(cadastro[d]['apelido'])} on conflict do nothing;")
for sem, turmas in ofertas.items():
    sql.append(f"\ninsert into semestres (id, ano, semestre, origem) values ({q(sem)}, {sem[:4]}, {sem[-1]}, 'planilha') "
               "on conflict (id) do update set situacao = 'planejamento', origem = 'planilha';")
    sql.append(f'delete from turmas where semestre_id = {q(sem)};')
    for t in turmas:
        sql.append(f"with t as (insert into turmas (semestre_id, disciplina_codigo, tipo, numero, vagas, vagas_cursos, obs, atualizado_por) values "
                   f"({q(sem)}, {q(t['disciplina'])}, {q(t['tipo'])}, {t['numero']}, {t['vagas'] or 'null'}, {q(t['vagasCursos'])}, {q(t['obs'])}, 'planilha') returning id)")
        nomes = ', '.join(q(cadastro[d]['apelido']) for d in t['docentes']) or 'null'
        sql.append(f", td as (insert into turma_docentes (turma_id, docente_id) select t.id, d.id from t, docentes d where d.apelido in ({nomes}))")
        hs = ' union all '.join(f"select id, {h['dia'] or 'null'}::smallint, {q(h['inicio'])}::time, {q(h['fim'])}::time, {q(h['sala'])} from t" for h in t['horarios'])
        sql.append(f'insert into horarios (turma_id, dia, inicio, fim, sala) {hs};' if hs else 'select 1 from t;')
sql.append("\n-- os dois semestres mais recentes aparecem na página pública\nupdate semestres set publicado = true where id in (select id from semestres order by id desc limit 2);")
(RAIZ / 'db' / 'privado').mkdir(exist_ok=True)
(RAIZ / 'db' / 'privado' / '004_docentes.sql').write_text('\n'.join(sql) + '\n')

ident = {d: f'd{i + 1}' for i, d in enumerate(docentes)}
demo = {
    'docentes': [{'id': ident[d], 'nome': cadastro[d]['nome'], 'apelido': cadastro[d]['apelido'],
                  'situacao': cadastro[d]['situacao'], 'admin': eh_admin(d)} for d in docentes],
    'extras': list(extras.values()),
    'atribuicoes': {s: [{'disciplina': c, 'tipo': t, 'numero': n, 'docentes': [ident[d] for d in ds]} for (c, t, n), ds in m.items()]
                    for s, m in atribuicoes.items()},
    'ofertas': {s: [{**{k: v for k, v in t.items() if k not in ('nome', 'nivel')}, 'docentes': [ident[d] for d in t['docentes']]} for t in ts]
                for s, ts in ofertas.items()},
}
(RAIZ / 'src' / 'dados' / 'demo.json').write_text(json.dumps(demo, ensure_ascii=False))
print(f'{len(docentes)} docentes | gerados db/privado/004_docentes.sql e src/dados/demo.json')
