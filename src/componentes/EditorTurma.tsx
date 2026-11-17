import { useEffect, useMemo, useState } from 'react'
import { useOferta } from '../contexto'
import { api } from '../lib/api'
import { DIAS, NOME_TIPO, conflitos, fmtHoras, horasPorDocente, horasTurma, nomeSemestre, rotulo } from '../lib/dominio'
import type { Horario, Tipo, TurmaNova } from '../lib/tipos'
import { Campo, Confirmar, Gaveta } from './pecas'

const HORAS = Array.from({ length: 33 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const vazioH = (): Horario => ({ dia: 2, inicio: '08:00', fim: '10:00', sala: '' })

export function EditorTurma() {
  const { editando, editar, dados, semestre, agir, eu } = useOferta()
  const [t, setT] = useState<TurmaNova | null>(editando)
  const [excluir, setExcluir] = useState(false)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { setT(editando); setExcluir(false) }, [editando])

  const sem = dados.semestres.find((s) => s.id === (t?.semestreId ?? semestre?.id))
  const somenteLeitura = !sem || (sem.situacao === 'encerrado' && !eu?.admin)
  const salas = useMemo(() => [...new Set(dados.turmas.flatMap((x) => x.horarios.map((h) => h.sala)).filter(Boolean) as string[])].sort(), [dados.turmas])
  const ativos = dados.docentes.filter((d) => d.ativo || t?.docentes.includes(d.id))
  const discs = dados.disciplinas.filter((d) => d.ativa || d.codigo === t?.disciplina)

  const avisos = useMemo(() => {
    if (!t || !t.disciplina) return []
    const outras = dados.turmas.filter((x) => x.semestreId === t.semestreId && x.id !== t.id)
    const esta = { ...t, id: t.id ?? '__nova', atualizadoEm: null, atualizadoPor: null }
    return conflitos(dados, [...outras, esta]).filter((c) => c.turmas.some((x) => x.id === esta.id))
  }, [t, dados])

  if (!t) return <Gaveta aberta={false} titulo="" aoFechar={() => editar(null)}>{null}</Gaveta>

  const mudar = (p: Partial<TurmaNova>) => setT({ ...t, ...p })
  const mudarH = (i: number, p: Partial<Horario>) => mudar({ horarios: t.horarios.map((h, k) => (k === i ? { ...h, ...p } : h)) })
  const nova = !t.id
  const titulo = nova ? 'Nova turma' : rotulo(t as never)

  const salvar = async () => {
    if (!t.disciplina) return
    setSalvando(true)
    const ok = await agir(() => api.salvarTurma({ ...t, horarios: t.horarios.map((h) => ({ ...h, sala: h.dia ? h.sala || null : null })) }), nova ? 'Turma criada.' : 'Turma salva.')
    setSalvando(false)
    if (ok) editar(null)
  }

  return (
    <>
      <Gaveta
        aberta
        titulo={titulo}
        sobre={`${sem ? nomeSemestre(sem.id) : ''}${t.disciplina && !nova ? ` | ${dados.disciplinas.find((d) => d.codigo === t.disciplina)?.nome ?? ''}` : ''}`}
        aoFechar={() => editar(null)}
        pe={somenteLeitura ? <p className="dica">Semestre encerrado: só o administrador pode alterar.</p> : (
          <>
            {!nova && <button className="btn-texto perigo" onClick={() => setExcluir(true)}>Excluir turma</button>}
            {!nova && <button className="btn btn-claro" onClick={() => {
              const prox = Math.max(0, ...dados.turmas.filter((x) => x.semestreId === t.semestreId && x.disciplina === t.disciplina && x.tipo === t.tipo).map((x) => x.numero)) + 1
              setT({ ...t, id: undefined, numero: prox })
            }}>Duplicar</button>}
            <button className="btn" disabled={!t.disciplina || salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          </>
        )}
      >
        <fieldset className="grade-campos" disabled={somenteLeitura}>
          <Campo rotulo="Disciplina" largo>
            <select value={t.disciplina} onChange={(e) => mudar({ disciplina: e.target.value })}>
              <option value="">Escolha a disciplina</option>
              {discs.map((d) => <option key={d.codigo} value={d.codigo}>{d.codigo} - {d.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <select value={t.tipo} onChange={(e) => mudar({ tipo: e.target.value as Tipo })}>
              {(Object.keys(NOME_TIPO) as Tipo[]).map((k) => <option key={k} value={k}>{k} - {NOME_TIPO[k]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Número da turma">
            <input type="number" min={1} max={99} value={t.numero} onChange={(e) => mudar({ numero: Number(e.target.value) || 1 })} />
          </Campo>

          <div className="campo campo-largo">
            <span className="campo-rotulo" id="rot-docentes">Docentes</span>
            <div className="fichas" role="group" aria-labelledby="rot-docentes">
              {ativos.map((d) => {
                const sel = t.docentes.includes(d.id)
                return (
                  <button key={d.id} type="button" className="ficha" aria-pressed={sel}
                    onClick={() => {
                      if (!sel) return mudar({ docentes: [...t.docentes, d.id] })
                      const { [d.id]: _, ...resto } = t.horasDocentes ?? {}
                      mudar({ docentes: t.docentes.filter((x) => x !== d.id), horasDocentes: resto })
                    }}>
                    {d.apelido}
                  </button>
                )
              })}
            </div>
            {t.docentes.length > 1 && (() => {
              const calc = horasPorDocente({ ...t, horasDocentes: t.horasDocentes ?? {} } as never)
              const soma = [...calc.values()].reduce((a, b) => a + b, 0)
              return (
                <div className="divisao">
                  <span className="campo-ajuda">Horas semanais de cada docente. Em branco, divide igualmente o que sobrar.</span>
                  {t.docentes.map((id) => (
                    <label key={id} className="divisao-linha">
                      <span>{dados.docentes.find((d) => d.id === id)?.apelido}</span>
                      <input type="number" min={0.5} step={0.5} placeholder={fmtHoras(calc.get(id) ?? 0)} value={t.horasDocentes?.[id] ?? ''}
                        onChange={(e) => {
                          const h = { ...(t.horasDocentes ?? {}) }
                          if (e.target.value === '') delete h[id]; else h[id] = Number(e.target.value)
                          mudar({ horasDocentes: h })
                        }} />
                      <small>h</small>
                    </label>
                  ))}
                  {Math.abs(soma - horasTurma(t as never)) > 0.01 && <span className="campo-msg">A soma ({fmtHoras(soma)} h) é diferente das horas da turma ({fmtHoras(horasTurma(t as never))} h).</span>}
                </div>
              )
            })()}
          </div>

          <div className="campo campo-largo">
            <span className="campo-rotulo">Horários <small className="mono">{fmtHoras(horasTurma(t as never))} h por semana</small></span>
            <div className="horarios">
              {t.horarios.map((h, i) => (
                <div key={i} className="horario-linha">
                  <select aria-label="Dia" value={h.dia ?? ''} onChange={(e) => mudarH(i, { dia: e.target.value ? Number(e.target.value) : null })}>
                    {Object.entries(DIAS).map(([n, nome]) => <option key={n} value={n}>{nome}</option>)}
                    <option value="">A combinar</option>
                  </select>
                  <select aria-label="Início" value={h.inicio ?? ''} onChange={(e) => mudarH(i, { inicio: e.target.value || null })}>
                    <option value="">--</option>
                    {[...new Set([...HORAS, h.inicio ?? ''])].filter(Boolean).sort().map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <select aria-label="Fim" value={h.fim ?? ''} onChange={(e) => mudarH(i, { fim: e.target.value || null })}>
                    <option value="">--</option>
                    {[...new Set([...HORAS, '23:00', h.fim ?? ''])].filter(Boolean).sort().map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <input aria-label="Sala" type="text" list="lista-salas" placeholder={h.dia ? 'Sala' : 'Sem sala'} disabled={!h.dia}
                    value={h.dia ? h.sala ?? '' : ''} onChange={(e) => mudarH(i, { sala: e.target.value.toUpperCase() })} />
                  <button type="button" className="fechar" aria-label="Remover horário" onClick={() => mudar({ horarios: t.horarios.filter((_, k) => k !== i) })}>
                    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
              <datalist id="lista-salas">{salas.map((s) => <option key={s} value={s} />)}</datalist>
              <button type="button" className="btn-texto" onClick={() => mudar({ horarios: [...t.horarios, vazioH()] })}>Adicionar horário</button>
            </div>
            <span className="campo-ajuda">"A combinar" conta na carga horária e fica fora das grades.</span>
          </div>

          {avisos.length > 0 && (
            <div className="campo-largo alerta-caixa" role="status">
              <b>{avisos.length === 1 ? 'Conflito' : `${avisos.length} conflitos`} com este horário</b>
              <ul>
                {avisos.map((c, i) => (
                  <li key={i}>{c.tipo === 'sala' ? 'Sala' : c.tipo === 'docente' ? 'Docente' : 'Estudantes do'} {c.alvo}, {DIAS[c.dia]} {c.inicio}-{c.fim}: {c.turmas.filter((x) => x.id !== (t.id ?? '__nova')).map((x) => rotulo(x)).join(', ')}</li>
                ))}
              </ul>
              <span className="campo-ajuda">Dá para salvar assim mesmo; o conflito aparece no painel até ser resolvido.</span>
            </div>
          )}

          <Campo rotulo="Vagas">
            <input type="number" min={0} value={t.vagas ?? ''} onChange={(e) => mudar({ vagas: e.target.value === '' ? null : Number(e.target.value) })} />
          </Campo>
          <Campo rotulo="Vagas por curso" ajuda="Como no RES: EAM4=20 GER0=10">
            <input type="text" className="mono" value={t.vagasCursos ?? ''} onChange={(e) => mudar({ vagasCursos: e.target.value || null })} />
          </Campo>
          <Campo rotulo="Observação" largo>
            <textarea rows={2} value={t.obs ?? ''} onChange={(e) => mudar({ obs: e.target.value || null })} />
          </Campo>
        </fieldset>
      </Gaveta>
      <Confirmar
        aberto={excluir}
        titulo={`Excluir ${titulo}?`}
        texto="A turma sai da oferta deste semestre. O registro fica no histórico."
        acao="Excluir turma"
        perigo
        aoFechar={() => setExcluir(false)}
        aoConfirmar={async () => { setExcluir(false); if (await agir(() => api.excluirTurma(t.id!), 'Turma excluída.')) editar(null) }}
      />
    </>
  )
}

export function novaTurma(semestreId: string, disciplina = ''): TurmaNova {
  return { semestreId, disciplina, tipo: 'T', numero: 1, vagas: null, vagasCursos: null, obs: null, docentes: [], horasDocentes: {}, horarios: [vazioH()] }
}
