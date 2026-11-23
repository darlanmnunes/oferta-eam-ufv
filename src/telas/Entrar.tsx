import { useState } from 'react'
import { useOferta } from '../contexto'
import { api } from '../lib/api'
import { reiniciarDemo } from '../lib/demo'

const Google = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" /></svg>
)

/** Tela de entrada: o sistema é só para docentes do curso. */
export function Entrar() {
  const { email, recarregar, avisar } = useOferta()
  const [erro, setErro] = useState<string | null>(null)
  const dentroDeMoldura = window.self !== window.top

  return (
    <main className="entrada">
      <div className="entrada-cartao">
        <img src="./marca/assinatura.png" alt="Engenharia de Agrimensura e Cartográfica | UFV" className="entrada-marca" />
        <p className="sobre">Área dos docentes</p>
        <h1>Oferta de disciplinas</h1>
        <p className="entrada-texto">Planejamento de turmas, horários, salas e carga docente do curso, semestre a semestre.</p>

        {email && (
          <div className="alerta-caixa" role="alert">
            <b>A conta {email} ainda não tem acesso.</b>
            <span>Peça ao administrador do sistema para incluir este e-mail na lista de docentes.</span>
            <button className="btn-texto" onClick={() => api.sair()}>Entrar com outra conta</button>
          </div>
        )}

        {api.modo === 'demo' ? (
          <>
            <p className="dica">Demonstração: as alterações ficam só neste navegador. Escolha como entrar:</p>
            <ul className="personas">
              {api.personas().map((p) => (
                <li key={p.id}>
                  <button onClick={async () => { await api.entrar(p.id); avisar(p.id === 'visitante' ? 'Conta sem acesso, como seria com um e-mail fora da lista.' : `Você entrou como ${p.nome}.`) }}>
                    <span className="inicial" aria-hidden="true">{p.nome.charAt(0)}</span>
                    <span><b>{p.nome}</b><small>{p.papel}</small></span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn-texto" onClick={() => { reiniciarDemo(); void recarregar(); avisar('Dados da demonstração restaurados.') }}>Restaurar os dados da demonstração</button>
          </>
        ) : !email && (
          <>
            {dentroDeMoldura ? (
              <a className="btn btn-google" href={location.href} target="_blank" rel="noreferrer"><Google /> Abrir o sistema para entrar</a>
            ) : (
              <button className="btn btn-google" onClick={async () => { setErro(null); try { await api.entrar() } catch (e) { setErro((e as Error).message) } }}>
                <Google /> Entrar com Google
              </button>
            )}
            <p className="dica">Use a conta Google da UFV, a mesma do e-mail institucional.</p>
            {erro && <p className="campo-msg" role="alert">{erro}</p>}
          </>
        )}
      </div>
      <a className="entrada-voltar" href="#/inicio">Voltar à página inicial</a>
      <p className="entrada-rodape">Departamento de Engenharia Civil | Universidade Federal de Viçosa<br />Desenvolvido por Prof. Dr. Darlan Miranda Nunes<br /><a className="rodape-doi" href="https://doi.org/10.5281/zenodo.24478308">DOI 10.5281/zenodo.24478308</a></p>
    </main>
  )
}
