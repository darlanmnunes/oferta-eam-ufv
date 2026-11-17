-- Oferta de Disciplinas | Engenharia de Agrimensura e Cartográfica | UFV
-- Esquema para PostgreSQL 14+ (Supabase). Aplicar na ordem: 001, 002, 003.

create extension if not exists pgcrypto;

create type nivel as enum ('grad', 'pos');
create type periodicidade as enum (
  'impar',     -- ofertada no 1º semestre do ano
  'par',       -- ofertada no 2º semestre do ano
  'ambos',     -- todo semestre
  'eventual'   -- sem regularidade (tópicos, optativas, pós)
);
create type situacao_semestre as enum ('planejamento', 'fechado');
create type tipo_turma as enum ('T', 'P', 'TP');
create type situacao_docente as enum ('ativo', 'afastado', 'aposentado', 'desligado');

-- ---------------------------------------------------------------------------
-- Docentes: quem pode entrar no sistema e quem recebe turmas
-- ---------------------------------------------------------------------------
create table docentes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) >= 3),
  apelido     text not null check (length(trim(apelido)) >= 2),  -- como aparece nas grades
  email       text unique check (email is null or email ~ '^[^@\s]+@([a-z0-9-]+\.)*ufv\.br$'),
  ch_minima   numeric(4,1) not null default 8,                     -- RAPPAD
  situacao    situacao_docente not null default 'ativo',  -- só 'ativo' entra no sistema e recebe turmas
  admin       boolean not null default false,
  usuario_id  uuid unique,                                         -- auth.users.id, ligado no 1º acesso
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo de disciplinas
-- ---------------------------------------------------------------------------
create table disciplinas (
  codigo         text primary key check (codigo ~ '^[A-Z]{3} \d{3}$'),
  nome           text not null check (length(trim(nome)) >= 3),
  cred_t         smallint not null default 0 check (cred_t between 0 and 12),
  cred_p         smallint not null default 0 check (cred_p between 0 and 12),
  nivel          nivel not null default 'grad',
  periodicidade  periodicidade not null default 'ambos',
  periodo        smallint check (periodo between 1 and 12),        -- período na matriz do curso
  ativa          boolean not null default true,
  obs            text
);

-- ---------------------------------------------------------------------------
-- Semestres e oferta
-- ---------------------------------------------------------------------------
create table semestres (
  id         text primary key check (id ~ '^\d{4}-[12]$'),           -- '2027-1'
  ano        smallint not null,
  semestre   smallint not null check (semestre in (1, 2)),
  situacao   situacao_semestre not null default 'planejamento',
  origem     text,                                                 -- de onde veio a oferta inicial
  publicado  boolean not null default false,                       -- aparece na página pública
  obs        text,
  criado_em  timestamptz not null default now(),
  check (id = ano || '-' || semestre)
);

create table turmas (
  id                 uuid primary key default gen_random_uuid(),
  semestre_id        text not null references semestres(id) on delete cascade,
  disciplina_codigo  text not null references disciplinas(codigo) on update cascade,
  tipo               tipo_turma not null,
  numero             smallint not null check (numero between 1 and 99),
  vagas              smallint check (vagas >= 0),
  vagas_cursos       text,                                         -- como na DTI: 'EAM4=20 GER0=10'
  obs                text,
  atualizado_em      timestamptz not null default now(),
  atualizado_por     text,
  unique (semestre_id, disciplina_codigo, tipo, numero)
);
create index on turmas (semestre_id);

create table turma_docentes (
  turma_id    uuid not null references turmas(id) on delete cascade,
  docente_id  uuid not null references docentes(id),
  horas       numeric(4,1) check (horas > 0),  -- nulo: divide as horas da turma igualmente
  primary key (turma_id, docente_id)
);

-- dia nulo = horário a combinar (conta na carga, fica fora das grades)
create table horarios (
  id        uuid primary key default gen_random_uuid(),
  turma_id  uuid not null references turmas(id) on delete cascade,
  dia       smallint check (dia between 2 and 7),                  -- 2 = segunda, como na DTI
  inicio    time,
  fim       time,
  sala      text,
  check ((inicio is null and fim is null) or fim > inicio)
);
create index on horarios (turma_id);

-- ---------------------------------------------------------------------------
-- Histórico de alterações: só cresce
-- ---------------------------------------------------------------------------
create table historico (
  id           bigserial primary key,
  quando       timestamptz not null default now(),
  autor_id     uuid,
  autor_nome   text not null,
  semestre_id  text,                                               -- texto: sobrevive à exclusão do semestre
  acao         text not null,
  resumo       text not null,
  dados        jsonb
);
create index on historico (semestre_id, quando desc);

create function historico_imutavel() returns trigger language plpgsql as $$
begin
  raise exception 'O histórico não pode ser alterado nem apagado';
end $$;
create trigger historico_imutavel before update or delete or truncate on historico
  for each statement execute function historico_imutavel();
