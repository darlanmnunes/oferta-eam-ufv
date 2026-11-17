import { useEffect, useState } from 'react'

/** Botão fixo que aparece depois de rolar e leva de volta ao início da tela. */
export function VoltarTopo() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const ver = () => setVisivel(window.scrollY > window.innerHeight * 0.8)
    ver()
    window.addEventListener('scroll', ver, { passive: true })
    window.addEventListener('hashchange', ver)
    return () => {
      window.removeEventListener('scroll', ver)
      window.removeEventListener('hashchange', ver)
    }
  }, [])

  const subir = () => {
    const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: calmo ? 'auto' : 'smooth' })
    document.querySelector<HTMLElement>('.lado-marca')?.focus({ preventScroll: true })
  }

  return (
    <button
      type="button"
      className={`voltar-topo${visivel ? ' is-on' : ''}`}
      aria-label="Voltar ao início da página"
      title="Voltar ao início"
      tabIndex={visivel ? 0 : -1}
      onClick={subir}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
