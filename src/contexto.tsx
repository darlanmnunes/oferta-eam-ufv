import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './lib/api'
import type { Dados, Docente, Semestre, Turma, TurmaNova } from './lib/tipos'

interface Oferta {
  pronto: boolean
  email: string | null
  eu: Docente | null
  dados: Dados
  semestre: Semestre | null
  turmas: Turma[] // do semestre escolhido
  podeEditar: boolean
  escolherSemestre(id: string): void
  recarregar(): Promise<void>
  /** Executa uma ação no banco, recarrega e avisa. Devolve false se deu erro. */
  agir(f: () => Promise<unknown>, ok?: string): Promise<boolean>
  avisar(texto: string, tom?: 'ok' | 'erro'): void
  editando: TurmaNova | null
  editar(t: TurmaNova | null): void
}

const vazio: Dados = { semestres: [], disciplinas: [], docentes: [], turmas: [] }
const Ctx = createContext<Oferta | null>(null)
export const useOferta = () => useContext(Ctx)!

const CHAVE_SEM = 'oferta-eam-semestre'
const lerSem = () => { try { return localStorage.getItem(CHAVE_SEM) } catch { return null } }

function semestrePadrao(s: Semestre[]): string | null {
  const ord = [...s].sort((a, b) => b.id.localeCompare(a.id))
  return (ord.find((x) => x.situacao === 'planejamento') ?? ord[0])?.id ?? null
}

export function Provedor({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [eu, setEu] = useState<Docente | null>(null)
  const [dados, setDados] = useState<Dados>(vazio)
  const [semId, setSemId] = useState<string | null>(lerSem)
  const [editando, setEditando] = useState<TurmaNova | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; tom: 'ok' | 'erro'; n: number } | null>(null)

  const avisar = useCallback((texto: string, tom: 'ok' | 'erro' = 'ok') => setAviso({ texto, tom, n: Date.now() }), [])

  const recarregar = useCallback(async () => {
    const s = await api.sessao()
    setEmail(s?.email ?? null)
    setEu(s?.docente ?? null)
    const d = s?.docente ? await api.carregar() : vazio
    setDados(d)
    setSemId((atual) => (atual && d.semestres.some((x) => x.id === atual) ? atual : semestrePadrao(d.semestres)))
    setPronto(true)
  }, [])

  useEffect(() => {
    recarregar().catch((e) => { setPronto(true); avisar(String(e.message ?? e), 'erro') })
    return api.aoMudarSessao(() => { void recarregar() })
  }, [recarregar, avisar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), aviso.tom === 'erro' ? 8000 : 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const agir = useCallback(async (f: () => Promise<unknown>, ok?: string) => {
    try {
      await f()
      await recarregar()
      if (ok) avisar(ok)
      return true
    } catch (e) {
      avisar((e as Error).message, 'erro')
      return false
    }
  }, [recarregar, avisar])

  const valor = useMemo<Oferta>(() => {
    const semestre = dados.semestres.find((s) => s.id === semId) ?? null
    return {
      pronto, email, eu, dados, semestre,
      turmas: semestre ? dados.turmas.filter((t) => t.semestreId === semestre.id) : [],
      podeEditar: !!eu && !!semestre && (semestre.situacao === 'planejamento' || eu.admin),
      escolherSemestre(id) {
        setSemId(id)
        try { localStorage.setItem(CHAVE_SEM, id) } catch { /* sem armazenamento */ }
      },
      recarregar, agir, avisar, editando, editar: setEditando,
    }
  }, [pronto, email, eu, dados, semId, recarregar, agir, avisar, editando])

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="aviso-area" aria-live="polite">
        {aviso && <div key={aviso.n} className={`aviso aviso-${aviso.tom}`} role={aviso.tom === 'erro' ? 'alert' : 'status'}>{aviso.texto}</div>}
      </div>
    </Ctx.Provider>
  )
}

/** Rota a partir do hash: '#/grades/sala/LEA101' → ['grades', 'sala', 'LEA101'] */
export function useRota(): string[] {
  const ler = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
  const [rota, setRota] = useState(ler)
  useEffect(() => {
    const f = () => { setRota(ler()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return rota
}

export const ir = (caminho: string) => { location.hash = caminho }
