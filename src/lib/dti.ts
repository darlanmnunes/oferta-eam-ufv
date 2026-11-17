// Lê o horário da DTI colado na tela (texto copiado da página ou o código-fonte HTML)
// e compara com a oferta cadastrada.
import { horarioTexto, rotulo } from './dominio'
import type { Horario, Tipo, Turma } from './tipos'

export interface TurmaDti {
  disciplina: string
  nome: string
  tipo: Tipo
  numero: number
  vagas: number | null
  vagasCursos: string | null
  horarios: Horario[]
}

export const enderecoDti = (semestre: string) => {
  const [a, s] = semestre.split('-')
  return `https://www.dti.ufv.br/horario/horario.asp?ano=${a}&semestre=${s}&depto=EAM`
}

const hora = (h: string) => (h.includes(':') ? h.padStart(5, '0') : `${h.padStart(2, '0')}:00`)

function linha(cel: string[]): TurmaDti | null {
  const c = cel.map((x) => x.replace(/\s+/g, ' ').trim())
  if (c.length < 5 || !/^[A-Z]{3} \d{3}$/.test(c[0])) return null
  const salas = (c[5] ?? '').split(' ').filter(Boolean)
  const horarios = [...(c[4] ?? '').matchAll(/(\d)=(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)/g)].map((m, k) => ({
    dia: Number(m[1]), inicio: hora(m[2]), fim: hora(m[3]), sala: salas[k] ?? salas[0] ?? null,
  }))
  return {
    disciplina: c[0], nome: c[1] ?? '', tipo: c[2] === 'P' ? 'P' : 'T', numero: Number(c[3]) || 1,
    vagas: Number(c[7]) || null, vagasCursos: c[6] || null, horarios,
  }
}

export function lerDti(texto: string): TurmaDti[] {
  if (/<tr/i.test(texto)) {
    const limpa = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    return texto.split(/<tr[^>]*>/i).slice(1)
      .map((tr) => linha(tr.split(/<td[^>]*>/i).slice(1).map((td) => limpa(td.split(/<\/td>/i)[0]))))
      .filter((x): x is TurmaDti => !!x)
  }
  return texto.split(/\r?\n/).map((l) => linha(l.split('\t'))).filter((x): x is TurmaDti => !!x)
}

export interface Diferenca { turma: Turma; dti: TurmaDti; campos: string[] }
export interface Comparacao { so_dti: TurmaDti[]; so_aqui: Turma[]; diferentes: Diferenca[]; iguais: number }

const chave = (t: { disciplina: string; tipo: string; numero: number }) => `${t.disciplina}|${t.tipo}|${t.numero}`
const textoHorarios = (hs: Horario[]) => hs.filter((h) => h.dia).map(horarioTexto).sort().join(', ')
const textoSalas = (hs: Horario[]) => hs.filter((h) => h.dia).map((h) => `${h.dia}${h.inicio}${h.sala ?? ''}`).sort().join(',')

export function comparar(aqui: Turma[], dti: TurmaDti[]): Comparacao {
  const m = new Map(aqui.map((t) => [chave(t), t]))
  const d = new Map(dti.map((t) => [chave(t), t]))
  const diferentes: Diferenca[] = []
  let iguais = 0
  for (const x of dti) {
    const t = m.get(chave(x))
    if (!t) continue
    const campos: string[] = []
    if (textoHorarios(t.horarios) !== textoHorarios(x.horarios)) campos.push('horário')
    else if (textoSalas(t.horarios) !== textoSalas(x.horarios)) campos.push('sala')
    if ((t.vagas ?? null) !== x.vagas || (t.vagasCursos ?? null) !== x.vagasCursos) campos.push('vagas')
    if (campos.length) diferentes.push({ turma: t, dti: x, campos })
    else iguais++
  }
  return {
    so_dti: dti.filter((x) => !m.has(chave(x))),
    so_aqui: aqui.filter((t) => !d.has(chave(t)) && t.tipo !== 'TP'),
    diferentes: diferentes.sort((a, b) => rotulo(a.turma).localeCompare(rotulo(b.turma))),
    iguais,
  }
}
