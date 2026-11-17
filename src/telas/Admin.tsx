import { useEffect, useState } from 'react'
import { useOferta } from '../contexto'
import { Campo, Cabecalho, Gaveta, Vazio } from '../componentes/pecas'
import { api } from '../lib/api'
import { NOME_SITUACAO_DOCENTE, nomeSemestre } from '../lib/dominio'
import type { Docente, Evento, SituacaoDocente } from '../lib/tipos'

type Ed = Partial<Docente> & { nome: string; apelido: string }

export function Admin() {
  const { dados, agir, eu } = useOferta()
  const [ed, setEd] = useState<Ed | null>(null)
  const salvar = async () => { if (ed && await agir(() => api.salvarDocente(ed), 'Cadastro salvo.')) setEd(null) }

  return (
    <main className="pagina">
      <Cabecalho sobre="Administração" titulo="Docentes com acesso"
        texto="Só entra no sistema quem estiver nesta lista, com a conta Google @ufv.br informada. O apelido é o nome que aparece nas grades.">
        <button className="btn" onClick={() => setEd({ nome: '', apelido: '', email: '', chMinima: 8, situacao: 'ativo', admin: false })}>Novo docente</button>
      </Cabecalho>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th scope="col">Apelido</th><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col" className="num">Mínimo</th><th scope="col">Acesso</th></tr></thead>
          <tbody>
            {dados.docentes.map((d) => (
              <tr key={d.id} className={`clicavel${d.ativo ? '' : ' inativo'}`} onClick={() => setEd({ ...d })}>
                <td><button className="link forte" onClick={(e) => { e.stopPropagation(); setEd({ ...d }) }}>{d.apelido}</button></td>
                <td>{d.nome}</td>
                <td className="mono pequeno">{d.email || <span className="falta">sem e-mail</span>}</td>
                <td className="num">{d.chMinima} h</td>
                <td>
                  {!d.ativo ? <span className="selo">{NOME_SITUACAO_DOCENTE[d.situacao]}</span> : d.admin ? <span className="selo sit-elevada">Administrador</span> : <span className="selo sit-ok">Docente</span>}
                  {d.ativo && d.email && !d.ligado && <small className="dica"> ainda não entrou</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">Docente afastado, aposentado ou que não está mais no curso continua nas turmas antigas, mas não entra no sistema e não é copiado para novos semestres.</p>

      <Gaveta aberta={!!ed} titulo={ed?.id ? ed.apelido : 'Novo docente'} sobre="Administração" aoFechar={() => setEd(null)} pe={<button className="btn" onClick={salvar}>Salvar</button>}>
        {ed && (
          <div className="grade-campos">
            <Campo rotulo="Nome completo" largo><input type="text" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
            <Campo rotulo="Apelido" ajuda="Como aparece nas grades"><input type="text" value={ed.apelido} onChange={(e) => setEd({ ...ed, apelido: e.target.value })} /></Campo>
            <Campo rotulo="Carga mínima (h/sem)"><input type="number" min={0} max={40} step={0.5} value={ed.chMinima ?? 8} onChange={(e) => setEd({ ...ed, chMinima: Number(e.target.value) })} /></Campo>
            <Campo rotulo="E-mail @ufv.br" largo ajuda="A conta Google usada para entrar"><input type="email" value={ed.email ?? ''} onChange={(e) => setEd({ ...ed, email: e.target.value })} /></Campo>
            <Campo rotulo="Situação" largo ajuda="Só quem está ativo entra no sistema e é copiado para novos semestres. Os demais continuam nas turmas antigas.">
              <select value={ed.situacao ?? 'ativo'} disabled={ed.id === eu?.id} onChange={(e) => setEd({ ...ed, situacao: e.target.value as SituacaoDocente })}>
                {Object.entries(NOME_SITUACAO_DOCENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <label className="chave campo-largo"><input type="checkbox" checked={ed.admin ?? false} disabled={ed.id === eu?.id} onChange={(e) => setEd({ ...ed, admin: e.target.checked })} /> Administrador: cadastra docentes, fecha e exclui semestres</label>
          </div>
        )}
      </Gaveta>
    </main>
  )
}

export function Historico() {
  const { semestre, avisar, dados } = useOferta()
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [so, setSo] = useState<'semestre' | 'tudo'>('semestre')
  useEffect(() => { api.historico(500).then(setEventos).catch((e) => avisar(e.message, 'erro')) }, [avisar, dados])
  const lista = (eventos ?? []).filter((e) => so === 'tudo' || e.semestreId === semestre?.id || e.semestreId === null)
  const fmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <main className="pagina">
      <Cabecalho sobre="Registro" titulo="Histórico de alterações" texto="Toda mudança feita pelo sistema fica registrada com autor, data e hora. O registro não pode ser editado nem apagado.">
        <select aria-label="Mostrar" value={so} onChange={(e) => setSo(e.target.value as 'semestre' | 'tudo')}>
          <option value="semestre">{semestre ? `Só ${nomeSemestre(semestre.id)} e catálogo` : 'Semestre atual'}</option>
          <option value="tudo">Todos os semestres</option>
        </select>
      </Cabecalho>
      {eventos === null ? <p className="carregando">Carregando…</p> : lista.length === 0 ? <Vazio titulo="Nada registrado ainda">As alterações aparecem aqui assim que alguém edita a oferta.</Vazio> : (
        <ol className="linha-tempo">
          {lista.map((e) => (
            <li key={e.id}>
              <time dateTime={e.quando}>{fmt.format(new Date(e.quando))}</time>
              <span className="lt-autor">{e.autor}</span>
              <span className="lt-resumo">{e.resumo}{e.semestreId && so === 'tudo' && <small> | {nomeSemestre(e.semestreId)}</small>}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
