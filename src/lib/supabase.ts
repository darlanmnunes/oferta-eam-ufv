import { createClient } from '@supabase/supabase-js'
import type { Api, Dados, Disciplina, Docente, Evento, Horario, Semestre, Turma } from './tipos'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function criarApiSupabase(url: string, chave: string): Api {
  const sb = createClient(url, chave, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } })

  const ok = <T,>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message)
    return r.data
  }
  const rpc = async <T = unknown,>(fn: string, args: Record<string, unknown> = {}) => ok(await sb.rpc(fn, args)) as T

  const docente = (d: any): Docente => ({
    id: d.id, nome: d.nome, apelido: d.apelido, chMinima: Number(d.ch_minima ?? 8), situacao: d.situacao, ativo: d.situacao === 'ativo', admin: !!d.admin,
  })
  const hora = (t: string | null) => (t ? t.slice(0, 5) : null)
  const semestre = (x: any): Semestre => ({ id: x.id, ano: x.ano, semestre: x.semestre, situacao: x.situacao, origem: x.origem ?? null, publicado: !!x.publicado })
  const disciplina = (x: any): Disciplina => ({
    codigo: x.codigo, nome: x.nome, credT: x.cred_t, credP: x.cred_p, nivel: x.nivel,
    periodicidade: x.periodicidade, periodo: x.periodo, ativa: x.ativa ?? true, obs: x.obs ?? null,
  })
  const turma = (x: any, tds: any[]): Turma => ({
    id: x.id, semestreId: x.semestre_id, disciplina: x.disciplina_codigo, tipo: x.tipo, numero: x.numero,
    vagas: x.vagas, vagasCursos: x.vagas_cursos, obs: x.obs ?? null,
    docentes: (tds ?? []).map((y: any) => y.docente_id ?? y.id),
    horasDocentes: Object.fromEntries((tds ?? []).filter((y: any) => y.horas != null).map((y: any) => [y.docente_id ?? y.id, Number(y.horas)])),
    horarios: (x.horarios ?? []).map((h: any): Horario => ({ dia: h.dia, inicio: hora(h.inicio), fim: hora(h.fim), sala: h.sala }))
      .sort((a: Horario, b: Horario) => (a.dia ?? 9) - (b.dia ?? 9) || (a.inicio ?? '').localeCompare(b.inicio ?? '')),
    atualizadoEm: x.atualizado_em ?? null, atualizadoPor: x.atualizado_por ?? null,
  })

  return {
    modo: 'supabase',

    async sessao() {
      const { data } = await sb.auth.getSession()
      if (!data.session) return null
      const d = await rpc<any>('entrar')
      return { email: data.session.user.email ?? '', docente: d?.id ? docente(d) : null }
    },
    async entrar() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: location.origin + location.pathname,
          queryParams: { hd: 'ufv.br', prompt: 'select_account' },
        },
      })
      if (error) throw new Error(error.message)
    },
    async sair() { await sb.auth.signOut() },
    aoMudarSessao(f) {
      const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') f() })
      return () => data.subscription.unsubscribe()
    },
    personas: () => [],

    async carregar(): Promise<Dados> {
      const [s, d, p, t] = await Promise.all([
        sb.from('semestres').select('id, ano, semestre, situacao, origem, publicado').order('id'),
        sb.from('disciplinas').select('*').order('codigo'),
        sb.from('docentes').select('id, nome, apelido, ch_minima, situacao, admin').order('apelido'),
        sb.from('turmas').select('*, turma_docentes(docente_id, horas), horarios(dia, inicio, fim, sala)').order('semestre_id').limit(5000),
      ])
      const docentes = (ok(p) as any[]).map(docente)
      if (docentes.length) {
        // só o administrador recebe e-mails; para os demais a função devolve vazio
        const contatos = await rpc<any[]>('docentes_contato').catch(() => [])
        for (const c of contatos ?? []) {
          const x = docentes.find((y) => y.id === c.id)
          if (x) Object.assign(x, { email: c.email, ligado: c.ligado })
        }
      }
      return {
        semestres: (ok(s) as any[]).map(semestre),
        disciplinas: (ok(d) as any[]).map(disciplina),
        docentes,
        turmas: (ok(t) as any[]).map((x) => turma(x, x.turma_docentes)),
      }
    },
    async historico(limite = 300) {
      const r = await sb.from('historico').select('id, quando, autor_nome, semestre_id, acao, resumo').order('id', { ascending: false }).limit(limite)
      return (ok(r) as any[]).map((x): Evento => ({ id: x.id, quando: x.quando, autor: x.autor_nome, semestreId: x.semestre_id, acao: x.acao, resumo: x.resumo }))
    },

    salvarTurma: (t) => rpc<string>('salvar_turma', {
      p: {
        id: t.id ?? null, semestre_id: t.semestreId, disciplina_codigo: t.disciplina, tipo: t.tipo, numero: t.numero,
        vagas: t.vagas, vagas_cursos: t.vagasCursos, obs: t.obs, horarios: t.horarios,
        docentes: t.docentes.map((id) => ({ id, horas: t.horasDocentes[id] ?? null })),
      },
    }),
    excluirTurma: async (id) => { await rpc('excluir_turma', { p_id: id }) },
    copiarDisciplina: (semestre, codigo, origem) => rpc<number>('copiar_disciplina', { p_semestre: semestre, p_codigo: codigo, p_origem: origem }),
    retirarDisciplina: (semestre, codigo) => rpc<number>('retirar_disciplina', { p_semestre: semestre, p_codigo: codigo }),
    salvarDisciplina: async (d) => {
      await rpc('salvar_disciplina', {
        p: { codigo: d.codigo, nome: d.nome, cred_t: d.credT, cred_p: d.credP, nivel: d.nivel, periodicidade: d.periodicidade, periodo: d.periodo, ativa: d.ativa, obs: d.obs },
      })
    },
    excluirDisciplina: async (codigo) => { await rpc('excluir_disciplina', { p_codigo: codigo }) },
    criarSemestre: (ano, semestre, origem) => rpc<string>('criar_semestre', { p_ano: ano, p_semestre: semestre, p_origem: origem }),
    definirSituacao: async (id, s) => { await rpc('definir_situacao', { p_id: id, p_situacao: s }) },
    excluirSemestre: async (id, confirmacao) => { await rpc('excluir_semestre', { p_id: id, p_confirmacao: confirmacao }) },
    salvarDocente: async (d) => {
      await rpc('salvar_docente', {
        p: { id: d.id ?? null, nome: d.nome, apelido: d.apelido, email: d.email ?? null, ch_minima: d.chMinima ?? 8, situacao: d.situacao ?? 'ativo', admin: d.admin ?? false },
      })
    },
    definirPublicacao: async (id, publicado) => { await rpc('definir_publicacao', { p_id: id, p_publicado: publicado }) },
    async publica() {
      const x = await rpc<any>('oferta_publica')
      return {
        semestres: (x.semestres ?? []).map(semestre),
        disciplinas: (x.disciplinas ?? []).map(disciplina),
        docentes: (x.docentes ?? []).map(docente),
        turmas: (x.turmas ?? []).map((t: any) => turma(t, t.docentes)),
      }
    },
  }
}
