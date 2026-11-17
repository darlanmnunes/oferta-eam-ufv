// Lê o horário de aulas EAM publicado pela DTI/UFV e gera:
//   src/dados/dti.json     turmas, horários, salas e vagas de cada semestre (modo demonstração e conferência)
//   db/003_dados_dti.sql   catálogo de disciplinas e oferta histórica para o banco
// Uso: node scripts/importar-dti.mjs            (2022/1 até o semestre atual)
//      node scripts/importar-dti.mjs 2027 1     (só os semestres indicados)
// A página da DTI vem em latin1. Com DTI_DIR=<pasta>, lê <pasta>/hAAAA-S.html em vez de baixar.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'

const args = process.argv.slice(2)
let pares = []
for (let i = 0; i + 1 < args.length; i += 2) pares.push([Number(args[i]), Number(args[i + 1])])
if (!pares.length) {
  const agora = new Date()
  const fim = [agora.getFullYear(), agora.getMonth() >= 6 ? 2 : 1]
  for (let a = 2022; a <= fim[0]; a++) for (const s of [1, 2]) if (a < fim[0] || s <= fim[1]) pares.push([a, s])
}

const limpa = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const hora = (h) => (h.includes(':') ? h.padStart(5, '0') : `${h.padStart(2, '0')}:00`)

async function baixar(ano, semestre) {
  const local = process.env.DTI_DIR && `${process.env.DTI_DIR}/h${ano}-${semestre}.html`
  if (local && existsSync(local)) return readFileSync(local, 'utf8')
  const r = await fetch(`https://www.dti.ufv.br/horario/horario.asp?ano=${ano}&semestre=${semestre}&depto=EAM`)
  if (!r.ok) throw new Error(`DTI respondeu ${r.status} para ${ano}/${semestre}`)
  return new TextDecoder('latin1').decode(await r.arrayBuffer())
}

const nomes = new Map()
const semestres = []
const turmas = []

for (const [ano, semestre] of pares) {
  const html = await baixar(ano, semestre)
  const id = `${ano}-${semestre}`
  let n = 0
  for (const tr of html.split(/<tr[^>]*>/i).slice(1)) {
    const tds = tr.split(/<td[^>]*>/i).slice(1).map((td) => td.split(/<\/td>/i)[0])
    if (tds.length < 8) continue
    const codigo = limpa(tds[0])
    if (!/^[A-Z]{3} \d{3}$/.test(codigo)) continue
    const salas = limpa(tds[5]).split(' ').filter(Boolean)
    const horarios = [...limpa(tds[4]).matchAll(/(\d)=(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)/g)].map((h, k) => ({
      dia: Number(h[1]), inicio: hora(h[2]), fim: hora(h[3]), sala: salas[k] ?? salas[0] ?? null,
    }))
    nomes.set(codigo, limpa(tds[1]))
    turmas.push({
      semestre: id, disciplina: codigo, tipo: limpa(tds[2]) === 'P' ? 'P' : 'T', numero: Number(limpa(tds[3])) || 1,
      vagas: Number(limpa(tds[7])) || null, vagasCursos: limpa(tds[6]) || null, horarios,
    })
    n++
  }
  if (n) semestres.push({ id, ano, semestre })
  console.log(`${ano}/${semestre}: ${n} turmas`)
}

// ---------- catálogo ----------
const MINUSC = new Set(['a', 'à', 'ao', 'as', 'às', 'o', 'os', 'e', 'de', 'da', 'das', 'do', 'dos', 'em', 'para', 'por', 'com', 'no', 'na', 'nos', 'nas'])
const titulo = (s) => s.toLowerCase().split(' ').map((p, i) => {
  if (/^(i|ii|iii|iv|v|vi)$/.test(p)) return p.toUpperCase()
  if (i > 0 && MINUSC.has(p)) return p
  return p.charAt(0).toUpperCase() + p.slice(1)
}).join(' ').replace(/:\s/, ': ')

const horasDe = (t) => t.horarios.reduce((s, h) => {
  const [a, b] = [h.inicio, h.fim].map((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)))
  return s + (b - a) / 60
}, 0)

const ordem = semestres.map((s) => s.id)
const recentes = ordem.slice(-6) // três anos
const catalogo = [...nomes].sort().map(([codigo, nome]) => {
  const ofertas = new Set(turmas.filter((t) => t.disciplina === codigo).map((t) => t.semestre))
  const impares = recentes.filter((s) => s.endsWith('-1'))
  const pares_ = recentes.filter((s) => s.endsWith('-2'))
  const fi = impares.filter((s) => ofertas.has(s)).length / (impares.length || 1)
  const fp = pares_.filter((s) => ofertas.has(s)).length / (pares_.length || 1)
  let periodicidade = 'eventual'
  if (fi >= 0.6 && fp >= 0.6) periodicidade = 'ambos'
  else if (fi >= 0.6 && fp <= 0.34) periodicidade = 'impar'
  else if (fp >= 0.6 && fi <= 0.34) periodicidade = 'par'
  // créditos e período curricular pela oferta mais recente
  const ultima = [...ofertas].sort().at(-1)
  const daUltima = turmas.filter((t) => t.disciplina === codigo && t.semestre === ultima)
  const menor = (tipo) => daUltima.filter((t) => t.tipo === tipo).sort((a, b) => a.numero - b.numero)[0]
  const credT = Math.round(menor('T') ? horasDe(menor('T')) : 0)
  const credP = Math.round(menor('P') ? horasDe(menor('P')) : 0)
  const per = daUltima.map((t) => /EAM(\d{1,2})=/.exec(t.vagasCursos ?? '')?.[1]).find(Boolean)
  return {
    codigo, nome: titulo(nome), credT, credP,
    nivel: Number(codigo.slice(4)) >= 600 ? 'pos' : 'grad',
    periodicidade, periodo: per && Number(per) > 0 ? Number(per) : null,
  }
})

writeFileSync(new URL('../src/dados/dti.json', import.meta.url), JSON.stringify({
  fonte: 'https://www.dti.ufv.br/horario/', geradoEm: new Date().toISOString().slice(0, 10),
  semestres, disciplinas: catalogo, turmas,
}))

// ---------- SQL ----------
const q = (v) => (v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`)
let sql = `-- Catálogo e oferta histórica do curso (fonte: Registro Escolar/UFV, publicado no site da DTI, ${new Date().toISOString().slice(0, 10)}).
-- Gerado por scripts/importar-dti.mjs. Idempotente: não apaga turmas criadas no sistema.

set search_path = oferta, public;

insert into disciplinas (codigo, nome, cred_t, cred_p, nivel, periodicidade, periodo) values
${catalogo.map((d) => `  (${q(d.codigo)}, ${q(d.nome)}, ${d.credT}, ${d.credP}, ${q(d.nivel)}, ${q(d.periodicidade)}, ${d.periodo ?? 'null'})`).join(',\n')}
on conflict (codigo) do nothing;

insert into semestres (id, ano, semestre, situacao, origem) values
${semestres.map((s) => `  (${q(s.id)}, ${s.ano}, ${s.semestre}, 'encerrado', 'RES')`).join(',\n')}
on conflict (id) do nothing;

-- Só preenche semestres que ainda não têm turmas cadastradas no sistema.
create temp table _dti (semestre text, disciplina text, tipo tipo_turma, numero int, vagas int, vagas_cursos text, horarios jsonb);
insert into _dti values
${turmas.map((t) => `  (${q(t.semestre)}, ${q(t.disciplina)}, ${q(t.tipo)}, ${t.numero}, ${t.vagas ?? 'null'}, ${q(t.vagasCursos)}, ${q(JSON.stringify(t.horarios))})`).join(',\n')};

with novas as (
  insert into turmas (semestre_id, disciplina_codigo, tipo, numero, vagas, vagas_cursos, atualizado_por)
  select d.semestre, d.disciplina, d.tipo, d.numero, d.vagas, d.vagas_cursos, 'RES'
    from _dti d
   where not exists (select 1 from turmas t where t.semestre_id = d.semestre)
  on conflict do nothing
  returning id, semestre_id, disciplina_codigo, tipo, numero
)
insert into horarios (turma_id, dia, inicio, fim, sala)
select n.id, (h ->> 'dia')::smallint, (h ->> 'inicio')::time, (h ->> 'fim')::time, h ->> 'sala'
  from novas n
  join _dti d on d.semestre = n.semestre_id and d.disciplina = n.disciplina_codigo and d.tipo = n.tipo and d.numero = n.numero
  cross join jsonb_array_elements(d.horarios) h;

drop table _dti;
`
writeFileSync(new URL('../db/003_dados_dti.sql', import.meta.url), sql)
console.log(`${catalogo.length} disciplinas, ${turmas.length} turmas em ${semestres.length} semestres`)
