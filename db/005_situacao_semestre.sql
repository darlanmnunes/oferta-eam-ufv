-- 005 | Situação do semestre em três estados: planejamento, andamento e encerrado.
-- Substitui "fechado" e a marcação "publicado": a página pública mostra os semestres em andamento e encerrados.
-- Idempotente: pode rodar de novo sem efeito.

set search_path = oferta, public;

do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace
              where n.nspname = 'oferta' and t.typname = 'situacao_semestre' and e.enumlabel = 'fechado') then
    alter table oferta.semestres alter column situacao drop default;
    alter table oferta.semestres alter column situacao type text;
    drop function if exists oferta.definir_situacao(text, oferta.situacao_semestre);
    drop type oferta.situacao_semestre;
    create type oferta.situacao_semestre as enum ('planejamento', 'andamento', 'encerrado');
    update oferta.semestres set situacao = 'encerrado' where situacao = 'fechado';
    -- o semestre publicado mais recente é o que está em curso
    update oferta.semestres set situacao = 'andamento' where id = (select max(id) from oferta.semestres where publicado);
    alter table oferta.semestres alter column situacao type oferta.situacao_semestre using situacao::oferta.situacao_semestre;
    alter table oferta.semestres alter column situacao set default 'planejamento';
    alter table oferta.semestres drop column if exists publicado;
  end if;
end $$;

drop function if exists definir_publicacao(text, boolean);

create or replace function _exigir_aberto(p_semestre text) returns void language plpgsql stable security definer set search_path = oferta, public as $$
declare v situacao_semestre;
begin
  select situacao into v from semestres where id = p_semestre;
  if v is null then raise exception 'Semestre % não existe', p_semestre; end if;
  if v = 'encerrado' and not sou_admin() then
    raise exception 'O semestre % está encerrado. Peça ao administrador para reabrir.', replace(p_semestre, '-', '/');
  end if;
end $$;

create or replace function definir_situacao(p_id text, p_situacao situacao_semestre) returns void
language plpgsql security definer set search_path = oferta, public as $$
begin
  perform _exigir_admin();
  if not exists (select 1 from semestres where id = p_id) then raise exception 'Semestre não encontrado'; end if;
  -- só um semestre em andamento: o anterior passa a encerrado
  if p_situacao = 'andamento' then
    update semestres set situacao = 'encerrado' where situacao = 'andamento' and id <> p_id;
  end if;
  update semestres set situacao = p_situacao where id = p_id;
  perform _registrar(p_id, 'semestre_' || p_situacao,
    case p_situacao when 'andamento' then 'Iniciou ' when 'encerrado' then 'Encerrou ' else 'Voltou ao planejamento ' end
    || 'o semestre ' || replace(p_id, '-', '/'));
end $$;

create or replace function oferta_publica() returns jsonb
language sql stable security definer set search_path = oferta, public as $$
  select jsonb_build_object(
    'semestres', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ano', ano, 'semestre', semestre, 'situacao', situacao) order by id)
                             from semestres where situacao <> 'planejamento'), '[]'),
    'disciplinas', coalesce((select jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'cred_t', cred_t, 'cred_p', cred_p,
                               'nivel', nivel, 'periodicidade', periodicidade, 'periodo', periodo) order by codigo) from disciplinas), '[]'),
    'docentes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'apelido', apelido, 'situacao', situacao)) from docentes), '[]'),
    'turmas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'semestre_id', t.semestre_id, 'disciplina_codigo', t.disciplina_codigo, 'tipo', t.tipo, 'numero', t.numero,
        'vagas', t.vagas, 'vagas_cursos', t.vagas_cursos,
        'docentes', (select coalesce(jsonb_agg(jsonb_build_object('id', td.docente_id, 'horas', td.horas)), '[]') from turma_docentes td where td.turma_id = t.id),
        'horarios', (select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'inicio', to_char(h.inicio, 'HH24:MI'), 'fim', to_char(h.fim, 'HH24:MI'), 'sala', h.sala)), '[]') from horarios h where h.turma_id = t.id)))
      from turmas t join semestres s on s.id = t.semestre_id and s.situacao <> 'planejamento'), '[]'))
$$;

revoke all on function _exigir_aberto(text), definir_situacao(text, situacao_semestre), oferta_publica() from public, anon, authenticated;
grant execute on function definir_situacao(text, situacao_semestre), oferta_publica() to authenticated;
grant execute on function oferta_publica() to anon;
