import { useMemo } from 'react'
import { useOferta } from '../contexto'
import { GradeSemanal, Legenda } from '../componentes/GradeSemanal'
import { Cabecalho, Vazio } from '../componentes/pecas'
import { CabecalhoImpressao, imprimir } from '../componentes/Impressao'
import { NOME_SITUACAO, NOME_SITUACAO_DOCENTE, baixar, horasPorDocente, cargas, conflitos, fmtHoras, horarioTexto, horasTurma, nivelDe, nomeSemestre, referencia, rotulo } from '../lib/dominio'

export function Docentes({ id }: { id?: string }) {
  const { dados, semestre, turmas, editar } = useOferta()
  const carg = useMemo(() => cargas(dados, turmas), [dados, turmas])
  const ref = semestre ? referencia(dados.semestres, semestre.id) : null
  const cargRef = useMemo(() => new Map(ref ? cargas(dados, dados.turmas.filter((t) => t.semestreId === ref.id)).map((c) => [c.docente.id, c.total]) : []), [dados, ref])
  const disc = useMemo(() => new Map(dados.disciplinas.map((d) => [d.codigo, d])), [dados.disciplinas])
  const conf = useMemo(() => new Set(conflitos(dados, turmas).flatMap((c) => c.turmas.map((t) => t.id))), [dados, turmas])

  if (!semestre) return <main className="pagina"><Vazio titulo="Nenhum semestre escolhido" /></main>

  const um = id ? carg.find((c) => c.docente.id === id) : null
  if (id && um) {
    return (
      <main className="pagina">
        <p className="trilha"><a href="#/docentes">Carga docente</a> / {um.docente.apelido}</p>
        <Cabecalho sobre={`${nomeSemestre(semestre.id)} | ${um.docente.ativo ? NOME_SITUACAO[um.situacao] : NOME_SITUACAO_DOCENTE[um.docente.situacao]}`} titulo={um.docente.nome}
          texto={`${fmtHoras(um.total)} h por semana: ${fmtHoras(um.grad)} na graduação e ${fmtHoras(um.pos)} na pós. Mínimo de ${fmtHoras(um.docente.chMinima)} h.`}>
          <button className="btn btn-claro" onClick={() => imprimir()}>Imprimir</button>
        </Cabecalho>
        <CabecalhoImpressao titulo={`Horário de ${um.docente.nome}`} semestre={semestre.id} />
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th scope="col">Turma</th><th scope="col">Disciplina</th><th scope="col">Horários</th><th scope="col">Salas</th><th scope="col" className="num">h/sem</th></tr></thead>
            <tbody>
              {um.turmas.map((t) => (
                <tr key={t.id} className="clicavel" onClick={() => editar(t)}>
                  <td><button className="link forte" onClick={(e) => { e.stopPropagation(); editar(t) }}>{rotulo(t)}</button></td>
                  <td>{disc.get(t.disciplina)?.nome}{nivelDe(t, disc) === 'pos' && <span className="etiqueta">Pós</span>}</td>
                  <td>{t.horarios.map((h, i) => <span key={i} className="horario">{horarioTexto(h)}</span>)}</td>
                  <td className="mono">{[...new Set(t.horarios.map((h) => h.sala).filter(Boolean))].join(', ') || '-'}</td>
                  <td className="num">{fmtHoras(horasPorDocente(t).get(um.docente.id) ?? 0)}{t.docentes.length > 1 && <small> de {fmtHoras(horasTurma(t))}</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="titulo-secao">Semana</h2>
        <Legenda />
        <GradeSemanal turmas={um.turmas} conflitantes={conf} titulo={`Grade de ${um.docente.apelido}`} mostrar={{ sala: true, docente: false }} />
      </main>
    )
  }

  const exportar = () => {
    const linhas = [['Docente', 'Graduação (h/sem)', 'Pós (h/sem)', 'Total (h/sem)', 'Mínimo', 'Situação', 'Disciplinas', 'Turmas']]
    for (const c of carg) linhas.push([c.docente.apelido, fmtHoras(c.grad), fmtHoras(c.pos), fmtHoras(c.total), fmtHoras(c.docente.chMinima), NOME_SITUACAO[c.situacao], c.disciplinas.join(' | '), String(c.turmas.length)])
    baixar(`carga_docente_${semestre.id}.csv`, '﻿' + linhas.map((l) => l.map((v) => `"${v}"`).join(';')).join('\r\n'))
  }
  const total = carg.reduce((s, c) => s + c.total, 0)

  return (
    <main className="pagina">
      <Cabecalho sobre={`Docentes ${nomeSemestre(semestre.id)}`} titulo="Carga horária semanal"
        texto="Horas de aula por semana, separadas entre graduação e pós. Em turma com mais de um docente vale a divisão informada na turma; sem ela, as horas são divididas igualmente.">
        <button className="btn btn-claro" onClick={exportar}>Baixar planilha</button>
      </Cabecalho>
      <div className="tabela-rolagem">
        <table className="tabela tabela-carga">
          <thead>
            <tr>
              <th scope="col">Docente</th><th scope="col" className="num">Grad</th><th scope="col" className="num">Pós</th>
              <th scope="col" className="num">Total</th><th scope="col">Situação</th>
              <th scope="col" className="num">{ref ? nomeSemestre(ref.id) : 'Anterior'}</th>
              <th scope="col">Disciplinas</th><th scope="col" className="num">Turmas</th>
            </tr>
          </thead>
          <tbody>
            {carg.map((c) => {
              const antes = cargRef.get(c.docente.id)
              return (
                <tr key={c.docente.id} className={!c.docente.ativo ? 'inativo' : ''}>
                  <td><a className="forte" href={`#/docentes/${c.docente.id}`}>{c.docente.apelido}</a>{!c.docente.ativo && <span className="etiqueta">{NOME_SITUACAO_DOCENTE[c.docente.situacao]}</span>}</td>
                  <td className="num">{fmtHoras(c.grad)}</td>
                  <td className="num">{fmtHoras(c.pos)}</td>
                  <td className="num forte">{fmtHoras(c.total)}</td>
                  <td><span className={`selo sit-${c.situacao}`}>{NOME_SITUACAO[c.situacao]}</span></td>
                  <td className="num">{antes === undefined ? '-' : <>{fmtHoras(antes)}{antes !== c.total && <small className={c.total > antes ? 'subiu' : 'desceu'}> {c.total > antes ? '+' : ''}{fmtHoras(c.total - antes)}</small>}</>}</td>
                  <td className="mono pequeno">{c.disciplinas.join(', ') || '-'}</td>
                  <td className="num">{c.turmas.length}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr><th scope="row">Setor</th><td className="num">{fmtHoras(carg.reduce((s, c) => s + c.grad, 0))}</td><td className="num">{fmtHoras(carg.reduce((s, c) => s + c.pos, 0))}</td><td className="num forte">{fmtHoras(total)}</td><td colSpan={4} /></tr>
          </tfoot>
        </table>
      </div>
      <p className="nota">Mínimo de 8 h por semana em ensino (LDB, art. 57, e RAPPAD/UFV); o mínimo de cada docente pode ser ajustado na Administração. Faixas: até 12 h dentro do esperado, até 16 h elevada, acima disso verificar.</p>
    </main>
  )
}
