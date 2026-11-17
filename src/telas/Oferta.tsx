import { useMemo, useState } from 'react'
import { useOferta } from '../contexto'
import { Cabecalho, Vazio } from '../componentes/pecas'
import { novaTurma } from '../componentes/EditorTurma'
import { baixar, conflitos, csvOferta, fmtHoras, horarioTexto, horasTurma, nivelDe, nomeSemestre, ordenarTurmas } from '../lib/dominio'
import type { Turma } from '../lib/tipos'

export function Oferta() {
  const { dados, semestre, turmas, editar, podeEditar } = useOferta()
  const [busca, setBusca] = useState('')
  const [nivel, setNivel] = useState('')
  const [docente, setDocente] = useState('')
  const [so, setSo] = useState('')
  const disc = useMemo(() => new Map(dados.disciplinas.map((d) => [d.codigo, d])), [dados.disciplinas])
  const nomes = useMemo(() => new Map(dados.docentes.map((d) => [d.id, d.apelido])), [dados.docentes])
  const emConflito = useMemo(() => new Set(conflitos(dados, turmas).flatMap((c) => c.turmas.map((t) => t.id))), [dados, turmas])

  if (!semestre) return <main className="pagina"><Vazio titulo="Nenhum semestre escolhido" /></main>

  const termo = busca.trim().toLowerCase()
  const lista = turmas.filter((t) => {
    if (nivel && nivelDe(t, disc) !== nivel) return false
    if (docente === '-' ? t.docentes.length : docente && !t.docentes.includes(docente)) return false
    if (so === 'conflito' && !emConflito.has(t.id)) return false
    if (so === 'combinar' && !t.horarios.some((h) => !h.dia)) return false
    if (termo) {
      const texto = `${t.disciplina} ${disc.get(t.disciplina)?.nome ?? ''} ${t.tipo}${t.numero} ${t.horarios.map((h) => h.sala).join(' ')} ${t.docentes.map((d) => nomes.get(d)).join(' ')}`.toLowerCase()
      if (!texto.includes(termo)) return false
    }
    return true
  }).sort(ordenarTurmas)

  const grupos = new Map<string, Turma[]>()
  for (const t of lista) { if (!grupos.has(t.disciplina)) grupos.set(t.disciplina, []); grupos.get(t.disciplina)!.push(t) }

  return (
    <main className="pagina">
      <Cabecalho sobre={`Oferta ${nomeSemestre(semestre.id)}`} titulo="Turmas"
        texto={`${turmas.length} turmas de ${new Set(turmas.map((t) => t.disciplina)).size} disciplinas. Clique numa linha para editar.`}>
        <button className="btn btn-claro" onClick={() => baixar(`oferta_${semestre.id}.csv`, csvOferta(dados, lista))}>Baixar planilha</button>
        {podeEditar && <button className="btn" onClick={() => editar(novaTurma(semestre.id))}>Nova turma</button>}
      </Cabecalho>

      <div className="filtros" role="search">
        <input type="search" className="busca" placeholder="Buscar código, nome, sala ou docente" aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Nível" value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Graduação e pós</option><option value="grad">Só graduação</option><option value="pos">Só pós-graduação</option>
        </select>
        <select aria-label="Docente" value={docente} onChange={(e) => setDocente(e.target.value)}>
          <option value="">Todos os docentes</option>
          <option value="-">Sem docente</option>
          {dados.docentes.filter((d) => d.ativo).map((d) => <option key={d.id} value={d.id}>{d.apelido}</option>)}
        </select>
        <select aria-label="Situação" value={so} onChange={(e) => setSo(e.target.value)}>
          <option value="">Todas as turmas</option><option value="conflito">Em conflito</option><option value="combinar">Com horário a combinar</option>
        </select>
        <span className="filtros-total" aria-live="polite">{lista.length} de {turmas.length}</span>
      </div>

      {lista.length === 0 ? <Vazio titulo="Nenhuma turma com esses filtros" /> : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Turma</th><th scope="col">Horários</th><th scope="col">Salas</th><th scope="col">Docentes</th>
                <th scope="col" className="num">h/sem</th><th scope="col" className="num">Vagas</th>
              </tr>
            </thead>
            {[...grupos].map(([codigo, ts]) => (
              <tbody key={codigo}>
                <tr className="tabela-grupo">
                  <th colSpan={6} scope="colgroup">
                    <span className="mono">{codigo}</span> {disc.get(codigo)?.nome ?? <em>fora do catálogo</em>}
                    {nivelDe(ts[0], disc) === 'pos' && <span className="etiqueta">Pós</span>}
                    {podeEditar && <button className="link" onClick={() => {
                      const ult = ts.at(-1)!
                      editar({ ...novaTurma(semestre.id, codigo), tipo: ult.tipo, numero: Math.max(...ts.filter((x) => x.tipo === ult.tipo).map((x) => x.numero)) + 1, vagasCursos: ult.vagasCursos, horarios: [] })
                    }}>+ turma</button>}
                  </th>
                </tr>
                {ts.map((t) => (
                  <tr key={t.id} className={`clicavel${emConflito.has(t.id) ? ' em-conflito' : ''}`} onClick={() => editar(t)}>
                    <td><button className="link forte" onClick={(e) => { e.stopPropagation(); editar(t) }}>{t.tipo}{t.numero}</button>{emConflito.has(t.id) && <span className="ponto-conflito" title="Em conflito" aria-label="em conflito" />}</td>
                    <td>{t.horarios.length ? t.horarios.map((h, i) => <span key={i} className="horario">{horarioTexto(h)}</span>) : <span className="falta">sem horário</span>}</td>
                    <td className="mono">{[...new Set(t.horarios.map((h) => h.sala).filter(Boolean))].join(', ') || '-'}</td>
                    <td>{t.docentes.length ? t.docentes.map((d) => nomes.get(d)).join(', ') : <span className="falta">sem docente</span>}</td>
                    <td className="num">{fmtHoras(horasTurma(t))}</td>
                    <td className="num" title={t.vagasCursos ?? undefined}>{t.vagas ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </main>
  )
}
