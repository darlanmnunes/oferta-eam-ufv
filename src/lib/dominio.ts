// Regras de cálculo da oferta: carga docente, conflitos, comparações entre semestres.
import type { Dados, Disciplina, Docente, Horario, Periodicidade, Semestre, Turma } from './tipos'

export const DIAS: Record<number, string> = { 2: 'Segunda', 3: 'Terça', 4: 'Quarta', 5: 'Quinta', 6: 'Sexta', 7: 'Sábado' }
export const DIAS_CURTOS: Record<number, string> = { 2: 'Seg', 3: 'Ter', 4: 'Qua', 5: 'Qui', 6: 'Sex', 7: 'Sáb' }
export const NOME_PERIODICIDADE: Record<Periodicidade, string> = {
  impar: '1º semestre', par: '2º semestre', ambos: 'Todo semestre', eventual: 'Eventual',
}
export const NOME_SITUACAO_SEMESTRE = { planejamento: 'Em planejamento', andamento: 'Em andamento', encerrado: 'Encerrado' } as const
export const NOME_TIPO = { T: 'Teórica', P: 'Prática', TP: 'Teórica e prática' } as const

export const minutos = (h: string | null) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : 0)
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const duracao = (h: Horario) => (h.inicio && h.fim ? Math.max(0, minutos(h.fim) - minutos(h.inicio)) / 60 : 0)
export const horasTurma = (t: Turma) => t.horarios.reduce((s, h) => s + duracao(h), 0)
export const rotulo = (t: Pick<Turma, 'disciplina' | 'tipo' | 'numero'>) => `${t.disciplina} ${t.tipo}${t.numero}`
export const nomeSemestre = (id: string) => id.replace('-', '/')
export const paridade = (id: string) => (id.endsWith('-1') ? 1 : 2)
export const fmtHoras = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1).replace('.', ','))
export const horarioTexto = (h: Horario) =>
  h.dia ? `${DIAS_CURTOS[h.dia]} ${h.inicio ?? ''}-${h.fim ?? ''}` : `A combinar${h.inicio ? ` (${fmtHoras(duracao(h))}h)` : ''}`

const ORDEM_TIPO = { T: 0, TP: 1, P: 2 }
export const ordenarTurmas = (a: Turma, b: Turma) =>
  a.disciplina.localeCompare(b.disciplina) || ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || a.numero - b.numero

export function nivelDe(t: Turma, disc: Map<string, Disciplina>) {
  return disc.get(t.disciplina)?.nivel ?? (Number(t.disciplina.slice(4)) >= 600 ? 'pos' : 'grad')
}

/** Semestre de comparação: o mesmo semestre do ano anterior; sem ele, o mais recente antes deste. */
export function referencia(semestres: Semestre[], id: string): Semestre | null {
  const [a, s] = id.split('-').map(Number)
  const igual = semestres.find((x) => x.ano === a - 1 && x.semestre === s)
  if (igual) return igual
  return [...semestres].filter((x) => x.id < id).sort((x, y) => y.id.localeCompare(x.id))[0] ?? null
}

// ---------------------------------------------------------------------------
// Carga docente
// ---------------------------------------------------------------------------
export type SituacaoCarga = 'abaixo' | 'ok' | 'elevada' | 'verificar'
export const NOME_SITUACAO: Record<SituacaoCarga, string> = {
  abaixo: 'Abaixo do mínimo', ok: 'Dentro do esperado', elevada: 'Elevada', verificar: 'Verificar',
}
export function situacaoCarga(total: number, minimo: number): SituacaoCarga {
  if (total < minimo) return 'abaixo'
  if (total <= 12) return 'ok'
  if (total <= 16) return 'elevada'
  return 'verificar'
}

export interface Carga {
  docente: Docente
  grad: number
  pos: number
  total: number
  turmas: Turma[]
  disciplinas: string[]
  situacao: SituacaoCarga
}

/** Horas de cada docente numa turma: as informadas; o que sobra é dividido igualmente entre os demais. */
export function horasPorDocente(t: Turma): Map<string, number> {
  const total = horasTurma(t)
  const fixas = t.docentes.filter((d) => t.horasDocentes?.[d] != null)
  const livres = t.docentes.filter((d) => t.horasDocentes?.[d] == null)
  const resto = Math.max(0, total - fixas.reduce((s, d) => s + t.horasDocentes[d], 0))
  return new Map(t.docentes.map((d) => [d, t.horasDocentes?.[d] ?? (livres.length ? resto / livres.length : 0)]))
}

export const NOME_SITUACAO_DOCENTE = { ativo: 'Ativo', afastado: 'Afastado', aposentado: 'Aposentado', desligado: 'Não está mais no curso' } as const

export function cargas(dados: Dados, turmas: Turma[]): Carga[] {
  const disc = new Map(dados.disciplinas.map((d) => [d.codigo, d]))
  const mapa = new Map<string, Carga>()
  for (const d of dados.docentes) {
    mapa.set(d.id, { docente: d, grad: 0, pos: 0, total: 0, turmas: [], disciplinas: [], situacao: 'abaixo' })
  }
  for (const t of turmas) {
    const hs = horasPorDocente(t)
    for (const id of t.docentes) {
      const c = mapa.get(id)
      if (!c) continue
      const h = hs.get(id) ?? 0
      if (nivelDe(t, disc) === 'pos') c.pos += h
      else c.grad += h
      c.turmas.push(t)
      if (!c.disciplinas.includes(t.disciplina)) c.disciplinas.push(t.disciplina)
    }
  }
  return [...mapa.values()]
    .filter((c) => c.docente.ativo || c.turmas.length)
    .map((c) => {
      const total = c.grad + c.pos
      return { ...c, total, situacao: situacaoCarga(total, c.docente.chMinima), turmas: c.turmas.sort(ordenarTurmas), disciplinas: c.disciplinas.sort() }
    })
    .sort((a, b) => b.total - a.total || a.docente.apelido.localeCompare(b.docente.apelido))
}

// ---------------------------------------------------------------------------
// Salas e período curricular
// ---------------------------------------------------------------------------
export type GrupoSala = 'LEA' | 'CCE' | 'PV' | 'Outras'
export function grupoSala(s: string): GrupoSala {
  if (s.startsWith('LEA')) return 'LEA'
  if (s.startsWith('CCE')) return 'CCE'
  if (/^PV[A-Z]/.test(s)) return 'PV'
  return 'Outras'
}

/** Período da matriz de EAM a que a turma se destina: pelas vagas da DTI ou pelo catálogo. */
export function periodoDe(t: Turma, disc: Map<string, Disciplina>): number | null {
  const m = /EAM(\d{1,2})=/.exec(t.vagasCursos ?? '')
  if (m && Number(m[1]) > 0) return Number(m[1])
  return disc.get(t.disciplina)?.periodo ?? null
}

// ---------------------------------------------------------------------------
// Conflitos
// ---------------------------------------------------------------------------
export interface Conflito {
  tipo: 'sala' | 'docente' | 'periodo'
  alvo: string // sala, apelido do docente ou "6º período"
  dia: number
  inicio: string
  fim: string
  turmas: Turma[]
}

const SEM_SALA = /^(DEC000|-|ACOMBINAR|ADEFINIR)?$/

interface Bloco { t: Turma; h: Horario; a: number; b: number }

function sobrepostos(blocos: Bloco[]): Bloco[][] {
  const grupos: Bloco[][] = []
  const ord = [...blocos].sort((x, y) => x.a - y.a)
  for (let i = 0; i < ord.length; i++) {
    for (let j = i + 1; j < ord.length && ord[j].a < ord[i].b; j++) {
      if (ord[i].t.id === ord[j].t.id) continue
      grupos.push([ord[i], ord[j]])
    }
  }
  return grupos
}

export function conflitos(dados: Dados, turmas: Turma[]): Conflito[] {
  const disc = new Map(dados.disciplinas.map((d) => [d.codigo, d]))
  const nomes = new Map(dados.docentes.map((d) => [d.id, d.apelido]))
  const por = new Map<string, Bloco[]>()
  const juntar = (k: string, b: Bloco) => { if (!por.has(k)) por.set(k, []); por.get(k)!.push(b) }
  for (const t of turmas) {
    for (const h of t.horarios) {
      if (!h.dia || !h.inicio || !h.fim) continue
      const b = { t, h, a: minutos(h.inicio), b: minutos(h.fim) }
      if (h.sala && !SEM_SALA.test(h.sala)) juntar(`sala|${h.sala}|${h.dia}`, b)
      for (const d of t.docentes) juntar(`docente|${d}|${h.dia}`, b)
      // choque para o estudante: aulas teóricas de disciplinas diferentes do mesmo período
      const p = periodoDe(t, disc)
      if (p && t.tipo !== 'P') juntar(`periodo|${p}|${h.dia}`, b)
    }
  }
  const out: Conflito[] = []
  for (const [k, blocos] of por) {
    const [tipo, alvo, dia] = k.split('|')
    for (const [x, y] of sobrepostos(blocos)) {
      if (tipo === 'periodo' && x.t.disciplina === y.t.disciplina) continue
      out.push({
        tipo: tipo as Conflito['tipo'],
        alvo: tipo === 'docente' ? nomes.get(alvo) ?? alvo : tipo === 'periodo' ? `${alvo}º período` : alvo,
        dia: Number(dia), inicio: hhmm(Math.max(x.a, y.a)), fim: hhmm(Math.min(x.b, y.b)), turmas: [x.t, y.t],
      })
    }
  }
  const peso = { docente: 0, sala: 1, periodo: 2 }
  return out.sort((a, b) => peso[a.tipo] - peso[b.tipo] || a.dia - b.dia || a.inicio.localeCompare(b.inicio))
}

// ---------------------------------------------------------------------------
// Pendências
// ---------------------------------------------------------------------------
export interface Pendencia { turma: Turma; motivo: string }
export function pendencias(dados: Dados, turmas: Turma[]): Pendencia[] {
  const disc = new Map(dados.disciplinas.map((d) => [d.codigo, d]))
  const out: Pendencia[] = []
  for (const t of turmas) {
    if (!t.docentes.length) out.push({ turma: t, motivo: 'Sem docente' })
    if (!t.horarios.length) out.push({ turma: t, motivo: 'Sem horário' })
    else if (t.horarios.some((h) => h.dia && !h.sala)) out.push({ turma: t, motivo: 'Horário sem sala' })
    if (!disc.has(t.disciplina)) out.push({ turma: t, motivo: 'Disciplina fora do catálogo' })
  }
  return out
}

// ---------------------------------------------------------------------------
// Revisão da oferta: o que entra e o que sai
// ---------------------------------------------------------------------------
export interface Revisao {
  ref: Semestre | null
  entraram: string[]
  sairam: string[]
  faltando: { disciplina: Disciplina; ultima: string | null }[]
  foraDoPadrao: Disciplina[]
}

export function ultimaOferta(turmas: Turma[], codigo: string, antesDe: string, mesmaParidade = false): string | null {
  const p = paridade(antesDe)
  return turmas
    .filter((t) => t.disciplina === codigo && t.semestreId < antesDe && (!mesmaParidade || paridade(t.semestreId) === p))
    .map((t) => t.semestreId).sort().at(-1) ?? null
}

export function revisao(dados: Dados, semestreId: string): Revisao {
  const ref = referencia(dados.semestres, semestreId)
  const aqui = new Set(dados.turmas.filter((t) => t.semestreId === semestreId).map((t) => t.disciplina))
  const la = new Set(ref ? dados.turmas.filter((t) => t.semestreId === ref.id).map((t) => t.disciplina) : [])
  const p = paridade(semestreId)
  const cabe = (x: Periodicidade) => x === 'ambos' || (x === 'impar' && p === 1) || (x === 'par' && p === 2)
  return {
    ref,
    entraram: [...aqui].filter((c) => !la.has(c)).sort(),
    sairam: [...la].filter((c) => !aqui.has(c)).sort(),
    faltando: dados.disciplinas
      .filter((d) => d.ativa && cabe(d.periodicidade) && !aqui.has(d.codigo))
      .map((d) => ({ disciplina: d, ultima: ultimaOferta(dados.turmas, d.codigo, semestreId, true) ?? ultimaOferta(dados.turmas, d.codigo, semestreId) })),
    foraDoPadrao: dados.disciplinas.filter((d) => aqui.has(d.codigo) && (d.periodicidade === 'impar' || d.periodicidade === 'par') && !cabe(d.periodicidade)),
  }
}

/** Periodicidade que o histórico sugere, olhando os últimos três anos. */
export function periodicidadeSugerida(dados: Dados, codigo: string): Periodicidade {
  const sems = dados.semestres.map((s) => s.id).sort().slice(-6)
  const of = new Set(dados.turmas.filter((t) => t.disciplina === codigo).map((t) => t.semestreId))
  const fr = (p: number) => {
    const l = sems.filter((s) => paridade(s) === p)
    return l.filter((s) => of.has(s)).length / (l.length || 1)
  }
  const [i, q] = [fr(1), fr(2)]
  if (i >= 0.6 && q >= 0.6) return 'ambos'
  if (i >= 0.6 && q <= 0.34) return 'impar'
  if (q >= 0.6 && i <= 0.34) return 'par'
  return 'eventual'
}

// ---------------------------------------------------------------------------
// Grade semanal: distribui blocos sobrepostos em faixas lado a lado
// ---------------------------------------------------------------------------
export interface BlocoGrade { t: Turma; h: Horario; a: number; b: number; faixa: number; faixas: number }

export function blocosDoDia(turmas: Turma[], dia: number, filtro?: (t: Turma, h: Horario) => boolean): BlocoGrade[] {
  const bl = turmas.flatMap((t) => t.horarios
    .filter((h) => h.dia === dia && h.inicio && h.fim && (!filtro || filtro(t, h)))
    .map((h) => ({ t, h, a: minutos(h.inicio), b: minutos(h.fim), faixa: 0, faixas: 1 })))
    .sort((x, y) => x.a - y.a || y.b - x.b)
  // agrupa blocos que se tocam e numera as faixas dentro de cada grupo
  let grupo: BlocoGrade[] = []
  let fimGrupo = -1
  const fechar = () => { const n = Math.max(1, ...grupo.map((g) => g.faixa + 1)); grupo.forEach((g) => (g.faixas = n)); grupo = [] }
  for (const b of bl) {
    if (b.a >= fimGrupo) { fechar(); fimGrupo = b.b }
    const ocupadas = new Set(grupo.filter((g) => g.b > b.a).map((g) => g.faixa))
    let f = 0
    while (ocupadas.has(f)) f++
    b.faixa = f
    grupo.push(b)
    fimGrupo = Math.max(fimGrupo, b.b)
  }
  fechar()
  return bl
}

export function janela(turmas: Turma[]): [number, number] {
  let a = 8 * 60, b = 18 * 60
  for (const t of turmas) for (const h of t.horarios) {
    if (!h.dia || !h.inicio || !h.fim) continue
    a = Math.min(a, Math.floor(minutos(h.inicio) / 60) * 60)
    b = Math.max(b, Math.ceil(minutos(h.fim) / 60) * 60)
  }
  return [a, b]
}

export const diasUsados = (turmas: Turma[]) =>
  turmas.some((t) => t.horarios.some((h) => h.dia === 7)) ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6]

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------
export function csvOferta(dados: Dados, turmas: Turma[]): string {
  const disc = new Map(dados.disciplinas.map((d) => [d.codigo, d]))
  const doc = new Map(dados.docentes.map((d) => [d.id, d.apelido]))
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const linhas = [['Código', 'Disciplina', 'Nível', 'Tipo', 'Turma', 'Horários', 'Salas', 'Horas/semana', 'Docentes', 'Vagas', 'Vagas por curso', 'Observação']]
  for (const t of [...turmas].sort(ordenarTurmas)) {
    linhas.push([
      t.disciplina, disc.get(t.disciplina)?.nome ?? '', nivelDe(t, disc) === 'pos' ? 'Pós' : 'Graduação', t.tipo, String(t.numero),
      t.horarios.map(horarioTexto).join(' | '), [...new Set(t.horarios.map((h) => h.sala).filter(Boolean))].join(' | '),
      fmtHoras(horasTurma(t)), t.docentes.map((d) => doc.get(d) ?? '').join(' | '), String(t.vagas ?? ''), t.vagasCursos ?? '', t.obs ?? '',
    ])
  }
  return '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n')
}

export function baixar(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nome })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
