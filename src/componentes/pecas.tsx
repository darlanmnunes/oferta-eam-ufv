import { useEffect, useRef, type ReactNode } from 'react'

export function Campo({ rotulo, ajuda, largo, children }: { rotulo: string; ajuda?: string; largo?: boolean; children: ReactNode }) {
  return (
    <label className={`campo${largo ? ' campo-largo' : ''}`}>
      <span className="campo-rotulo">{rotulo}</span>
      {children}
      {ajuda && <span className="campo-ajuda">{ajuda}</span>}
    </label>
  )
}

/** Painel lateral modal (usa <dialog>, que já prende o foco e fecha com Esc). */
export function Gaveta({ aberta, titulo, sobre, aoFechar, children, pe }: {
  aberta: boolean; titulo: string; sobre?: string; aoFechar(): void; children: ReactNode; pe?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    if (!aberta && d.open) d.close()
  }, [aberta])
  return (
    <dialog ref={ref} className="gaveta" onClose={aoFechar} onClick={(e) => { if (e.target === ref.current) aoFechar() }} aria-labelledby="gaveta-titulo">
      {aberta && (
        <div className="gaveta-corpo">
          <header className="gaveta-cab">
            <div>
              {sobre && <p className="sobre">{sobre}</p>}
              <h2 id="gaveta-titulo">{titulo}</h2>
            </div>
            <button className="fechar" onClick={aoFechar} aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className="gaveta-conteudo">{children}</div>
          {pe && <footer className="gaveta-pe">{pe}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function Confirmar({ aberto, titulo, texto, acao, perigo, aoConfirmar, aoFechar, children }: {
  aberto: boolean; titulo: string; texto: ReactNode; acao: string; perigo?: boolean; aoConfirmar(): void; aoFechar(): void; children?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  return (
    <dialog ref={ref} className="confirmar" onClose={aoFechar} aria-labelledby="confirmar-titulo">
      {aberto && (
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); aoConfirmar() }}>
          <h2 id="confirmar-titulo">{titulo}</h2>
          <div className="confirmar-texto">{texto}</div>
          {children}
          <div className="acoes">
            <button type="button" className="btn btn-claro" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className={`btn${perigo ? ' btn-bordo' : ''}`}>{acao}</button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <p className="vazio-titulo">{titulo}</p>
      {children && <div className="vazio-texto">{children}</div>}
    </div>
  )
}

export function Cabecalho({ sobre, titulo, children, texto }: { sobre?: string; titulo: string; texto?: ReactNode; children?: ReactNode }) {
  return (
    <header className="cab">
      <div className="cab-texto">
        {sobre && <p className="sobre">{sobre}</p>}
        <h1>{titulo}</h1>
        {texto && <p className="cab-sub">{texto}</p>}
      </div>
      {children && <div className="cab-acoes">{children}</div>}
    </header>
  )
}

export function Abas<T extends string>({ valor, opcoes, aoMudar, rotulo }: { valor: T; opcoes: [T, string][]; aoMudar(v: T): void; rotulo: string }) {
  return (
    <div className="abas" role="tablist" aria-label={rotulo}>
      {opcoes.map(([v, nome]) => (
        <button key={v} role="tab" aria-selected={valor === v} onClick={() => aoMudar(v)}>{nome}</button>
      ))}
    </div>
  )
}
