<p align="center"><img src="public/marca/assinatura.png" alt="Engenharia de Agrimensura e Cartográfica | UFV" height="72"></p>

# Oferta de Disciplinas EAM

**Acesse:** [darlanmnunes.github.io/oferta-eam-ufv](https://darlanmnunes.github.io/oferta-eam-ufv/)

[![DOI](https://zenodo.org/badge/1462046744.svg)](https://doi.org/10.5281/zenodo.24478308)

Sistema para planejar, a cada semestre, a oferta de disciplinas do curso de Engenharia de Agrimensura e
Cartográfica da UFV: turmas, horários, salas e carga docente. Substitui a planilha de distribuição de aulas.

A página inicial é aberta: qualquer pessoa consulta as disciplinas ofertadas, a semana de cada período e o horário do
LEA. O painel e as alterações são restritos aos docentes do curso, com a conta Google @ufv.br.

## O que faz

- **Página inicial pública** com a oferta do semestre em andamento e dos anteriores: disciplinas e turmas, horários, salas e docentes,
  grade semanal de cada período e horário do LEA para imprimir.
- **Painel** interativo: indicadores, gráficos de rosca e filtros cruzados (nível, tipo de aula, local, docente),
  carga por docente (graduação e pós, com o mínimo de 8 h), mapa das aulas simultâneas com as turmas de cada hora,
  conflitos e pendências.
- **Turmas**: inclui, edita, duplica e exclui turmas, com aviso de conflito enquanto edita. Em turma com mais de um
  docente, as horas são divididas igualmente ou conforme o informado para cada um.
- **Grades horárias** geral, por docente, por sala e por período da matriz, prontas para imprimir.
- **Salas e LEA**: ocupação das salas do LEA, do CCE e dos pavilhões; impressão da grade consolidada ou
  de uma página por sala.
- **Conferência**: o que entrou e saiu em relação ao mesmo semestre do ano anterior, disciplinas esperadas
  pela periodicidade (1º semestre, 2º semestre, todo semestre) e comparação com o horário oficial do Registro Escolar (RES).
- **Disciplinas**: catálogo com a periodicidade e o histórico de oferta desde 2022.
- **Semestres**: cada novo semestre começa como cópia de outro e passa por três situações: em planejamento (só os
  docentes veem), em andamento (na página pública, ainda aceita ajustes) e encerrado (só consulta).
- **Histórico** de toda alteração, com autor e data, que não pode ser apagado.

```mermaid
flowchart LR
  A[Novo semestre<br>copia o mesmo semestre do ano anterior] --> B[Conferência<br>entra e sai pela periodicidade]
  B --> C[Ajuste de turmas,<br>docentes, horários e salas]
  C --> D[Conflitos e carga<br>no painel]
  D --> E[Conferir com o<br>horário do RES]
  E --> F[Iniciar o semestre,<br>imprimir e encerrar]
```

<details>
<summary>Parte técnica</summary>

React 19, TypeScript e Vite 8; banco e login no Supabase (PostgreSQL); publicação no GitHub Pages pelo ramo
`gh-pages`.

- O banco fica no esquema `oferta` do mesmo projeto Supabase do [Acervo do LEA](https://github.com/darlanmnunes/lea-eam-ufv),
  sem misturar tabelas nem permissões. O login com Google é o mesmo dos dois sistemas. No Supabase, o esquema `oferta`
  precisa estar em Data API > Settings > Exposed schemas.

- Sem `.env`, o site roda em **modo demonstração**: horários reais da DTI e docentes fictícios, com os dados
  guardados só no navegador.
- `npm run dti` baixa o horário EAM do Registro Escolar, publicado no site da DTI (2022 em diante), e gera
  `src/dados/dti.json` e `db/003_dados_dti.sql`.
- `npm run planilhas` lê as planilhas de distribuição em `dados-fonte/privado/` (fora do git) e gera
  `db/privado/004_docentes.sql` e a distribuição fictícia da demonstração.
- Banco: `db/001_esquema.sql` (tabelas), `db/002_regras.sql` (funções e permissões). Toda escrita passa
  por funções `security definer`; RLS em todas as tabelas; histórico imutável.
- `npm run db:teste` percorre as regras num PostgreSQL local; `npm run db:supabase` junta os scripts para o
  SQL Editor.
- `npm run publicar` gera o site e envia para o ramo `gh-pages`.

</details>

## Como citar

Nunes, D. M. (2026). *Oferta de Disciplinas EAM: sistema de planejamento da oferta de disciplinas da Engenharia de
Agrimensura e Cartográfica da UFV* (versão 1.0.1) [Software]. Zenodo. https://doi.org/10.5281/zenodo.24478308

O DOI acima vale para todas as versões e leva sempre à mais recente. Para citar só a versão 1.0.1, use
[10.5281/zenodo.24478309](https://doi.org/10.5281/zenodo.24478309). Os metadados estão em [CITATION.cff](CITATION.cff)
e no botão "Cite this repository" do GitHub; DOI, commit e hashes de cada versão em [DOI.md](DOI.md). Licença AGPL-3.0-or-later ([LICENSE](LICENSE)); marcas e dados têm regras
próprias ([NOTICE](NOTICE)).

---

Desenvolvido por Prof. Dr. Darlan Miranda Nunes | Departamento de Engenharia Civil | Universidade Federal de Viçosa
