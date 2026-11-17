import { useMemo, useState } from 'react'
import { useOferta } from '../contexto'
import { Cabecalho, Vazio } from '../componentes/pecas'
import { novaTurma } from '../componentes/EditorTurma'
import { Rosca, type Fatia } from '../componentes/Rosca'
import {
  DIAS, DIAS_CURTOS, NOME_SITUACAO, NOME_SITUACAO_SEMESTRE, NOME_TIPO, cargas, conflitos, duracao, fmtHoras, grupoSala, horasTurma, minutos, nivelDe,
  nomeSemestre, pendencias, revisao, rotulo,
} from '../lib/dominio'
import type { Turma } from '../lib/tipos'

type Local = 'LEA' | 'CCE' | 'PV' | 'Outras' | 'combinar'
interface Filtros { nivel: string | null; tipo: string | null; docente: string | null; local: Local | null }
const SEM_FILTRO: Filtros = { nivel: null, tipo: null, docente: null, local: null }
const NOME_LOCAL: Record<Local, string> = { LEA: 'LEA', CCE: 'CCE', PV: 'PVA/PVB', Outras: 'Outras salas', combinar: 'A combinar' }
const localDe = (sala: string | null, dia: number | null): Local => (!dia ? 'combinar' : sala ? grupoSala(sala) : 'Outras')

const COR = { azul: '#2c4a8f', ouro: '#e0a417', bordo: '#8a191b', verde: '#2f7a4f', cinza: '#9aa0ae', azulClaro: '#8aa3d6' }

export function Painel() {
  const { dados, semestre, turmas, editar, podeEditar } = useOferta()
  const [f, setF] = useState<Filtros>(SEM_FILTRO)
  const [celula, setCelula] = useState<string | null>(null)
  const disc = useMemo(() => new Map(dados.disciplinas.map((d) => [d.codigo, d])), [dados.disciplinas])
  const nomes = useMemo(() => new Map(dados.docentes.map((d) => [d.id, d.apelido])), [dados.docentes])

  const alternar = (k: keyof Filtros, v: string) => { setCelula(null); setF((x) => ({ ...x, [k]: x[k] === v ? null : v })) }
  const filtradas = useMemo(() => turmas.filter((t) =>
    (!f.nivel || nivelDe(t, disc) === f.nivel) && (!f.tipo || t.tipo === f.tipo) && (!f.docente || t.docentes.includes(f.docente)) &&
    (!f.local || t.horarios.some((h) => localDe(h.sala, h.dia) === f.local))), [turmas, f, disc])
  const conf = useMemo(() => conflitos(dados, filtradas), [dados, filtradas])
  const pend = useMemo(() => pendencias(dados, filtradas), [dados, filtradas])
  const carg = useMemo(() => cargas(dados, filtradas).filter((c) => !f.docente || c.docente.id === f.docente || c.turmas.length), [dados, filtradas, f.docente])
  const rev = useMemo(() => (semestre ? revisao(dados, semestre.id) : null), [dados, semestre])

  if (!semestre) return <main className="pagina"><Vazio titulo="Nenhum semestre cadastrado">Crie o primeiro semestre na tela Semestres.</Vazio></main>

  const horas = filtradas.reduce((s, t) => s + horasTurma(t), 0)
  const horasPos = filtradas.filter((t) => nivelDe(t, disc) === 'pos').reduce((s, t) => s + horasTurma(t), 0)
  const nDisc = new Set(filtradas.map((t) => t.disciplina)).size
  const comTurma = carg.filter((c) => c.turmas.length).length
  const abaixo = carg.filter((c) => c.docente.ativo && c.situacao === 'abaixo').length
  const maxCarga = Math.max(16, ...carg.map((c) => c.total))
  const algum = Object.values(f).some(Boolean)

  // ---- roscas ----
  const porTipo = (tp: string) => filtradas.filter((t) => t.tipo === tp).length
  const porLocal = (l: Local) => filtradas.reduce((s, t) => s + t.horarios.filter((h) => localDe(h.sala, h.dia) === l).reduce((x, h) => x + duracao(h), 0), 0)
  const fNivel: Fatia[] = [
    { chave: 'grad', rotulo: 'Graduação', valor: horas - horasPos, cor: COR.azul },
    { chave: 'pos', rotulo: 'Pós-graduação', valor: horasPos, cor: COR.ouro },
  ]
  const fTipo: Fatia[] = [
    { chave: 'T', rotulo: NOME_TIPO.T, valor: porTipo('T'), cor: COR.azul },
    { chave: 'P', rotulo: NOME_TIPO.P, valor: porTipo('P'), cor: COR.ouro },
    { chave: 'TP', rotulo: 'Teórica e prática', valor: porTipo('TP'), cor: COR.bordo },
  ]
  const fLocal: Fatia[] = (['LEA', 'CCE', 'PV', 'Outras', 'combinar'] as Local[]).map((l, i) => ({
    chave: l, rotulo: NOME_LOCAL[l], valor: porLocal(l), cor: [COR.verde, COR.azul, COR.ouro, COR.azulClaro, COR.cinza][i],
  }))
  const fCarga: Fatia[] = (['abaixo', 'ok', 'elevada', 'verificar'] as const).map((s, i) => ({
    chave: s, rotulo: NOME_SITUACAO[s], valor: carg.filter((c) => c.docente.ativo && c.situacao === s).length, cor: [COR.bordo, COR.verde, COR.ouro, '#5a0204'][i],
  }))

  // ---- mapa de aulas simultâneas, com as turmas em cada hora ----
  const horasGrade = Array.from({ length: 16 }, (_, i) => 7 + i)
  const mapa = new Map<string, { t: Turma; sala: string | null }[]>()
  for (const t of filtradas) for (const h of t.horarios) {
    if (!h.dia || !h.inicio || !h.fim || h.dia > 6) continue
    for (const hr of horasGrade) {
      if (minutos(h.inicio) < (hr + 1) * 60 && minutos(h.fim) > hr * 60) {
        const k = `${h.dia}|${hr}`
        if (!mapa.has(k)) mapa.set(k, [])
        mapa.get(k)!.push({ t, sala: h.sala })
      }
    }
  }
  const maxCont = Math.max(1, ...[...mapa.values()].map((l) => l.length))
  const horasVisiveis = horasGrade.filter((hr) => (hr >= 8 && hr < 18) || [2, 3, 4, 5, 6].some((d) => mapa.has(`${d}|${hr}`)))
  const sel = celula ? mapa.get(celula) ?? [] : []

  const chips: [keyof Filtros, string][] = []
  if (f.nivel) chips.push(['nivel', f.nivel === 'pos' ? 'Pós-graduação' : 'Graduação'])
  if (f.tipo) chips.push(['tipo', NOME_TIPO[f.tipo as 'T']])
  if (f.local) chips.push(['local', NOME_LOCAL[f.local]])
  if (f.docente) chips.push(['docente', nomes.get(f.docente) ?? ''])

  return (
    <main className="pagina">
      <Cabecalho sobre="Painel" titulo={`Oferta ${nomeSemestre(semestre.id)}`}
        texto={<>{NOME_SITUACAO_SEMESTRE[semestre.situacao]}{rev?.ref && <> | comparado com {nomeSemestre(rev.ref.id)}</>}</>}>
        {podeEditar && <button className="btn" onClick={() => editar(novaTurma(semestre.id))}>Nova turma</button>}
      </Cabecalho>

      <div className="segmentacao" role="group" aria-label="Filtros do painel">
        <span className="segmentacao-rotulo">Filtrar</span>
        <select aria-label="Nível" value={f.nivel ?? ''} onChange={(e) => setF({ ...f, nivel: e.target.value || null })}>
          <option value="">Todos os níveis</option><option value="grad">Graduação</option><option value="pos">Pós-graduação</option>
        </select>
        <select aria-label="Tipo de aula" value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value || null })}>
          <option value="">Todos os tipos</option><option value="T">Teórica</option><option value="P">Prática</option><option value="TP">Teórica e prática</option>
        </select>
        <select aria-label="Local" value={f.local ?? ''} onChange={(e) => setF({ ...f, local: (e.target.value || null) as Local | null })}>
          <option value="">Todos os locais</option>{(Object.keys(NOME_LOCAL) as Local[]).map((l) => <option key={l} value={l}>{NOME_LOCAL[l]}</option>)}
        </select>
        <select aria-label="Docente" value={f.docente ?? ''} onChange={(e) => setF({ ...f, docente: e.target.value || null })}>
          <option value="">Todos os docentes</option>
          {dados.docentes.filter((d) => turmas.some((t) => t.docentes.includes(d.id))).map((d) => <option key={d.id} value={d.id}>{d.apelido}</option>)}
        </select>
        {chips.map(([k, n]) => <button key={k} className="chip" onClick={() => setF({ ...f, [k]: null })} aria-label={`Tirar o filtro ${n}`}>{n} <span aria-hidden="true">×</span></button>)}
        {algum && <button className="btn-texto" onClick={() => setF(SEM_FILTRO)}>Limpar filtros</button>}
      </div>

      <section className="numeros" aria-label="Resumo">
        <a className="numero" href="#/oferta"><span className="numero-rotulo">Turmas</span><b>{filtradas.length}</b><span className="numero-nota">{nDisc} disciplinas</span></a>
        <a className="numero" href="#/docentes"><span className="numero-rotulo">Horas-aula por semana</span><b>{fmtHoras(horas)}</b><span className="numero-nota">{fmtHoras(horas - horasPos)} grad | {fmtHoras(horasPos)} pós</span></a>
        <a className="numero" href="#/docentes"><span className="numero-rotulo">Docentes com turma</span><b>{comTurma}</b><span className={`numero-nota${abaixo ? ' ruim' : ''}`}>{abaixo ? `${abaixo} abaixo do mínimo` : 'todos no mínimo'}</span></a>
        <a className={`numero${conf.length ? ' numero-alerta' : ''}`} href="#/conferencia"><span className="numero-rotulo">Conflitos de horário</span><b>{conf.length}</b>
          <span className="numero-nota">{conf.filter((c) => c.tipo === 'docente').length} docente | {conf.filter((c) => c.tipo === 'sala').length} sala | {conf.filter((c) => c.tipo === 'periodo').length} período</span></a>
        <a className={`numero${pend.length ? ' numero-aviso' : ''}`} href="#/conferencia"><span className="numero-rotulo">Pendências</span><b>{pend.length}</b>
          <span className="numero-nota">{pend.filter((p) => p.motivo === 'Sem docente').length} turmas sem docente</span></a>
      </section>

      <div className="roscas">
        <Rosca titulo="Horas por nível" fatias={fNivel} unidade="h/sem" ativo={f.nivel} aoClicar={(k) => alternar('nivel', k)} />
        <Rosca titulo="Turmas por tipo" fatias={fTipo} unidade="turmas" ativo={f.tipo} aoClicar={(k) => alternar('tipo', k)} />
        <Rosca titulo="Horas por local" fatias={fLocal} unidade="h/sem" ativo={f.local} aoClicar={(k) => alternar('local', k)} />
        <Rosca titulo="Carga dos docentes" fatias={fCarga} unidade="docentes" />
      </div>

      <div className="painel-duplo">
        <section className="cartao" aria-labelledby="t-carga">
          <header className="cartao-cab">
            <h2 id="t-carga">Carga semanal por docente</h2>
            <p className="legenda-mini"><span><i className="amostra amostra-grad" /> Graduação</span><span><i className="amostra amostra-pos" /> Pós</span><span><i className="amostra-linha" /> Mínimo</span></p>
          </header>
          {carg.length === 0 ? <Vazio titulo="Nenhum docente com turma nestes filtros" /> : (
            <ul className="barras">
              {carg.map((c) => (
                <li key={c.docente.id} className={f.docente && f.docente !== c.docente.id ? 'apagada' : ''}>
                  <button className="barra-linha" onClick={() => alternar('docente', c.docente.id)} aria-pressed={f.docente === c.docente.id}
                    aria-label={`${c.docente.apelido}: ${fmtHoras(c.total)} horas por semana, ${NOME_SITUACAO[c.situacao]}. Filtrar o painel por este docente.`}>
                    <span className="barra-nome">{c.docente.apelido}</span>
                    <span className="barra-trilho">
                      <span className="barra barra-grad" style={{ width: `${(c.grad / maxCarga) * 100}%` }} />
                      <span className="barra barra-pos" style={{ width: `${(c.pos / maxCarga) * 100}%` }} />
                      <span className="barra-minimo" style={{ left: `${(c.docente.chMinima / maxCarga) * 100}%` }} />
                    </span>
                    <span className={`barra-valor sit-${c.situacao}`}>{fmtHoras(c.total)} h</span>
                  </button>
                  <a className="barra-ver" href={`#/docentes/${c.docente.id}`} aria-label={`Ver turmas de ${c.docente.apelido}`}>ver</a>
                </li>
              ))}
            </ul>
          )}
          <p className="dica">Clique num docente para filtrar o painel inteiro.</p>
        </section>

        <div className="pilha">
          <section className="cartao" aria-labelledby="t-mudou">
            <header className="cartao-cab"><h2 id="t-mudou">Em relação a {rev?.ref ? nomeSemestre(rev.ref.id) : 'o semestre anterior'}</h2></header>
            {!rev?.ref ? <p className="dica">Sem semestre anterior para comparar.</p> : (
              <>
                <p className="mudou"><b>Entraram</b> {rev.entraram.length ? rev.entraram.map((c) => <span key={c} className="etiqueta etiqueta-mais" title={disc.get(c)?.nome}>{c}</span>) : <span className="dica">nenhuma</span>}</p>
                <p className="mudou"><b>Saíram</b> {rev.sairam.length ? rev.sairam.map((c) => <span key={c} className="etiqueta etiqueta-menos" title={disc.get(c)?.nome}>{c}</span>) : <span className="dica">nenhuma</span>}</p>
                {(rev.faltando.length > 0 || rev.foraDoPadrao.length > 0) && (
                  <p className="dica"><a href="#/conferencia">{rev.faltando.length} esperada{rev.faltando.length === 1 ? '' : 's'} fora da oferta | {rev.foraDoPadrao.length} fora da periodicidade</a></p>
                )}
              </>
            )}
          </section>
          <section className="cartao" aria-labelledby="t-conf">
            <header className="cartao-cab"><h2 id="t-conf">Conflitos</h2>{conf.length > 4 && <a href="#/conferencia">Ver todos</a>}</header>
            {conf.length === 0 ? <p className="tudo-certo">Nenhum choque de sala, docente ou período.</p> : (
              <ul className="lista-curta">
                {conf.slice(0, 4).map((c, i) => (
                  <li key={i}>
                    <span className={`etiqueta etiqueta-${c.tipo}`}>{c.tipo === 'sala' ? 'Sala' : c.tipo === 'docente' ? 'Docente' : 'Período'}</span>
                    <span>{c.alvo}, {DIAS_CURTOS[c.dia]} {c.inicio}: {c.turmas.map((t, k) => <button key={k} className="link" onClick={() => editar(t)}>{rotulo(t)}</button>)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="cartao" aria-labelledby="t-pend">
            <header className="cartao-cab"><h2 id="t-pend">Pendências</h2>{pend.length > 4 && <a href="#/conferencia">Ver todas</a>}</header>
            {pend.length === 0 ? <p className="tudo-certo">Toda turma tem docente, horário e sala.</p> : (
              <ul className="lista-curta">
                {pend.slice(0, 4).map((p, i) => <li key={i}><span className="etiqueta">{p.motivo}</span><button className="link" onClick={() => editar(p.turma)}>{rotulo(p.turma)}</button></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="cartao" aria-labelledby="t-mapa">
        <header className="cartao-cab">
          <h2 id="t-mapa">Aulas acontecendo ao mesmo tempo</h2>
          <p className="dica">Disciplina e turma em cada hora (300 P3 = EAM 300, prática 3). Mais escuro: mais aulas juntas. Clique para ver detalhes.</p>
        </header>
        <div className="calor-rolagem">
          <table className="calor">
            <caption className="so-leitor">Turmas em aula em cada hora da semana</caption>
            <thead><tr><th scope="col"><span className="so-leitor">Hora</span></th>{[2, 3, 4, 5, 6].map((d) => <th key={d} scope="col">{DIAS[d]}</th>)}</tr></thead>
            <tbody>
              {horasVisiveis.map((hr) => (
                <tr key={hr}>
                  <th scope="row">{String(hr).padStart(2, '0')}h</th>
                  {[2, 3, 4, 5, 6].map((d) => {
                    const k = `${d}|${hr}`
                    const l = mapa.get(k) ?? []
                    const q = l.length / maxCont
                    return (
                      <td key={d} style={{ ['--q' as string]: q }} className={`${l.length ? 'cheio' : ''}${q > 0.55 ? ' escuro' : ''}${celula === k ? ' marcada' : ''}`}>
                        {l.length > 0 && (
                          <button onClick={() => setCelula(celula === k ? null : k)} aria-label={`${DIAS[d]} ${hr}h: ${l.length} aulas. Ver detalhes.`}>
                            <span className="calor-n">{l.length}</span>
                            <span className="calor-cods">{l.map(({ t }) => `${t.disciplina.slice(4)} ${t.tipo}${t.numero}`).join(' | ')}</span>
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {celula && (
          <div className="calor-detalhe" role="region" aria-live="polite" aria-label="Aulas no horário escolhido">
            <h3>{DIAS[Number(celula.split('|')[0])]}, {celula.split('|')[1]}h às {Number(celula.split('|')[1]) + 1}h</h3>
            <ul>
              {sel.map(({ t, sala }, i) => (
                <li key={i}>
                  <button className="link forte" onClick={() => editar(t)}>{rotulo(t)}</button> {disc.get(t.disciplina)?.nome}
                  <span className="mono"> | {sala ?? 'sem sala'}</span> | {t.docentes.map((d) => nomes.get(d)).join(', ') || 'sem docente'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  )
}
