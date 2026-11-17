export type Nivel = 'grad' | 'pos'
export type Periodicidade = 'impar' | 'par' | 'ambos' | 'eventual'
export type Tipo = 'T' | 'P' | 'TP'
export type Situacao = 'planejamento' | 'fechado'
export type SituacaoDocente = 'ativo' | 'afastado' | 'aposentado' | 'desligado'

export interface Disciplina {
  codigo: string
  nome: string
  credT: number
  credP: number
  nivel: Nivel
  periodicidade: Periodicidade
  periodo: number | null
  ativa: boolean
  obs: string | null
}

export interface Semestre {
  id: string // '2027-1'
  ano: number
  semestre: 1 | 2
  situacao: Situacao
  origem: string | null
  publicado: boolean
}

export interface Docente {
  id: string
  nome: string
  apelido: string
  chMinima: number
  situacao: SituacaoDocente
  ativo: boolean // situacao === 'ativo': entra no sistema e recebe turmas
  admin: boolean
  email?: string | null // só o administrador vê
  ligado?: boolean // já entrou com a conta Google
}

/** dia nulo: horário a combinar (conta na carga, fica fora das grades). 2 = segunda, como na DTI. */
export interface Horario {
  dia: number | null
  inicio: string | null // 'HH:MM'
  fim: string | null
  sala: string | null
}

export interface Turma {
  id: string
  semestreId: string
  disciplina: string
  tipo: Tipo
  numero: number
  vagas: number | null
  vagasCursos: string | null // 'EAM4=20 GER0=10'
  obs: string | null
  docentes: string[]
  /** Horas semanais de cada docente quando não for divisão igual (ex.: um dá a teórica, outro a prática). */
  horasDocentes: Record<string, number>
  horarios: Horario[]
  atualizadoEm: string | null
  atualizadoPor: string | null
}

export type TurmaNova = Omit<Turma, 'id' | 'atualizadoEm' | 'atualizadoPor'> & { id?: string }

export interface Evento {
  id: number
  quando: string
  autor: string
  semestreId: string | null
  acao: string
  resumo: string
}

export interface Dados {
  semestres: Semestre[]
  disciplinas: Disciplina[]
  docentes: Docente[]
  turmas: Turma[]
}

export interface Persona { id: string; nome: string; papel: string }

export interface Api {
  modo: 'demo' | 'supabase'
  /** null: não entrou. { docente: null }: entrou, mas o e-mail não está liberado. */
  sessao(): Promise<{ email: string; docente: Docente | null } | null>
  entrar(persona?: string): Promise<void>
  sair(): Promise<void>
  aoMudarSessao(f: () => void): () => void
  personas(): Persona[]
  carregar(): Promise<Dados>
  historico(limite?: number): Promise<Evento[]>
  salvarTurma(t: TurmaNova): Promise<string>
  excluirTurma(id: string): Promise<void>
  copiarDisciplina(semestre: string, codigo: string, origem: string): Promise<number>
  retirarDisciplina(semestre: string, codigo: string): Promise<number>
  salvarDisciplina(d: Disciplina): Promise<void>
  excluirDisciplina(codigo: string): Promise<void>
  criarSemestre(ano: number, semestre: number, origem: string | null): Promise<string>
  definirSituacao(id: string, s: Situacao): Promise<void>
  excluirSemestre(id: string, confirmacao: string): Promise<void>
  salvarDocente(d: Partial<Docente> & { nome: string; apelido: string }): Promise<void>
  definirPublicacao(id: string, publicado: boolean): Promise<void>
  /** Oferta dos semestres publicados, sem login. */
  publica(): Promise<Dados>
}
