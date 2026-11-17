import { fmtHoras } from '../lib/dominio'

export interface Fatia { chave: string; rotulo: string; valor: number; cor: string }

/** Gráfico de rosca com legenda clicável. Clicar numa fatia filtra o painel inteiro. */
export function Rosca({ titulo, fatias, unidade, ativo, aoClicar, centro }: {
  titulo: string; fatias: Fatia[]; unidade: string; ativo?: string | null; aoClicar?(chave: string): void; centro?: string
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  const R = 52, r = 34, C = 64
  let ang = -Math.PI / 2
  const arcos = fatias.filter((f) => f.valor > 0).map((f) => {
    const a = (f.valor / (total || 1)) * Math.PI * 2
    const a0 = ang, a1 = ang + Math.min(a, Math.PI * 2 - 0.0001)
    ang += a
    const p = (rad: number, raio: number) => `${C + raio * Math.cos(rad)} ${C + raio * Math.sin(rad)}`
    const grande = a1 - a0 > Math.PI ? 1 : 0
    return { f, d: `M ${p(a0, R)} A ${R} ${R} 0 ${grande} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${grande} 0 ${p(a0, r)} Z` }
  })
  const pct = (v: number) => `${Math.round((v / (total || 1)) * 100)}%`

  return (
    <section className="cartao rosca" aria-label={titulo}>
      <h2 className="rosca-titulo">{titulo}</h2>
      <div className="rosca-corpo">
        <svg viewBox="0 0 128 128" width="128" height="128" role="img" aria-label={`${titulo}: ${fatias.map((f) => `${f.rotulo} ${fmtHoras(f.valor)} ${unidade}`).join(', ')}`}>
          {total === 0 && <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="var(--papel-2)" strokeWidth={R - r} />}
          {arcos.map(({ f, d }) => (
            <path key={f.chave} d={d} fill={f.cor} stroke="#fff" strokeWidth="1.5"
              opacity={ativo && ativo !== f.chave ? 0.28 : 1}
              style={{ cursor: aoClicar ? 'pointer' : undefined }} onClick={() => aoClicar?.(f.chave)}>
              <title>{f.rotulo}: {fmtHoras(f.valor)} {unidade} ({pct(f.valor)})</title>
            </path>
          ))}
          <text x={C} y={C - 2} textAnchor="middle" className="rosca-total">{fmtHoras(total)}</text>
          <text x={C} y={C + 15} textAnchor="middle" className="rosca-unidade">{centro ?? unidade}</text>
        </svg>
        <ul className="rosca-legenda">
          {fatias.map((f) => (
            <li key={f.chave}>
              <button disabled={!aoClicar || f.valor === 0} aria-pressed={ativo === f.chave} className={ativo && ativo !== f.chave ? 'apagada' : ''} onClick={() => aoClicar?.(f.chave)}>
                <i style={{ background: f.cor }} />
                <span>{f.rotulo}</span>
                <b>{fmtHoras(f.valor)}</b>
                <small>{pct(f.valor)}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
