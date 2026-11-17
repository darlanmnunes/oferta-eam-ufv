import { useMemo, useState } from 'react'
import { ir, useOferta } from '../contexto'
import { GradeSemanal, Legenda } from '../componentes/GradeSemanal'
import { Abas, Cabecalho, Vazio } from '../componentes/pecas'
import { CabecalhoImpressao, imprimir } from '../componentes/Impressao'
import { conflitos, duracao, grupoSala, nivelDe, nomeSemestre, periodoDe, type GrupoSala } from '../lib/dominio'

type Modo = 'geral' | 'docente' | 'sala' | 'periodo'

export function Grades({ modo = 'geral', alvo }: { modo?: string; alvo?: string }) {
  const { dados, semestre, turmas } = useOferta()
  const disc = useMemo(() => new Map(dados.disciplinas.map((d) => [d.codigo, d])), [dados.disciplinas])
  const conf = useMemo(() => new Set(conflitos(dados, turmas).flatMap((c) => c.turmas.map((t) => t.id))), [dados, turmas])
  const m = (['geral', 'docente', 'sala', 'periodo'].includes(modo) ? modo : 'geral') as Modo

  const salas = useMemo(() => [...new Set(turmas.flatMap((t) => t.horarios.filter((h) => h.dia && h.sala).map((h) => h.sala!)))].sort(), [turmas])
  const periodos = useMemo(() => [...new Set(turmas.map((t) => periodoDe(t, disc)).filter(Boolean) as number[])].sort((a, b) => a - b), [turmas, disc])
  const docentes = dados.docentes.filter((d) => turmas.some((t) => t.docentes.includes(d.id)))

  if (!semestre) return <main className="pagina"><Vazio titulo="Nenhum semestre escolhido" /></main>

  const opcoes: Record<Modo, [string, string][]> = {
    geral: [['grad', 'Graduação'], ['pos', 'Pós-graduação'], ['todas', 'Tudo']],
    docente: docentes.map((d) => [d.id, d.apelido]),
    sala: salas.map((s) => [s, s]),
    periodo: periodos.map((p) => [String(p), `${p}º período`]),
  }
  const escolhido = alvo && opcoes[m].some(([v]) => v === alvo) ? alvo : opcoes[m][0]?.[0]
  const nomeAlvo = opcoes[m].find(([v]) => v === escolhido)?.[1] ?? ''

  let lista = turmas
  let filtro: Parameters<typeof GradeSemanal>[0]['filtro']
  if (m === 'geral' && escolhido !== 'todas') lista = turmas.filter((t) => nivelDe(t, disc) === escolhido)
  if (m === 'docente') lista = turmas.filter((t) => t.docentes.includes(escolhido!))
  if (m === 'sala') { lista = turmas.filter((t) => t.horarios.some((h) => h.sala === escolhido)); filtro = (_, h) => h.sala === escolhido }
  if (m === 'periodo') lista = turmas.filter((t) => periodoDe(t, disc) === Number(escolhido))
  const horas = lista.reduce((s, t) => s + t.horarios.filter((h) => !filtro || filtro(t, h)).reduce((x, h) => x + duracao(h), 0), 0)

  return (
    <main className="pagina">
      <Cabecalho sobre={`Grade ${nomeSemestre(semestre.id)}`} titulo={m === 'geral' ? `Horário geral: ${nomeAlvo.toLowerCase()}` : nomeAlvo || 'Grade horária'}
        texto={`${lista.length} turmas | ${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas por semana`}>
        <button className="btn btn-claro" onClick={() => imprimir()}>Imprimir</button>
      </Cabecalho>
      <CabecalhoImpressao titulo={m === 'geral' ? `Horário geral: ${nomeAlvo.toLowerCase()}` : m === 'periodo' ? `Horário do ${nomeAlvo}` : m === 'sala' ? `Horário da sala ${nomeAlvo}` : `Horário de ${nomeAlvo}`} semestre={semestre.id} />

      <div className="filtros nao-imprime">
        <Abas rotulo="Ver grade por" valor={m} aoMudar={(v) => ir(`/grades/${v}`)}
          opcoes={[['geral', 'Geral'], ['docente', 'Docente'], ['sala', 'Sala'], ['periodo', 'Período do curso']]} />
        {opcoes[m].length > 0 && (
          <select aria-label="Escolha" value={escolhido} onChange={(e) => ir(`/grades/${m}/${encodeURIComponent(e.target.value)}`)}>
            {opcoes[m].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        )}
      </div>
      {m === 'periodo' && <p className="dica">Turmas destinadas a cada período da matriz de EAM, pelas vagas do RES ou pelo catálogo. Choques entre teóricas do mesmo período aparecem em vermelho.</p>}
      <Legenda />
      {opcoes[m].length === 0 ? <Vazio titulo="Nada para mostrar" /> : (
        <GradeSemanal turmas={lista} filtro={filtro} conflitantes={conf} titulo={nomeAlvo}
          mostrar={{ docente: m !== 'docente', sala: m !== 'sala' }} />
      )}
    </main>
  )
}

const GRUPOS: [GrupoSala, string, string][] = [
  ['LEA', 'Laboratório de Engenharia de Agrimensura e Cartográfica', 'Salas do setor: a distribuição é nossa.'],
  ['CCE', 'Laboratórios de informática do CCE', 'Reservados pelo setor a cada semestre.'],
  ['PV', 'Pavilhões de aula (PVA e PVB)', 'Distribuídas pelo Registro Escolar; aqui só para conferência.'],
  ['Outras', 'Outras salas', ''],
]

export function Salas({ grupo }: { grupo?: string }) {
  const { semestre, turmas, dados } = useOferta()
  const [modo, setModo] = useState<'consolidada' | 'salas'>('consolidada')
  const conf = useMemo(() => new Set(conflitos(dados, turmas).filter((c) => c.tipo === 'sala').flatMap((c) => c.turmas.map((t) => t.id))), [dados, turmas])
  const g = (GRUPOS.find((x) => x[0] === grupo) ?? GRUPOS[0])
  const uso = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of turmas) for (const h of t.horarios) if (h.dia && h.sala) m.set(h.sala, (m.get(h.sala) ?? 0) + duracao(h))
    return m
  }, [turmas])
  if (!semestre) return <main className="pagina"><Vazio titulo="Nenhum semestre escolhido" /></main>
  const salas = [...uso].filter(([s]) => grupoSala(s) === g[0]).sort((a, b) => a[0].localeCompare(b[0]))
  const filtro = (_: unknown, h: { sala: string | null }) => !!h.sala && grupoSala(h.sala) === g[0]
  const nomeGrupo = g[0] === 'PV' ? 'PVA/PVB' : g[0]

  return (
    <main className={`pagina imprime-${modo}`}>
      <Cabecalho sobre={`Salas ${nomeSemestre(semestre.id)}`} titulo={g[1]} texto={g[2]}>
        {salas.length > 0 && <>
          <button className="btn btn-claro" onClick={() => { setModo('consolidada'); imprimir() }}>Imprimir grade do {nomeGrupo}</button>
          {salas.length > 1 && <button className="btn btn-claro" onClick={() => { setModo('salas'); imprimir() }}>Imprimir uma página por sala</button>}
        </>}
      </Cabecalho>
      <div className="filtros nao-imprime">
        <Abas rotulo="Grupo de salas" valor={g[0]} aoMudar={(v) => ir(`/salas/${v}`)} opcoes={GRUPOS.map(([k]) => [k, k === 'PV' ? 'PVA/PVB' : k])} />
      </div>
      {salas.length === 0 ? <Vazio titulo="Nenhuma aula nestas salas" /> : (
        <>
          <ul className="salas nao-imprime">
            {salas.map(([s, h]) => {
              const pct = Math.min(100, (h / 50) * 100)
              return (
                <li key={s}>
                  <a href={`#/grades/sala/${encodeURIComponent(s)}`}>
                    <b className="mono">{s}</b>
                    <span className="sala-uso"><span style={{ width: `${pct}%` }} /></span>
                    <span>{h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h por semana | {Math.round(pct)}% de 8h às 18h</span>
                  </a>
                </li>
              )
            })}
          </ul>
          <section className="bloco-consolidada">
            <CabecalhoImpressao titulo={`Horário ${g[0] === 'LEA' ? 'do LEA' : `das salas ${nomeGrupo}`}: todas as salas`} semestre={semestre.id} />
            <h2 className="titulo-secao nao-imprime">Grade consolidada</h2>
            <Legenda />
            <GradeSemanal turmas={turmas.filter((t) => t.horarios.some((h) => filtro(t, h)))} filtro={filtro} conflitantes={conf} titulo={`Grade consolidada ${nomeGrupo}`} />
          </section>
          <div className="bloco-por-sala">
            {salas.map(([s]) => (
              <section key={s} className="pagina-impressa">
                <CabecalhoImpressao titulo={`Horário da sala ${s}`} semestre={semestre.id} />
                <GradeSemanal turmas={turmas.filter((t) => t.horarios.some((h) => h.sala === s))} filtro={(_, h) => h.sala === s}
                  titulo={`Sala ${s}`} mostrar={{ docente: true, sala: false }} />
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
