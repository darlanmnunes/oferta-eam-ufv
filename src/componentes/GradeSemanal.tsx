import { useMemo } from 'react'
import { useOferta } from '../contexto'
import { DIAS, blocosDoDia, diasUsados, hhmm, janela, rotulo } from '../lib/dominio'
import type { Horario, Turma } from '../lib/tipos'

interface Props {
  turmas: Turma[]
  /** Mostra só alguns horários das turmas (por exemplo, os de uma sala). */
  filtro?: (t: Turma, h: Horario) => boolean
  conflitantes?: Set<string>
  mostrar?: { docente?: boolean; sala?: boolean }
  titulo: string
  /** Na página pública: sem edição ao clicar. */
  somenteLeitura?: boolean
  docentes?: { id: string; apelido: string }[]
}

const ALTURA_HORA = 52

export function GradeSemanal({ turmas, filtro, conflitantes, mostrar = { docente: true, sala: true }, titulo, somenteLeitura, docentes }: Props) {
  const { dados, editar: editarCtx } = useOferta()
  const lista = docentes ?? dados.docentes
  const nomes = useMemo(() => new Map(lista.map((d) => [d.id, d.apelido])), [lista])
  const editar = (t: Turma) => { if (!somenteLeitura) editarCtx(t) }
  const [ini, fim] = janela(turmas)
  const dias = diasUsados(turmas)
  const horas: number[] = []
  for (let m = ini; m < fim; m += 60) horas.push(m)
  const aCombinar = turmas.filter((t) => t.horarios.some((h) => !h.dia) && (!filtro || t.horarios.some((h) => !h.dia && filtro(t, h))))

  return (
    <figure className="grade" aria-label={titulo}>
      <div className="grade-rolagem">
        <div className="grade-tabela" style={{ gridTemplateColumns: `56px repeat(${dias.length}, minmax(124px, 1fr))` }}>
          <div className="grade-canto" />
          {dias.map((d) => <div key={d} className="grade-dia">{DIAS[d]}</div>)}
          <div className="grade-horas" style={{ height: horas.length * ALTURA_HORA }}>
            {horas.map((m) => <span key={m} style={{ top: (m - ini) / 60 * ALTURA_HORA }}>{hhmm(m)}</span>)}
          </div>
          {dias.map((d) => (
            <div key={d} className="grade-coluna" style={{ height: horas.length * ALTURA_HORA }}>
              {horas.map((m) => <span key={m} className={`grade-linha${m === 12 * 60 ? ' almoco' : ''}`} style={{ top: (m - ini) / 60 * ALTURA_HORA }} />)}
              {blocosDoDia(turmas, d, filtro).map((b, i) => {
                const conf = conflitantes?.has(b.t.id)
                const doc = b.t.docentes.map((x) => nomes.get(x)).filter(Boolean).join(', ')
                return (
                  <button
                    key={`${b.t.id}-${i}`}
                    className={`bloco bloco-${b.t.tipo}${conf ? ' bloco-conflito' : ''}${somenteLeitura ? ' bloco-leitura' : ''}`}
                    style={{
                      top: (b.a - ini) / 60 * ALTURA_HORA + 1,
                      height: (b.b - b.a) / 60 * ALTURA_HORA - 2,
                      left: `calc(${(b.faixa / b.faixas) * 100}% + 2px)`,
                      width: `calc(${100 / b.faixas}% - 4px)`,
                    }}
                    onClick={() => editar(b.t)}
                    aria-label={`${rotulo(b.t)}, ${DIAS[d]} ${b.h.inicio} às ${b.h.fim}${b.h.sala ? `, sala ${b.h.sala}` : ''}${doc ? `, ${doc}` : ''}${conf ? ', em conflito' : ''}`}
                    title={`${rotulo(b.t)} | ${b.h.inicio}-${b.h.fim}${b.h.sala ? ` | ${b.h.sala}` : ''}${doc ? ` | ${doc}` : ''}`}
                  >
                    <b>{b.t.disciplina.slice(4)} <em>{b.t.tipo}{b.t.numero}</em></b>
                    {mostrar.sala && b.h.sala && <span>{b.h.sala}</span>}
                    {mostrar.docente && doc && <span>{doc}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {aCombinar.length > 0 && (
        <figcaption className="grade-combinar">
          <b>A combinar:</b> {aCombinar.map((t) => (
            <button key={t.id} className="etiqueta etiqueta-botao" disabled={somenteLeitura} onClick={() => editar(t)}>{rotulo(t)}</button>
          ))}
        </figcaption>
      )}
    </figure>
  )
}

export function Legenda({ semEdicao }: { semEdicao?: boolean }) {
  return (
    <p className="legenda" aria-label="Legenda da grade">
      <span><i className="amostra amostra-T" /> Teórica</span>
      <span><i className="amostra amostra-P" /> Prática</span>
      <span><i className="amostra amostra-TP" /> Teórica e prática</span>
      {!semEdicao && <span><i className="amostra amostra-conflito" /> Em conflito</span>}
      {!semEdicao && <span className="legenda-dica">Clique numa aula para editar a turma.</span>}
    </p>
  )
}
