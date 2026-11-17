import { useMemo, useState } from 'react'
import { useOferta } from '../contexto'
import { Campo, Cabecalho, Confirmar, Gaveta, Vazio } from '../componentes/pecas'
import { api } from '../lib/api'
import { NOME_PERIODICIDADE, nomeSemestre, paridade, periodicidadeSugerida } from '../lib/dominio'
import type { Disciplina, Periodicidade } from '../lib/tipos'

const nova = (): Disciplina => ({ codigo: 'EAM ', nome: '', credT: 2, credP: 2, nivel: 'grad', periodicidade: 'ambos', periodo: null, ativa: true, obs: null })

export function Disciplinas() {
  const { dados, agir, semestre } = useOferta()
  const [busca, setBusca] = useState('')
  const [per, setPer] = useState('')
  const [inativas, setInativas] = useState(false)
  const [ed, setEd] = useState<Disciplina | null>(null)
  const [eNova, setENova] = useState(false)
  const [excluir, setExcluir] = useState(false)

  const sems = useMemo(() => dados.semestres.map((s) => s.id).sort().slice(-10), [dados.semestres])
  const oferta = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const t of dados.turmas) {
      if (!m.has(t.disciplina)) m.set(t.disciplina, new Map())
      const x = m.get(t.disciplina)!
      x.set(t.semestreId, (x.get(t.semestreId) ?? 0) + 1)
    }
    return m
  }, [dados.turmas])

  const termo = busca.trim().toLowerCase()
  const lista = dados.disciplinas.filter((d) =>
    (inativas || d.ativa) && (!per || d.periodicidade === per) && (!termo || `${d.codigo} ${d.nome}`.toLowerCase().includes(termo)))

  const salvar = async () => {
    if (!ed) return
    if (await agir(() => api.salvarDisciplina(ed), 'Disciplina salva.')) setEd(null)
  }

  return (
    <main className="pagina">
      <Cabecalho sobre="Catálogo" titulo="Disciplinas"
        texto="A periodicidade diz em que semestre a disciplina costuma ser ofertada. Ela orienta a conferência de cada novo semestre: o que deveria entrar e o que está fora do padrão.">
        <button className="btn" onClick={() => { setEd(nova()); setENova(true) }}>Nova disciplina</button>
      </Cabecalho>

      <div className="filtros" role="search">
        <input type="search" className="busca" placeholder="Buscar código ou nome" aria-label="Buscar disciplina" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Periodicidade" value={per} onChange={(e) => setPer(e.target.value)}>
          <option value="">Toda periodicidade</option>
          {Object.entries(NOME_PERIODICIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="chave"><input type="checkbox" checked={inativas} onChange={(e) => setInativas(e.target.checked)} /> Mostrar inativas</label>
        <span className="filtros-total">{lista.length} disciplinas</span>
      </div>

      {lista.length === 0 ? <Vazio titulo="Nenhuma disciplina com esses filtros" /> : (
        <div className="tabela-rolagem">
          <table className="tabela tabela-catalogo">
            <thead>
              <tr>
                <th scope="col">Disciplina</th>
                <th scope="col" className="num" title="Créditos teóricos e práticos">Créd.</th>
                <th scope="col">Periodicidade</th>
                {sems.map((s) => <th key={s} scope="col" className={`hist-col ${paridade(s) === 1 ? 'impar' : 'par'}${s === semestre?.id ? ' atual' : ''}`}>{nomeSemestre(s).slice(2)}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => {
                const sug = periodicidadeSugerida(dados, d.codigo)
                const o = oferta.get(d.codigo)
                return (
                  <tr key={d.codigo} className={`clicavel${d.ativa ? '' : ' inativo'}`} onClick={() => { setEd({ ...d }); setENova(false) }}>
                    <td>
                      <button className="link forte mono" onClick={(e) => { e.stopPropagation(); setEd({ ...d }); setENova(false) }}>{d.codigo}</button> {d.nome}
                      {d.nivel === 'pos' && <span className="etiqueta">Pós</span>}
                      {d.periodo && <span className="etiqueta etiqueta-claro">{d.periodo}º per.</span>}
                    </td>
                    <td className="num mono">{d.credT}-{d.credP}</td>
                    <td>
                      <span className={`selo per-${d.periodicidade}`}>{NOME_PERIODICIDADE[d.periodicidade]}</span>
                      {sug !== d.periodicidade && o && <small className="sugere" title="O que os últimos três anos indicam"> histórico: {NOME_PERIODICIDADE[sug].toLowerCase()}</small>}
                    </td>
                    {sems.map((s) => {
                      const n = o?.get(s)
                      return <td key={s} className={`hist ${paridade(s) === 1 ? 'impar' : 'par'}${s === semestre?.id ? ' atual' : ''}`}>
                        {n ? <span className="hist-marca" title={`${nomeSemestre(s)}: ${n} turma${n > 1 ? 's' : ''}`}>{n}</span> : <span className="so-leitor">não ofertada</span>}
                      </td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota">Cada número é a quantidade de turmas no semestre. Colunas claras: 1º semestre; escuras: 2º semestre.</p>

      <Gaveta aberta={!!ed} titulo={eNova ? 'Nova disciplina' : ed?.codigo ?? ''} sobre="Catálogo" aoFechar={() => setEd(null)}
        pe={<>
          {!eNova && <button className="btn-texto perigo" onClick={() => setExcluir(true)}>Excluir</button>}
          <button className="btn" onClick={salvar}>Salvar</button>
        </>}>
        {ed && (
          <div className="grade-campos">
            <Campo rotulo="Código"><input type="text" className="mono" value={ed.codigo} disabled={!eNova} onChange={(e) => setEd({ ...ed, codigo: e.target.value.toUpperCase() })} /></Campo>
            <Campo rotulo="Nível">
              <select value={ed.nivel} onChange={(e) => setEd({ ...ed, nivel: e.target.value as Disciplina['nivel'] })}>
                <option value="grad">Graduação</option><option value="pos">Pós-graduação</option>
              </select>
            </Campo>
            <Campo rotulo="Nome" largo><input type="text" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Créditos teóricos"><input type="number" min={0} max={12} value={ed.credT} onChange={(e) => setEd({ ...ed, credT: Number(e.target.value) })} /></Campo>
            <Campo rotulo="Créditos práticos"><input type="number" min={0} max={12} value={ed.credP} onChange={(e) => setEd({ ...ed, credP: Number(e.target.value) })} /></Campo>
            <Campo rotulo="Periodicidade" ajuda={!eNova ? `Pelo histórico: ${NOME_PERIODICIDADE[periodicidadeSugerida(dados, ed.codigo)].toLowerCase()}` : undefined}>
              <select value={ed.periodicidade} onChange={(e) => setEd({ ...ed, periodicidade: e.target.value as Periodicidade })}>
                {Object.entries(NOME_PERIODICIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Período na matriz" ajuda="Usado na grade por período e nos choques para os estudantes">
              <input type="number" min={1} max={12} value={ed.periodo ?? ''} onChange={(e) => setEd({ ...ed, periodo: e.target.value ? Number(e.target.value) : null })} />
            </Campo>
            <label className="chave campo-largo"><input type="checkbox" checked={ed.ativa} onChange={(e) => setEd({ ...ed, ativa: e.target.checked })} /> Ativa: ainda pode ser ofertada</label>
            <Campo rotulo="Observação" largo><textarea rows={2} value={ed.obs ?? ''} onChange={(e) => setEd({ ...ed, obs: e.target.value || null })} /></Campo>
          </div>
        )}
      </Gaveta>
      <Confirmar aberto={excluir} titulo={`Excluir ${ed?.codigo}?`} perigo acao="Excluir do catálogo"
        texto="Só é possível excluir disciplina que nunca foi ofertada. Se ela já teve turmas, marque como inativa."
        aoFechar={() => setExcluir(false)}
        aoConfirmar={async () => { setExcluir(false); if (ed && await agir(() => api.excluirDisciplina(ed.codigo), 'Disciplina excluída.')) setEd(null) }} />
    </main>
  )
}
