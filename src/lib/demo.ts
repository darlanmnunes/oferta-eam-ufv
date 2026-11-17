// Modo demonstração: mesmo contrato do banco, dados no navegador e docentes fictícios.
// Parte do horário público da DTI (2022 a 2026) com uma distribuição de docentes de exemplo.
import dti from '../dados/dti.json'
import exemplo from '../dados/demo.json'
import { rotulo } from './dominio'
import type { Api, Dados, Docente, Evento, Turma } from './tipos'

const CHAVE = 'oferta-eam-demo-v2'
const CHAVE_EU = 'oferta-eam-demo-eu'

interface Estado extends Dados { historico: Evento[] }
type Ex = typeof exemplo & {
  ofertas: Record<string, { disciplina: string; tipo: string; numero: number; vagas: number | null; vagasCursos: string | null; obs: string | null; docentes: string[]; horarios: Turma['horarios'] }[]>
  atribuicoes: Record<string, { disciplina: string; tipo: string; numero: number; docentes: string[] }[]>
}
const ex = exemplo as Ex

let seq = 0
const novoId = () => `x${Date.now().toString(36)}${(seq++).toString(36)}`

function inicial(): Estado {
  const docentes: Docente[] = ex.docentes.map((d) => ({
    ...d, situacao: d.situacao as Docente['situacao'], ativo: d.situacao === 'ativo', chMinima: 8,
    email: d.situacao === 'ativo' ? `${d.apelido.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')}@exemplo.ufv.br` : null, ligado: d.admin,
  }))
  let turmas: Turma[] = dti.turmas.map((t, i) => ({
    id: `t${i}`, semestreId: t.semestre, disciplina: t.disciplina, tipo: t.tipo as Turma['tipo'], numero: t.numero,
    vagas: t.vagas, vagasCursos: t.vagasCursos, obs: null, docentes: [], horasDocentes: {}, horarios: t.horarios, atualizadoEm: null, atualizadoPor: 'RES',
  }))
  for (const [sem, lista] of Object.entries(ex.atribuicoes)) {
    for (const a of lista) {
      const t = turmas.find((x) => x.semestreId === sem && x.disciplina === a.disciplina && x.tipo === a.tipo && x.numero === a.numero)
      if (t) t.docentes = a.docentes
    }
  }
  for (const [sem, lista] of Object.entries(ex.ofertas)) {
    turmas = turmas.filter((t) => t.semestreId !== sem).concat(lista.map((t, i) => ({
      ...t, id: `p${sem}${i}`, semestreId: sem, tipo: t.tipo as Turma['tipo'], horasDocentes: {}, atualizadoEm: null, atualizadoPor: 'planilha',
    })))
  }
  const abertos = new Set(Object.keys(ex.ofertas))
  return {
    docentes,
    disciplinas: [
      ...dti.disciplinas.map((d) => ({ ...d, nivel: d.nivel as 'grad' | 'pos', periodicidade: d.periodicidade as Dados['disciplinas'][0]['periodicidade'], ativa: true, obs: null })),
      ...ex.extras.map((e) => ({ codigo: e.codigo, nome: e.nome, credT: 0, credP: 0, nivel: e.nivel as 'grad' | 'pos', periodicidade: 'eventual' as const, periodo: null, ativa: true, obs: null })),
    ].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    semestres: dti.semestres.map((s, i, l) => ({
      ...s, semestre: s.semestre as 1 | 2, situacao: abertos.has(s.id) ? 'planejamento' as const : 'fechado' as const,
      origem: abertos.has(s.id) ? 'planilha' : 'RES', publicado: i >= l.length - 2,
    })),
    turmas,
    historico: [],
  }
}

let estado: Estado = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Estado | null
    if (s?.turmas) return s
  } catch { /* começa do zero */ }
  return inicial()
})()

const ouvintes = new Set<() => void>()
const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch { /* sem armazenamento */ } }
const lerEu = () => { try { return localStorage.getItem(CHAVE_EU) } catch { return null } }
const copia = <T,>(x: T): T => structuredClone(x)
const espera = () => new Promise((r) => setTimeout(r, 120))

function eu(): Docente | null {
  const id = lerEu()
  return estado.docentes.find((d) => d.id === id && d.ativo) ?? null
}
function exigirDocente() { const e = eu(); if (!e) throw new Error('Acesso restrito aos docentes do curso'); return e }
function exigirAdmin() { const e = exigirDocente(); if (!e.admin) throw new Error('Só o administrador pode fazer isso'); return e }
function exigirAberto(sem: string) {
  const s = estado.semestres.find((x) => x.id === sem)
  if (!s) throw new Error(`Semestre ${sem} não existe`)
  if (s.situacao === 'fechado' && !eu()?.admin) throw new Error(`O semestre ${sem.replace('-', '/')} está fechado. Peça ao administrador para reabrir.`)
}
function registrar(semestreId: string | null, acao: string, resumo: string) {
  estado.historico.unshift({ id: Date.now() + seq++, quando: new Date().toISOString(), autor: eu()?.apelido ?? 'sistema', semestreId, acao, resumo })
  guardar()
}
function copiarTurmas(de: Turma[], para: string) {
  const ativos = new Set(estado.docentes.filter((d) => d.ativo).map((d) => d.id))
  return de.map((t) => ({ ...copia(t), id: novoId(), semestreId: para, docentes: t.docentes.filter((d) => ativos.has(d)), atualizadoEm: new Date().toISOString(), atualizadoPor: eu()?.apelido ?? null }))
}

export function reiniciarDemo() {
  estado = inicial()
  guardar()
}

export const demo: Api = {
  modo: 'demo',
  async sessao() {
    const id = lerEu()
    if (!id) return null
    if (id === 'visitante') return { email: 'visitante@exemplo.ufv.br', docente: null }
    const d = eu()
    return d ? { email: d.email ?? '', docente: copia(d) } : null
  },
  async entrar(persona) {
    try { localStorage.setItem(CHAVE_EU, persona ?? '') } catch { /* sem armazenamento */ }
    ouvintes.forEach((f) => f())
  },
  async sair() {
    try { localStorage.removeItem(CHAVE_EU) } catch { /* sem armazenamento */ }
    ouvintes.forEach((f) => f())
  },
  aoMudarSessao(f) { ouvintes.add(f); return () => ouvintes.delete(f) },
  personas() {
    const a = estado.docentes.find((d) => d.admin) ?? estado.docentes[0]
    const b = estado.docentes.find((d) => !d.admin && d.ativo) ?? estado.docentes[1]
    return [
      { id: a.id, nome: a.nome, papel: 'Administrador: também cuida de docentes e semestres' },
      { id: b.id, nome: b.nome, papel: 'Docente: edita a oferta do semestre' },
      { id: 'visitante', nome: 'Conta não liberada', papel: 'E-mail @ufv.br ainda fora da lista de docentes' },
    ]
  },
  async carregar() {
    await espera()
    if (!eu()) return { semestres: [], disciplinas: [], docentes: [], turmas: [] }
    const admin = eu()!.admin
    return copia({
      semestres: estado.semestres, disciplinas: estado.disciplinas, turmas: estado.turmas,
      docentes: estado.docentes.map((d) => (admin ? d : { ...d, email: undefined, ligado: undefined })),
    })
  },
  async historico(limite = 300) { exigirDocente(); return copia(estado.historico.slice(0, limite)) },

  async salvarTurma(t) {
    const e = exigirDocente()
    const antiga = t.id ? estado.turmas.find((x) => x.id === t.id) : undefined
    if (t.id && !antiga) throw new Error('Turma não encontrada')
    exigirAberto(antiga?.semestreId ?? t.semestreId)
    const sem = antiga?.semestreId ?? t.semestreId
    if (estado.turmas.some((x) => x.id !== t.id && x.semestreId === sem && x.disciplina === t.disciplina && x.tipo === t.tipo && x.numero === t.numero)) {
      throw new Error(`Já existe a turma ${t.disciplina} ${t.tipo} ${t.numero} neste semestre`)
    }
    for (const h of t.horarios) if (h.inicio && h.fim && h.fim <= h.inicio) throw new Error('O fim da aula deve vir depois do início')
    const nova: Turma = {
      ...t, id: t.id ?? novoId(), semestreId: sem, atualizadoEm: new Date().toISOString(), atualizadoPor: e.apelido,
      horarios: t.horarios.map((h) => ({ ...h, sala: h.sala ? h.sala.replace(/\s+/g, '').toUpperCase() : null })),
    }
    estado.turmas = antiga ? estado.turmas.map((x) => (x.id === t.id ? nova : x)) : [...estado.turmas, nova]
    registrar(sem, antiga ? 'turma_alterada' : 'turma_criada', `${antiga ? 'Alterou' : 'Criou'} ${rotulo(nova)}`)
    return nova.id
  },
  async excluirTurma(id) {
    exigirDocente()
    const t = estado.turmas.find((x) => x.id === id)
    if (!t) throw new Error('Turma não encontrada')
    exigirAberto(t.semestreId)
    estado.turmas = estado.turmas.filter((x) => x.id !== id)
    registrar(t.semestreId, 'turma_excluida', `Excluiu ${rotulo(t)}`)
  },
  async copiarDisciplina(sem, codigo, origem) {
    exigirDocente(); exigirAberto(sem)
    const ja = new Set(estado.turmas.filter((t) => t.semestreId === sem).map(rotulo))
    const novas = copiarTurmas(estado.turmas.filter((t) => t.semestreId === origem && t.disciplina === codigo && !ja.has(rotulo(t))), sem)
    estado.turmas.push(...novas)
    if (novas.length) registrar(sem, 'disciplina_incluida', `Incluiu ${codigo} (${novas.length} turma${novas.length > 1 ? 's' : ''} copiada${novas.length > 1 ? 's' : ''} de ${origem.replace('-', '/')})`)
    return novas.length
  },
  async retirarDisciplina(sem, codigo) {
    exigirDocente(); exigirAberto(sem)
    const n = estado.turmas.filter((t) => t.semestreId === sem && t.disciplina === codigo).length
    estado.turmas = estado.turmas.filter((t) => !(t.semestreId === sem && t.disciplina === codigo))
    if (n) registrar(sem, 'disciplina_retirada', `Retirou ${codigo} da oferta (${n} turma${n > 1 ? 's' : ''})`)
    return n
  },
  async salvarDisciplina(d) {
    exigirDocente()
    const codigo = d.codigo.trim().toUpperCase()
    if (!/^[A-Z]{3} \d{3}$/.test(codigo)) throw new Error('Use o código no formato EAM 123')
    if (d.nome.trim().length < 3) throw new Error('Informe o nome da disciplina')
    const existe = estado.disciplinas.some((x) => x.codigo === codigo)
    const nova = { ...d, codigo, nome: d.nome.trim() }
    estado.disciplinas = existe ? estado.disciplinas.map((x) => (x.codigo === codigo ? nova : x)) : [...estado.disciplinas, nova].sort((a, b) => a.codigo.localeCompare(b.codigo))
    registrar(null, existe ? 'disciplina_alterada' : 'disciplina_criada', `${existe ? 'Alterou o cadastro de' : 'Cadastrou'} ${codigo}`)
  },
  async excluirDisciplina(codigo) {
    exigirDocente()
    if (estado.turmas.some((t) => t.disciplina === codigo)) throw new Error(`${codigo} já foi ofertada. Em vez de excluir, marque como inativa.`)
    estado.disciplinas = estado.disciplinas.filter((d) => d.codigo !== codigo)
    registrar(null, 'disciplina_excluida', `Excluiu ${codigo} do catálogo`)
  },
  async criarSemestre(ano, semestre, origem) {
    exigirDocente()
    const id = `${ano}-${semestre}`
    if (estado.semestres.some((s) => s.id === id)) throw new Error(`O semestre ${ano}/${semestre} já existe`)
    estado.semestres.push({ id, ano, semestre: semestre as 1 | 2, situacao: 'planejamento', origem, publicado: false })
    const novas = origem ? copiarTurmas(estado.turmas.filter((t) => t.semestreId === origem), id) : []
    estado.turmas.push(...novas)
    registrar(id, 'semestre_criado', `Criou o semestre ${ano}/${semestre}${origem ? ` a partir de ${origem.replace('-', '/')} (${novas.length} turmas)` : ' vazio'}`)
    return id
  },
  async definirSituacao(id, s) {
    exigirAdmin()
    const sem = estado.semestres.find((x) => x.id === id)
    if (!sem) throw new Error('Semestre não encontrado')
    sem.situacao = s
    registrar(id, `semestre_${s}`, `${s === 'fechado' ? 'Fechou' : 'Reabriu'} o semestre ${id.replace('-', '/')}`)
  },
  async excluirSemestre(id, confirmacao) {
    exigirAdmin()
    if (confirmacao !== id) throw new Error('Confirmação não confere')
    const n = estado.turmas.filter((t) => t.semestreId === id).length
    estado.semestres = estado.semestres.filter((s) => s.id !== id)
    estado.turmas = estado.turmas.filter((t) => t.semestreId !== id)
    registrar(id, 'semestre_excluido', `Excluiu o semestre ${id.replace('-', '/')} com ${n} turmas`)
  },
  async salvarDocente(d) {
    const e = exigirAdmin()
    if (d.id === e.id && (d.admin === false || (d.situacao && d.situacao !== 'ativo'))) throw new Error('Você não pode tirar o seu próprio acesso de administrador')
    if (d.email && !/^[^@\s]+@([a-z0-9-]+\.)*ufv\.br$/i.test(d.email.trim())) throw new Error('Use um e-mail @ufv.br')
    const email = d.email?.trim().toLowerCase() || null
    if (email && estado.docentes.some((x) => x.id !== d.id && x.email === email)) throw new Error(`Já existe docente com o e-mail ${email}`)
    const situacao = d.situacao ?? 'ativo'
    const base = { chMinima: 8, admin: false, ...d, situacao, ativo: situacao === 'ativo', email, nome: d.nome.trim(), apelido: d.apelido.trim() }
    if (d.id) estado.docentes = estado.docentes.map((x) => (x.id === d.id ? { ...x, ...base } as Docente : x))
    else estado.docentes.push({ ...base, id: novoId(), ligado: false } as Docente)
    registrar(null, 'docente_salvo', `Atualizou o cadastro de ${base.apelido}`)
  },
  async definirPublicacao(id, publicado) {
    exigirAdmin()
    const s = estado.semestres.find((x) => x.id === id)
    if (!s) throw new Error('Semestre não encontrado')
    s.publicado = publicado
    registrar(id, publicado ? 'semestre_publicado' : 'semestre_despublicado', `${publicado ? 'Publicou' : 'Tirou da página pública'} o semestre ${id.replace('-', '/')}`)
  },
  async publica() {
    await espera()
    const pub = new Set(estado.semestres.filter((s) => s.publicado).map((s) => s.id))
    return copia({
      semestres: estado.semestres.filter((s) => pub.has(s.id)),
      disciplinas: estado.disciplinas,
      docentes: estado.docentes.map((d) => ({ ...d, email: undefined, ligado: undefined })),
      turmas: estado.turmas.filter((t) => pub.has(t.semestreId)),
    })
  },
}
