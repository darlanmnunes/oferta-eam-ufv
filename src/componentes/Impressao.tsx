import { nomeSemestre } from '../lib/dominio'

/** Cabeçalho que só aparece no papel: marcas, título e data da impressão. */
export function CabecalhoImpressao({ titulo, semestre }: { titulo: string; semestre: string }) {
  const hoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date())
  return (
    <header className="cab-impressao">
      <img src="./marca/ufv.png" alt="UFV" />
      <div>
        <p>Engenharia de Agrimensura e Cartográfica | Departamento de Engenharia Civil | UFV</p>
        <h2>{titulo}</h2>
        <p>Semestre {nomeSemestre(semestre)} | impresso em {hoje}</p>
      </div>
      <img src="./marca/selo.png" alt="EAM" />
    </header>
  )
}

/** Espera a tela trocar o que vai para o papel e abre a impressão. */
export const imprimir = () => setTimeout(() => window.print(), 60)
