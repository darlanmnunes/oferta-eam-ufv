import { useState } from 'react'
import { Provedor, ir, useOferta, useRota } from './contexto'
import { EditorTurma } from './componentes/EditorTurma'
import { VoltarTopo } from './componentes/VoltarTopo'
import { api } from './lib/api'
import { nomeSemestre } from './lib/dominio'
import { Admin, Historico } from './telas/Admin'
import { Conferencia } from './telas/Conferencia'
import { Disciplinas } from './telas/Disciplinas'
import { Docentes } from './telas/Docentes'
import { Entrar } from './telas/Entrar'
import { Grades, Salas } from './telas/Grades'
import { Oferta } from './telas/Oferta'
import { Painel } from './telas/Painel'
import { Publica } from './telas/Publica'
import { Semestres } from './telas/Semestres'

const ICONES: Record<string, string> = {
  inicio: 'M3 9.5 10 3l7 6.5V17h-5v-5H8v5H3z',
  '': 'M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z',
  oferta: 'M3 5h14M3 10h14M3 15h14',
  grades: 'M3 3h14v14H3zM3 8h14M8 3v14M13 3v14',
  salas: 'M3 17V7l7-4 7 4v10M8 17v-5h4v5',
  docentes: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3.3 2.7-5 6-5s6 1.7 6 5',
  conferencia: 'M4 10l4 4 8-9',
  disciplinas: 'M4 3h10a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2zM4 15a2 2 0 0 1 2-2h10',
  semestres: 'M3 5h14v12H3zM3 9h14M7 3v4M13 3v4',
  historico: 'M10 5v5l3 2M3.5 10a6.5 6.5 0 1 0 2-4.7M3 3v3h3',
  admin: 'M10 2l6 3v5c0 4-2.7 6.5-6 8-3.3-1.5-6-4-6-8V5z',
}

function Lado({ secao }: { secao: string }) {
  const { eu, dados, semestre, escolherSemestre, turmas } = useOferta()
  const [aberto, setAberto] = useState(false)
  const links: [string, string, boolean][] = [
    ['inicio', 'Página inicial', true],
    ['', 'Painel', true],
    ['oferta', 'Turmas', true],
    ['grades', 'Grades horárias', true],
    ['salas', 'Salas e LEA', true],
    ['docentes', 'Carga docente', true],
    ['conferencia', 'Conferência', true],
    ['disciplinas', 'Disciplinas', true],
    ['semestres', 'Semestres', true],
    ['historico', 'Histórico', true],
    ['admin', 'Administração', !!eu?.admin],
  ]
  return (
    <aside className="lado nao-imprime">
      <div className="lado-topo">
        <a className="lado-marca" href="#/" aria-label="Oferta de disciplinas EAM, painel">
          <img src="./marca/selo.png" alt="" width="40" height="40" />
          <span><b>Oferta EAM</b><small>Disciplinas e horários</small></span>
        </a>
        <button className="lado-menu" aria-expanded={aberto} aria-controls="nav" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Menu'}</button>
      </div>
      <div className={`lado-corpo${aberto ? ' aberto' : ''}`}>
        <label className="lado-semestre">
          <span>Semestre</span>
          <select value={semestre?.id ?? ''} onChange={(e) => escolherSemestre(e.target.value)}>
            {[...dados.semestres].sort((a, b) => b.id.localeCompare(a.id)).map((s) => (
              <option key={s.id} value={s.id}>{nomeSemestre(s.id)}{s.situacao === 'fechado' ? ' (fechado)' : ''}</option>
            ))}
          </select>
          {semestre && <small>{turmas.length} turmas | {semestre.situacao === 'fechado' ? 'fechado para edição' : 'em planejamento'}</small>}
        </label>
        <nav id="nav" aria-label="Seções" onClick={() => setAberto(false)}>
          {links.filter((l) => l[2]).map(([r, nome]) => (
            <a key={r} href={`#/${r}`} aria-current={secao === r ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d={ICONES[r]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {nome}
            </a>
          ))}
        </nav>
        {eu && (
          <div className="lado-eu">
            <span className="inicial" aria-hidden="true">{eu.apelido.charAt(0)}</span>
            <span><b>{eu.apelido}</b><small>{eu.admin ? 'Administrador' : 'Docente'}</small></span>
            <button className="btn-texto" onClick={() => { void api.sair(); ir('/') }}>Sair</button>
          </div>
        )}
      </div>
    </aside>
  )
}

const NOMES: Record<string, string> = {
  oferta: 'Turmas', grades: 'Grades horárias', salas: 'Salas e LEA', docentes: 'Carga docente', conferencia: 'Conferência',
  disciplinas: 'Disciplinas', semestres: 'Semestres', historico: 'Histórico', admin: 'Administração',
}

function Rodape() {
  return (
    <footer className="rodape nao-imprime">
      <img src="./marca/ufv.png" alt="Universidade Federal de Viçosa" height="40" />
      <p>
        Engenharia de Agrimensura e Cartográfica | Departamento de Engenharia Civil | UFV<br />
        <span className="rodape-autor">Desenvolvido por Prof. Dr. Darlan Miranda Nunes</span>
      </p>
      <img src="./marca/assinatura.png" alt="EAM | Engenharia de Agrimensura e Cartográfica" height="40" />
    </footer>
  )
}

function Telas() {
  const [secao = '', a, b] = useRota()
  const { pronto, eu } = useOferta()
  if (!pronto) return <main className="entrada"><p className="carregando">Abrindo a oferta…</p></main>
  if (secao === 'inicio' || (!eu && secao === '')) return <><Publica /><VoltarTopo /></>
  if (!eu) return <Entrar />
  if (secao === 'entrar') { ir('/'); return null }

  let tela
  if (secao === '') tela = <Painel />
  else if (secao === 'oferta') tela = <Oferta />
  else if (secao === 'grades') tela = <Grades modo={a} alvo={b} />
  else if (secao === 'salas') tela = <Salas grupo={a} />
  else if (secao === 'docentes') tela = <Docentes id={a} />
  else if (secao === 'conferencia') tela = <Conferencia />
  else if (secao === 'disciplinas') tela = <Disciplinas />
  else if (secao === 'semestres') tela = <Semestres />
  else if (secao === 'historico') tela = <Historico />
  else if (secao === 'admin' && eu.admin) tela = <Admin />
  else tela = (
    <main className="pagina">
      <h1>Página não encontrada</h1>
      <p><button className="btn" onClick={() => ir('/')}>Voltar ao painel</button></p>
    </main>
  )
  return (
    <div className="moldura">
      <a className="pular" href="#conteudo">Ir para o conteúdo</a>
      <Lado secao={secao} />
      <div className="principal">
        {api.modo === 'demo' && <p className="faixa-demo nao-imprime">Demonstração: as alterações ficam guardadas só neste navegador.</p>}
        <nav className="migalha nao-imprime" aria-label="Você está em">
          <a href="#/inicio">Página inicial</a>
          <span aria-hidden="true">/</span>
          {secao === '' ? <span aria-current="page">Painel</span> : <><a href="#/">Painel</a><span aria-hidden="true">/</span><span aria-current="page">{NOMES[secao] ?? secao}</span></>}
        </nav>
        <div id="conteudo">{tela}</div>
        <Rodape />
      </div>
      <EditorTurma />
      <VoltarTopo />
    </div>
  )
}

export function App() {
  return <Provedor><Telas /></Provedor>
}
