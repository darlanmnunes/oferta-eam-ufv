import { useEffect, useMemo, useState } from 'react'
import { useOferta } from '../contexto'
import { GradeSemanal, Legenda } from '../componentes/GradeSemanal'
import { CabecalhoImpressao, imprimir } from '../componentes/Impressao'
import { Vazio } from '../componentes/pecas'
import { api } from '../lib/api'
import { duracao, grupoSala, horarioTexto, nivelDe, nomeSemestre, ordenarTurmas, periodoDe } from '../lib/dominio'
import { enderecoDti } from '../lib/dti'
import type { Dados } from '../lib/tipos'

const vazio: Dados = { semestres: [], disciplinas: [], docentes: [], turmas: [] }
const NOME_SEM = (id: string) => `${id.endsWith('-1') ? '1º' : '2º'} semestre de ${id.slice(0, 4)}`

/** Página inicial aberta: o que qualquer visitante da página do curso pode consultar, sem login. */
export function Publica() {
  const { eu, avisar } = useOferta()
  const [dados, setDados] = useState<Dados | null>(null)
  const [sem, setSem] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [per, setPer] = useState<string>('')
  const [perGrade, setPerGrade] = useState<string>('')
  const [imprimindo, setImprimindo] = useState<'lea' | 'periodo' | null>(null)

  useEffect(() => {
    api.publica().then((d) => {
      setDados(d)
      setSem((atual) => atual ?? [...d.semestres].sort((a, b) => b.id.localeCompare(a.id))[0]?.id ?? null)
    }).catch((e) => { setDados(vazio); avisar(e.message, 'erro') })
  }, [avisar])

  const disc = useMemo(() => new Map((dados?.disciplinas ?? []).map((d) => [d.codigo, d])), [dados])
  const nomes = useMemo(() => new Map((dados?.docentes ?? []).map((d) => [d.id, d.nome])), [dados])
  const turmas = useMemo(() => (dados?.turmas ?? []).filter((t) => t.semestreId === sem).sort(ordenarTurmas), [dados, sem])
  const periodos = useMemo(() => [...new Set(turmas.map((t) => periodoDe(t, disc)).filter(Boolean) as number[])].sort((a, b) => a - b), [turmas, disc])
  const docentesGrade = useMemo(() => (dados?.docentes ?? []).map((d) => ({ id: d.id, apelido: d.apelido })), [dados])

  const chaveFiltro = (codigo: string) => {
    const t = turmas.find((x) => x.disciplina === codigo)!
    if (nivelDe(t, disc) === 'pos') return 'pos'
    const p = periodoDe(t, disc)
    if (p) return String(p)
    const vagas = turmas.filter((x) => x.disciplina === codigo).map((x) => x.vagasCursos ?? '').join(' ')
    return vagas && !/EAM\d/.test(vagas) ? 'servico' : 'outras'
  }
  const termo = busca.trim().toLowerCase()
  const codigos = [...new Set(turmas.map((t) => t.disciplina))]
    .filter((c) => (!per || chaveFiltro(c) === per) && (!termo || `${c} ${disc.get(c)?.nome ?? ''}`.toLowerCase().includes(termo)))
  const horasLea = turmas.reduce((s, t) => s + t.horarios.filter((h) => h.dia && h.sala && grupoSala(h.sala) === 'LEA').reduce((x, h) => x + duracao(h), 0), 0)
  const nDoc = new Set(turmas.flatMap((t) => t.docentes)).size
  const perEscolhido = perGrade || String(periodos[0] ?? '')
  const filtroLea = (_: unknown, h: { sala: string | null }) => !!h.sala && grupoSala(h.sala) === 'LEA'

  const imprimirSecao = (s: 'lea' | 'periodo') => {
    setImprimindo(s)
    imprimir()
    setTimeout(() => setImprimindo(null), 1500)
  }

  return (
    <div className={`publica${imprimindo ? ` imprime-so-${imprimindo}` : ''}`}>
      <header className="pub-topo nao-imprime">
        <a className="pub-marca" href="#/inicio" aria-label="Página inicial">
          <img src="./marca/selo.png" alt="" width="42" height="42" />
          <span><b>Oferta de disciplinas</b><small>Engenharia de Agrimensura e Cartográfica | UFV</small></span>
        </a>
        <nav aria-label="Seções da página" className="pub-nav">
          {([['disciplinas', 'Disciplinas'], ['semana', 'Semana por período'], ['lea', 'Horário do LEA'], ['como', 'Como é planejada']] as const).map(([id, n]) => (
            <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>{n}</button>
          ))}
        </nav>
        <a className="btn btn-ouro" href={eu ? '#/' : '#/entrar'}>{eu ? 'Abrir o painel' : 'Área dos docentes'}</a>
      </header>

      <section className="pub-capa nao-imprime">
        <svg className="pub-malha" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: 13 }, (_, i) => <path key={`v${i}`} d={`M ${i * 66 + 10} 0 Q ${i * 66 + 40} 150 ${i * 66 + 10} 300`} />)}
          {Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M 0 ${i * 55 + 20} Q 400 ${i * 55 - 10} 800 ${i * 55 + 20}`} />)}
        </svg>
        <div className="pub-capa-dentro">
          <p className="sobre">{sem ? NOME_SEM(sem) : 'Oferta do curso'}</p>
          <h1>Disciplinas, horários e salas do curso</h1>
          <p className="pub-capa-texto">Consulte as turmas ofertadas pelo setor de Engenharia de Agrimensura e Cartográfica: dias, horários, salas e docentes, a semana de cada período e a ocupação do LEA.</p>
          {dados && dados.semestres.length > 1 && (
            <div className="pub-semestres" role="tablist" aria-label="Semestre">
              {[...dados.semestres].sort((a, b) => b.id.localeCompare(a.id)).map((s) => (
                <button key={s.id} role="tab" aria-selected={s.id === sem} onClick={() => setSem(s.id)}>{nomeSemestre(s.id)}</button>
              ))}
            </div>
          )}
          {turmas.length > 0 && (
            <dl className="pub-numeros">
              <div><dt>Disciplinas</dt><dd>{new Set(turmas.map((t) => t.disciplina)).size}</dd></div>
              <div><dt>Turmas</dt><dd>{turmas.length}</dd></div>
              <div><dt>Docentes</dt><dd>{nDoc}</dd></div>
              <div><dt>Horas de aula no LEA</dt><dd>{Math.round(horasLea)}<small> h/sem</small></dd></div>
            </dl>
          )}
        </div>
      </section>

      <main className="pub-corpo" id="conteudo">
        {dados === null ? <p className="carregando">Carregando a oferta…</p> : !sem ? (
          <Vazio titulo="Nenhum semestre publicado ainda">A oferta aparece aqui quando a coordenação publicar o semestre.</Vazio>
        ) : (
          <>
            <section id="disciplinas" className="pub-secao nao-imprime" aria-labelledby="t-disc">
              <div className="pub-secao-cab">
                <h2 id="t-disc">Disciplinas ofertadas</h2>
                <div className="filtros">
                  <input type="search" className="busca" placeholder="Buscar por código ou nome" aria-label="Buscar disciplina" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  <select aria-label="Período" value={per} onChange={(e) => setPer(e.target.value)}>
                    <option value="">Todos os períodos</option>
                    {periodos.map((p) => <option key={p} value={String(p)}>{p}º período</option>)}
                    <option value="outras">Sem período fixo</option>
                    <option value="servico">Para outros cursos</option>
                    <option value="pos">Pós-graduação</option>
                  </select>
                </div>
              </div>
              {codigos.length === 0 ? <Vazio titulo="Nenhuma disciplina com esses filtros" /> : (
                <ul className="pub-disciplinas">
                  {codigos.map((c) => {
                    const d = disc.get(c)
                    const ts = turmas.filter((t) => t.disciplina === c)
                    const p = chaveFiltro(c)
                    return (
                      <li key={c} className="pub-disc">
                        <header>
                          <span className="mono pub-cod">{c}</span>
                          <span className="pub-per">{p === 'pos' ? 'Pós-graduação' : p === 'outras' ? 'Sem período fixo' : p === 'servico' ? 'Para outros cursos' : `${p}º período`}</span>
                        </header>
                        <h3>{d?.nome ?? c}</h3>
                        {d && <p className="pub-cred">{d.credT + d.credP} créditos ({d.credT} teóricos, {d.credP} práticos)</p>}
                        <table className="pub-turmas">
                          <caption className="so-leitor">Turmas de {c}</caption>
                          <tbody>
                            {ts.map((t) => (
                              <tr key={t.id}>
                                <th scope="row">{t.tipo}{t.numero}</th>
                                <td>{t.horarios.map((h, i) => <span key={i} className="horario">{horarioTexto(h)}{h.sala ? ` | ${h.sala}` : ''}</span>)}</td>
                                <td className="pub-prof">{t.docentes.map((x) => nomes.get(x)).filter(Boolean).join(', ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {periodos.length > 0 && (
              <section id="semana" className="pub-secao secao-periodo" aria-labelledby="t-semana">
                <CabecalhoImpressao titulo={`Horário do ${perEscolhido}º período`} semestre={sem} />
                <div className="pub-secao-cab nao-imprime">
                  <h2 id="t-semana">A semana de cada período</h2>
                  <div className="filtros">
                    <select aria-label="Período" value={perEscolhido} onChange={(e) => setPerGrade(e.target.value)}>
                      {periodos.map((p) => <option key={p} value={String(p)}>{p}º período</option>)}
                    </select>
                    <button className="btn btn-claro" onClick={() => imprimirSecao('periodo')}>Imprimir</button>
                  </div>
                </div>
                <Legenda semEdicao />
                <GradeSemanal somenteLeitura docentes={docentesGrade} titulo={`${perEscolhido}º período`}
                  turmas={turmas.filter((t) => String(periodoDe(t, disc)) === perEscolhido)} />
              </section>
            )}

            <section id="lea" className="pub-secao secao-lea" aria-labelledby="t-lea">
              <CabecalhoImpressao titulo="Horário do LEA: todas as salas" semestre={sem} />
              <div className="pub-secao-cab nao-imprime">
                <div>
                  <h2 id="t-lea">Horário do LEA</h2>
                  <p className="dica">Aulas no Laboratório de Engenharia de Agrimensura e Cartográfica. Os horários livres podem ser usados para estudo e práticas, conforme as regras do laboratório.</p>
                </div>
                <button className="btn btn-claro" onClick={() => imprimirSecao('lea')}>Imprimir</button>
              </div>
              <Legenda semEdicao />
              <GradeSemanal somenteLeitura docentes={docentesGrade} titulo="Horário do LEA" filtro={filtroLea}
                turmas={turmas.filter((t) => t.horarios.some((h) => filtroLea(t, h)))} />
            </section>

            <section id="como" className="pub-secao nao-imprime" aria-labelledby="t-como">
              <h2 id="t-como">Como a oferta é planejada</h2>
              <ol className="pub-passos">
                <li><b>Semestre par ou ímpar</b><span>Parte das disciplinas é ofertada só no 1º semestre, parte só no 2º, e outras em todo semestre. Cada novo semestre começa pela oferta do mesmo semestre do ano anterior.</span></li>
                <li><b>Revisão pelo corpo docente</b><span>Os docentes do setor ajustam turmas, horários, salas e responsáveis, conferindo choques de horário e a carga de cada um.</span></li>
                <li><b>Horário oficial</b><span>Vale o horário do Registro Escolar (RES). <a href={enderecoDti(sem)} target="_blank" rel="noreferrer">Consulte o horário oficial de {nomeSemestre(sem)}</a>.</span></li>
              </ol>
            </section>
          </>
        )}
      </main>

      <footer className="rodape nao-imprime">
        <img src="./marca/ufv.png" alt="Universidade Federal de Viçosa" height="40" />
        <p>Engenharia de Agrimensura e Cartográfica | Departamento de Engenharia Civil | UFV<br /><span className="rodape-autor">Desenvolvido por Prof. Dr. Darlan Miranda Nunes</span></p>
        <img src="./marca/assinatura.png" alt="EAM | Engenharia de Agrimensura e Cartográfica" height="40" />
      </footer>
    </div>
  )
}
