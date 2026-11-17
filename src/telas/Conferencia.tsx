import { useMemo, useState } from 'react'
import { useOferta } from '../contexto'
import { Cabecalho, Confirmar, Vazio } from '../componentes/pecas'
import { api } from '../lib/api'
import { DIAS_CURTOS, NOME_PERIODICIDADE, conflitos, horarioTexto, nomeSemestre, pendencias, revisao, rotulo } from '../lib/dominio'
import { comparar, enderecoDti, lerDti, type TurmaDti } from '../lib/dti'

export function Conferencia() {
  const { dados, semestre, turmas, editar, agir, podeEditar } = useOferta()
  const rev = useMemo(() => (semestre ? revisao(dados, semestre.id) : null), [dados, semestre])
  const conf = useMemo(() => conflitos(dados, turmas), [dados, turmas])
  const pend = useMemo(() => pendencias(dados, turmas), [dados, turmas])
  const disc = useMemo(() => new Map(dados.disciplinas.map((d) => [d.codigo, d])), [dados.disciplinas])
  const [retirar, setRetirar] = useState<string | null>(null)
  const [colado, setColado] = useState('')
  const lidas = useMemo(() => (colado ? lerDti(colado) : []), [colado])
  const cmp = useMemo(() => (lidas.length ? comparar(turmas, lidas) : null), [lidas, turmas])

  if (!semestre || !rev) return <main className="pagina"><Vazio titulo="Nenhum semestre escolhido" /></main>
  const sem = nomeSemestre(semestre.id)

  const trazer = (x: TurmaDti, id?: string) => {
    const atual = turmas.find((t) => t.id === id)
    return api.salvarTurma({
      id, semestreId: semestre.id, disciplina: x.disciplina, tipo: x.tipo, numero: x.numero, vagas: x.vagas, vagasCursos: x.vagasCursos,
      obs: atual?.obs ?? null, docentes: atual?.docentes ?? [], horasDocentes: atual?.horasDocentes ?? {}, horarios: x.horarios,
    })
  }
  const trazerTodas = async () => {
    if (!cmp) return
    await agir(async () => {
      for (const d of cmp.diferentes) await trazer(d.dti, d.turma.id)
      for (const x of cmp.so_dti) if (disc.has(x.disciplina)) await trazer(x)
    }, 'Horários, salas e vagas atualizados conforme o RES.')
  }

  return (
    <main className="pagina">
      <Cabecalho sobre={`Conferência ${sem}`} titulo="Revisão da oferta"
        texto={`O que mudou em relação a ${rev.ref ? nomeSemestre(rev.ref.id) : 'o semestre anterior'}, o que a periodicidade das disciplinas pede, choques de horário e diferenças com o horário oficial do Registro Escolar (RES).`} />

      <section className="secao" aria-labelledby="s-period">
        <h2 id="s-period" className="titulo-secao">Disciplinas do {semestre.semestre}º semestre</h2>
        <div className="painel-duplo">
          <div className="cartao">
            <header className="cartao-cab"><h3>Esperadas e fora da oferta</h3><span className="contador">{rev.faltando.length}</span></header>
            {rev.faltando.length === 0 ? <p className="tudo-certo">Todas as disciplinas de {semestre.semestre}º semestre e de todo semestre estão na oferta.</p> : (
              <ul className="lista-acoes">
                {rev.faltando.map(({ disciplina: d, ultima }) => (
                  <li key={d.codigo}>
                    <div><b className="mono">{d.codigo}</b> {d.nome}<small>{NOME_PERIODICIDADE[d.periodicidade]}{ultima ? ` | última oferta em ${nomeSemestre(ultima)}` : ' | nunca ofertada'}</small></div>
                    {podeEditar && ultima && <button className="btn btn-pequeno btn-claro" onClick={() => agir(() => api.copiarDisciplina(semestre.id, d.codigo, ultima), `${d.codigo} incluída com as turmas de ${nomeSemestre(ultima)}.`)}>Incluir</button>}
                  </li>
                ))}
              </ul>
            )}
            <p className="nota">Incluir copia as turmas, horários e docentes da última oferta. Se não for ofertar, marque a disciplina como eventual ou inativa no catálogo.</p>
          </div>
          <div className="cartao">
            <header className="cartao-cab"><h3>Ofertadas fora da periodicidade</h3><span className="contador">{rev.foraDoPadrao.length}</span></header>
            {rev.foraDoPadrao.length === 0 ? <p className="tudo-certo">Nenhuma disciplina fora do semestre de costume.</p> : (
              <ul className="lista-acoes">
                {rev.foraDoPadrao.map((d) => (
                  <li key={d.codigo}>
                    <div><b className="mono">{d.codigo}</b> {d.nome}<small>Costuma ser ofertada no {NOME_PERIODICIDADE[d.periodicidade]}</small></div>
                    {podeEditar && <button className="btn btn-pequeno btn-claro" onClick={() => setRetirar(d.codigo)}>Retirar</button>}
                  </li>
                ))}
              </ul>
            )}
            {rev.ref && (
              <>
                <h3 className="sub">Em relação a {nomeSemestre(rev.ref.id)}</h3>
                <p className="mudou"><b>Entraram</b> {rev.entraram.length ? rev.entraram.map((c) => <span key={c} className="etiqueta etiqueta-mais" title={disc.get(c)?.nome}>{c}</span>) : <span className="dica">nenhuma</span>}</p>
                <p className="mudou"><b>Saíram</b> {rev.sairam.length ? rev.sairam.map((c) => <span key={c} className="etiqueta etiqueta-menos" title={disc.get(c)?.nome}>{c}</span>) : <span className="dica">nenhuma</span>}</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="secao" aria-labelledby="s-conf">
        <h2 id="s-conf" className="titulo-secao">Conflitos de horário <span className="contador">{conf.length}</span></h2>
        {conf.length === 0 ? <p className="tudo-certo">Nenhum choque de sala, docente ou período.</p> : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th scope="col">Tipo</th><th scope="col">Onde</th><th scope="col">Quando</th><th scope="col">Turmas</th></tr></thead>
              <tbody>
                {conf.map((c, i) => (
                  <tr key={i}>
                    <td><span className={`etiqueta etiqueta-${c.tipo}`}>{c.tipo === 'sala' ? 'Sala' : c.tipo === 'docente' ? 'Docente' : 'Estudantes'}</span></td>
                    <td>{c.alvo}</td>
                    <td>{DIAS_CURTOS[c.dia]} {c.inicio}-{c.fim}</td>
                    <td>{c.turmas.map((t, k) => <button key={k} className="link forte" onClick={() => editar(t)}>{rotulo(t)}</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="nota">Estudantes: aulas teóricas de disciplinas diferentes destinadas ao mesmo período da matriz, no mesmo horário.</p>
      </section>

      <section className="secao" aria-labelledby="s-pend">
        <h2 id="s-pend" className="titulo-secao">Pendências <span className="contador">{pend.length}</span></h2>
        {pend.length === 0 ? <p className="tudo-certo">Toda turma tem docente, horário e sala.</p> : (
          <ul className="fichas-pendencia">
            {pend.map((p, i) => <li key={i}><button className="ficha-pendencia" onClick={() => editar(p.turma)}><b>{rotulo(p.turma)}</b> {p.motivo.toLowerCase()}</button></li>)}
          </ul>
        )}
      </section>

      <section className="secao" aria-labelledby="s-dti">
        <h2 id="s-dti" className="titulo-secao">Conferir com o horário oficial do RES</h2>
        <ol className="passos">
          <li>Abra o <a href={enderecoDti(semestre.id)} target="_blank" rel="noreferrer">horário EAM {sem} do Registro Escolar</a> (publicado no site da DTI).</li>
          <li>Selecione a página inteira (Ctrl+A ou Cmd+A), copie e cole abaixo.</li>
        </ol>
        <textarea className="colar mono" rows={4} placeholder="Cole aqui o conteúdo da página do horário" value={colado} onChange={(e) => setColado(e.target.value)} aria-label="Conteúdo da página do horário" />
        {colado && !cmp && <p className="campo-msg">Não encontrei turmas no texto colado. Copie a página inteira, com a tabela.</p>}
        {cmp && (
          <div className="cartao">
            <header className="cartao-cab">
              <h3>{lidas.length} turmas lidas | {cmp.iguais} iguais</h3>
              {podeEditar && (cmp.diferentes.length > 0 || cmp.so_dti.length > 0) && <button className="btn btn-pequeno" onClick={trazerTodas}>Trazer tudo do RES</button>}
            </header>
            {cmp.diferentes.length + cmp.so_dti.length + cmp.so_aqui.length === 0 && <p className="tudo-certo">A oferta cadastrada bate com o RES.</p>}
            {cmp.diferentes.length > 0 && (
              <>
                <h4 className="sub">Diferentes ({cmp.diferentes.length})</h4>
                <ul className="lista-acoes">
                  {cmp.diferentes.map((d) => (
                    <li key={d.turma.id}>
                      <div><button className="link forte" onClick={() => editar(d.turma)}>{rotulo(d.turma)}</button> <span className="etiqueta">{d.campos.join(', ')}</span>
                        <small>Aqui: {d.turma.horarios.map(horarioTexto).join(', ') || 'sem horário'} {d.turma.horarios.map((h) => h.sala).filter(Boolean).join(' ')}</small>
                        <small>RES: {d.dti.horarios.map(horarioTexto).join(', ') || 'sem horário'} {d.dti.horarios.map((h) => h.sala).filter(Boolean).join(' ')}{d.campos.includes('vagas') ? ` | vagas ${d.dti.vagasCursos ?? ''}` : ''}</small>
                      </div>
                      {podeEditar && <button className="btn btn-pequeno btn-claro" onClick={() => agir(() => trazer(d.dti, d.turma.id), `${rotulo(d.turma)} atualizada conforme o RES.`)}>Usar o do RES</button>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {cmp.so_dti.length > 0 && (
              <>
                <h4 className="sub">Só no RES ({cmp.so_dti.length})</h4>
                <ul className="lista-acoes">
                  {cmp.so_dti.map((x) => (
                    <li key={rotulo(x)}>
                      <div><b>{rotulo(x)}</b><small>{x.horarios.map(horarioTexto).join(', ')}{!disc.has(x.disciplina) ? ' | fora do catálogo: cadastre a disciplina antes' : ''}</small></div>
                      {podeEditar && disc.has(x.disciplina) && <button className="btn btn-pequeno btn-claro" onClick={() => agir(() => trazer(x), `${rotulo(x)} incluída.`)}>Incluir</button>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {cmp.so_aqui.length > 0 && (
              <>
                <h4 className="sub">Só aqui ({cmp.so_aqui.length})</h4>
                <p className="dica">Turmas planejadas que o RES ainda não publicou: {cmp.so_aqui.map((t) => <button key={t.id} className="link" onClick={() => editar(t)}>{rotulo(t)}</button>)}</p>
              </>
            )}
            <p className="nota">Trazer do RES copia horários, salas e vagas e mantém os docentes cadastrados aqui.</p>
          </div>
        )}
      </section>

      <Confirmar aberto={!!retirar} titulo={`Retirar ${retirar} de ${sem}?`} perigo acao="Retirar da oferta"
        texto="Todas as turmas desta disciplina saem deste semestre. O registro fica no histórico e dá para incluir de novo copiando de outro semestre."
        aoFechar={() => setRetirar(null)}
        aoConfirmar={async () => { const c = retirar!; setRetirar(null); await agir(() => api.retirarDisciplina(semestre.id, c), `${c} retirada da oferta.`) }} />
    </main>
  )
}
