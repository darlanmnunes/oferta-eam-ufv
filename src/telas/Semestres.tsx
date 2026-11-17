import { useMemo, useState } from 'react'
import { ir, useOferta } from '../contexto'
import { Campo, Cabecalho, Confirmar } from '../componentes/pecas'
import { api } from '../lib/api'
import { fmtHoras, horasTurma, nomeSemestre, referencia } from '../lib/dominio'

export function Semestres() {
  const { dados, eu, agir, escolherSemestre, semestre: atual } = useOferta()
  const proximo = useMemo(() => {
    const ult = [...dados.semestres].sort((a, b) => b.id.localeCompare(a.id))[0]
    if (!ult) return { ano: new Date().getFullYear(), semestre: 1 }
    return ult.semestre === 1 ? { ano: ult.ano, semestre: 2 } : { ano: ult.ano + 1, semestre: 1 }
  }, [dados.semestres])
  const [ano, setAno] = useState(proximo.ano)
  const [sem, setSem] = useState(proximo.semestre)
  const sugerida = referencia(dados.semestres, `${ano}-${sem}`)?.id ?? ''
  const [origem, setOrigem] = useState<string | null>(null)
  const origemEfetiva = origem ?? sugerida
  const [excluir, setExcluir] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const existe = dados.semestres.some((s) => s.id === `${ano}-${sem}`)

  const criar = async () => {
    let id = ''
    const ok = await agir(async () => { id = await api.criarSemestre(ano, sem, origemEfetiva || null) }, `Semestre ${ano}/${sem} criado.`)
    if (ok) { escolherSemestre(id); ir('/conferencia') }
  }

  return (
    <main className="pagina">
      <Cabecalho sobre="Planejamento" titulo="Semestres"
        texto="Cada semestre começa como cópia de outro, em geral o mesmo semestre do ano anterior: as disciplinas de 1º semestre vêm do 1º, as de 2º vêm do 2º. Depois, a Conferência mostra o que entra e o que sai." />

      <section className="cartao novo-semestre" aria-labelledby="t-novo">
        <h2 id="t-novo">Novo semestre</h2>
        <div className="linha-campos">
          <Campo rotulo="Ano"><input type="number" min={2020} max={2100} value={ano} onChange={(e) => { setAno(Number(e.target.value)); setOrigem(null) }} /></Campo>
          <Campo rotulo="Semestre">
            <select value={sem} onChange={(e) => { setSem(Number(e.target.value)); setOrigem(null) }}><option value={1}>1º</option><option value={2}>2º</option></select>
          </Campo>
          <Campo rotulo="Copiar a oferta de">
            <select value={origemEfetiva} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Começar vazio</option>
              {[...dados.semestres].sort((a, b) => b.id.localeCompare(a.id)).map((s) => (
                <option key={s.id} value={s.id}>{nomeSemestre(s.id)}{s.id === sugerida ? ' (recomendado)' : ''}</option>
              ))}
            </select>
          </Campo>
          <button className="btn" disabled={existe} onClick={criar}>Criar {ano}/{sem}</button>
        </div>
        {existe && <p className="campo-msg">{ano}/{sem} já existe.</p>}
        <p className="nota">A cópia leva turmas, horários, salas e docentes ainda ativos. O histórico registra quem criou.</p>
      </section>

      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th scope="col">Semestre</th><th scope="col">Situação</th><th scope="col" className="num">Disciplinas</th><th scope="col" className="num">Turmas</th><th scope="col" className="num">h/sem</th><th scope="col">Origem</th><th scope="col">Página pública</th><th scope="col"><span className="so-leitor">Ações</span></th></tr></thead>
          <tbody>
            {[...dados.semestres].sort((a, b) => b.id.localeCompare(a.id)).map((s) => {
              const ts = dados.turmas.filter((t) => t.semestreId === s.id)
              return (
                <tr key={s.id} className={s.id === atual?.id ? 'linha-atual' : ''}>
                  <th scope="row"><button className="link forte" onClick={() => { escolherSemestre(s.id); ir('/') }}>{nomeSemestre(s.id)}</button></th>
                  <td><span className={`selo sem-${s.situacao}`}>{s.situacao === 'planejamento' ? 'Em planejamento' : 'Fechado'}</span></td>
                  <td className="num">{new Set(ts.map((t) => t.disciplina)).size}</td>
                  <td className="num">{ts.length}</td>
                  <td className="num">{fmtHoras(ts.reduce((x, t) => x + horasTurma(t), 0))}</td>
                  <td>{s.origem ? (s.origem.includes('-') ? `cópia de ${nomeSemestre(s.origem)}` : s.origem === 'RES' || s.origem === 'DTI' ? 'Registro Escolar (RES)' : s.origem) : '-'}</td>
                  <td>{s.publicado ? <span className="selo sit-ok">Publicado</span> : <span className="dica">não</span>}</td>
                  <td className="acoes-linha">
                    {eu?.admin && <button className="btn btn-pequeno btn-claro" onClick={() => agir(() => api.definirPublicacao(s.id, !s.publicado), s.publicado ? `${nomeSemestre(s.id)} saiu da página pública.` : `${nomeSemestre(s.id)} publicado na página pública.`)}>{s.publicado ? 'Despublicar' : 'Publicar'}</button>}
                    {eu?.admin && (s.situacao === 'planejamento'
                      ? <button className="btn btn-pequeno btn-claro" onClick={() => agir(() => api.definirSituacao(s.id, 'fechado'), `${nomeSemestre(s.id)} fechado.`)}>Fechar</button>
                      : <button className="btn btn-pequeno btn-claro" onClick={() => agir(() => api.definirSituacao(s.id, 'planejamento'), `${nomeSemestre(s.id)} reaberto.`)}>Reabrir</button>)}
                    {eu?.admin && <button className="btn-texto perigo" onClick={() => { setExcluir(s.id); setConfirmacao('') }}>Excluir</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="nota">Semestre fechado fica só para consulta; o administrador pode reabrir. Publicado aparece na página inicial, aberta a qualquer visitante, sem carga docente nem histórico. Só o administrador publica e exclui semestres.</p>

      <Confirmar aberto={!!excluir} titulo={`Excluir o semestre ${excluir ? nomeSemestre(excluir) : ''}?`} perigo acao="Excluir semestre"
        texto={<>Todas as turmas deste semestre serão apagadas e não há como desfazer. O histórico continua registrando o que existia. Para confirmar, digite <b className="mono">{excluir}</b>.</>}
        aoFechar={() => setExcluir(null)}
        aoConfirmar={async () => {
          const id = excluir!
          if (confirmacao !== id) return
          setExcluir(null)
          await agir(() => api.excluirSemestre(id, confirmacao), `Semestre ${nomeSemestre(id)} excluído.`)
        }}>
        <input type="text" className="mono" aria-label="Confirmação" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={excluir ?? ''} />
      </Confirmar>
    </main>
  )
}
