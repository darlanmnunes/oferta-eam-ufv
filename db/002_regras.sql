-- Regras de acesso. Toda escrita passa por estas funções, que conferem quem pede
-- e gravam o histórico. Docentes leem e editam a oferta; o administrador também
-- cuida de docentes e semestres. Ninguém altera a estrutura do banco pelo site.

-- ---------------------------------------------------------------------------
-- Quem sou eu
-- ---------------------------------------------------------------------------
create function meu_email() returns text language sql stable as $$
  select lower(auth.jwt() ->> 'email')
$$;

create function eu_docente() returns docentes
language sql stable security definer set search_path = public as $$
  select d.* from docentes d
   where d.situacao = 'ativo' and (d.usuario_id = auth.uid() or (d.usuario_id is null and lower(d.email) = meu_email()))
   order by (d.usuario_id = auth.uid()) desc nulls last
   limit 1
$$;

create function sou_docente() returns boolean language sql stable security definer set search_path = public as $$
  select (eu_docente()).id is not null
$$;

create function sou_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((eu_docente()).admin, false)
$$;

-- Primeiro acesso: liga a conta Google ao cadastro feito pelo administrador.
create function entrar() returns docentes
language plpgsql security definer set search_path = public as $$
declare v docentes;
begin
  if auth.uid() is null then raise exception 'Entre para continuar'; end if;
  v := eu_docente();
  if v.id is not null and v.usuario_id is null then
    update docentes set usuario_id = auth.uid() where id = v.id returning * into v;
  end if;
  return v;   -- nulo: e-mail ainda não liberado
end $$;

create function _registrar(p_semestre text, p_acao text, p_resumo text, p_dados jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into historico (autor_id, autor_nome, semestre_id, acao, resumo, dados)
  values ((eu_docente()).id, coalesce((eu_docente()).apelido, 'sistema'), p_semestre, p_acao, p_resumo, p_dados)
$$;

create function _exigir_docente() returns docentes language plpgsql stable security definer set search_path = public as $$
declare v docentes := eu_docente();
begin
  if v.id is null then raise exception 'Acesso restrito aos docentes do curso'; end if;
  return v;
end $$;

create function _exigir_admin() returns docentes language plpgsql stable security definer set search_path = public as $$
declare v docentes := _exigir_docente();
begin
  if not v.admin then raise exception 'Só o administrador pode fazer isso'; end if;
  return v;
end $$;

create function _exigir_aberto(p_semestre text) returns void language plpgsql stable security definer set search_path = public as $$
declare v situacao_semestre;
begin
  select situacao into v from semestres where id = p_semestre;
  if v is null then raise exception 'Semestre % não existe', p_semestre; end if;
  if v = 'fechado' and not sou_admin() then
    raise exception 'O semestre % está fechado. Peça ao administrador para reabrir.', replace(p_semestre, '-', '/');
  end if;
end $$;

create function _rotulo(p_turma turmas) returns text language sql immutable as $$
  select p_turma.disciplina_codigo || ' ' || p_turma.tipo || p_turma.numero
$$;

create function _turma_json(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'disciplina', t.disciplina_codigo, 'tipo', t.tipo, 'numero', t.numero, 'vagas', t.vagas,
    'vagas_cursos', t.vagas_cursos, 'obs', t.obs,
    'docentes', (select coalesce(jsonb_agg(d.apelido || coalesce(' (' || td.horas || ' h)', '') order by d.apelido), '[]') from turma_docentes td join docentes d on d.id = td.docente_id where td.turma_id = t.id),
    'horarios', (select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'inicio', to_char(h.inicio, 'HH24:MI'), 'fim', to_char(h.fim, 'HH24:MI'), 'sala', h.sala) order by h.dia, h.inicio), '[]') from horarios h where h.turma_id = t.id))
  from turmas t where t.id = p_id
$$;

-- ---------------------------------------------------------------------------
-- Turmas
-- ---------------------------------------------------------------------------
-- p: {id?, semestre_id, disciplina_codigo, tipo, numero, vagas, vagas_cursos, obs,
--     docentes: [uuid | {id, horas}], horarios: [{dia, inicio, fim, sala}]}
create function salvar_turma(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_eu docentes := _exigir_docente();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_antes jsonb;
  v_t turmas;
  v_h jsonb;
begin
  if v_id is not null then
    select * into v_t from turmas where id = v_id for update;
    if v_t.id is null then raise exception 'Turma não encontrada'; end if;
    perform _exigir_aberto(v_t.semestre_id);
    v_antes := _turma_json(v_id);
    update turmas set
      disciplina_codigo = p ->> 'disciplina_codigo',
      tipo = (p ->> 'tipo')::tipo_turma,
      numero = (p ->> 'numero')::smallint,
      vagas = nullif(p ->> 'vagas', '')::smallint,
      vagas_cursos = nullif(trim(p ->> 'vagas_cursos'), ''),
      obs = nullif(trim(p ->> 'obs'), ''),
      atualizado_em = now(), atualizado_por = v_eu.apelido
    where id = v_id returning * into v_t;
  else
    perform _exigir_aberto(p ->> 'semestre_id');
    insert into turmas (semestre_id, disciplina_codigo, tipo, numero, vagas, vagas_cursos, obs, atualizado_por)
    values (p ->> 'semestre_id', p ->> 'disciplina_codigo', (p ->> 'tipo')::tipo_turma, (p ->> 'numero')::smallint,
            nullif(p ->> 'vagas', '')::smallint, nullif(trim(p ->> 'vagas_cursos'), ''), nullif(trim(p ->> 'obs'), ''), v_eu.apelido)
    returning * into v_t;
    v_id := v_t.id;
  end if;

  delete from turma_docentes where turma_id = v_id;
  insert into turma_docentes (turma_id, docente_id, horas)
  select v_id,
         (case when jsonb_typeof(x) = 'object' then x ->> 'id' else x #>> '{}' end)::uuid,
         case when jsonb_typeof(x) = 'object' then nullif(x ->> 'horas', '')::numeric end
    from jsonb_array_elements(coalesce(p -> 'docentes', '[]')) x
  on conflict do nothing;

  delete from horarios where turma_id = v_id;
  for v_h in select * from jsonb_array_elements(coalesce(p -> 'horarios', '[]')) loop
    insert into horarios (turma_id, dia, inicio, fim, sala)
    values (v_id, nullif(v_h ->> 'dia', '')::smallint, nullif(v_h ->> 'inicio', '')::time,
            nullif(v_h ->> 'fim', '')::time, nullif(upper(replace(trim(v_h ->> 'sala'), ' ', '')), ''));
  end loop;

  perform _registrar(v_t.semestre_id, case when v_antes is null then 'turma_criada' else 'turma_alterada' end,
    (case when v_antes is null then 'Criou ' else 'Alterou ' end) || _rotulo(v_t),
    jsonb_build_object('antes', v_antes, 'depois', _turma_json(v_id)));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe a turma % % % neste semestre', p ->> 'disciplina_codigo', p ->> 'tipo', p ->> 'numero';
end $$;

create function excluir_turma(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_t turmas; v_antes jsonb;
begin
  perform _exigir_docente();
  select * into v_t from turmas where id = p_id;
  if v_t.id is null then raise exception 'Turma não encontrada'; end if;
  perform _exigir_aberto(v_t.semestre_id);
  v_antes := _turma_json(p_id);
  delete from turmas where id = p_id;
  perform _registrar(v_t.semestre_id, 'turma_excluida', 'Excluiu ' || _rotulo(v_t), jsonb_build_object('antes', v_antes));
end $$;

-- Copia as turmas de uma disciplina de outro semestre (com horários e docentes ativos).
create function copiar_disciplina(p_semestre text, p_codigo text, p_origem text) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_t turmas; v_nova uuid;
begin
  perform _exigir_docente();
  perform _exigir_aberto(p_semestre);
  for v_t in select * from turmas where semestre_id = p_origem and disciplina_codigo = p_codigo order by tipo, numero loop
    insert into turmas (semestre_id, disciplina_codigo, tipo, numero, vagas, vagas_cursos, obs, atualizado_por)
    values (p_semestre, v_t.disciplina_codigo, v_t.tipo, v_t.numero, v_t.vagas, v_t.vagas_cursos, v_t.obs, (eu_docente()).apelido)
    on conflict do nothing returning id into v_nova;
    if v_nova is null then continue; end if;
    insert into horarios (turma_id, dia, inicio, fim, sala) select v_nova, dia, inicio, fim, sala from horarios where turma_id = v_t.id;
    insert into turma_docentes select v_nova, td.docente_id, td.horas from turma_docentes td join docentes d on d.id = td.docente_id
     where td.turma_id = v_t.id and d.situacao = 'ativo';
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then
    perform _registrar(p_semestre, 'disciplina_incluida',
      format('Incluiu %s (%s turma%s copiada%s de %s)', p_codigo, v_n, case when v_n > 1 then 's' else '' end,
             case when v_n > 1 then 's' else '' end, replace(p_origem, '-', '/')));
  end if;
  return v_n;
end $$;

create function retirar_disciplina(p_semestre text, p_codigo text) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_antes jsonb;
begin
  perform _exigir_docente();
  perform _exigir_aberto(p_semestre);
  select jsonb_agg(_turma_json(id)) into v_antes from turmas where semestre_id = p_semestre and disciplina_codigo = p_codigo;
  delete from turmas where semestre_id = p_semestre and disciplina_codigo = p_codigo;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform _registrar(p_semestre, 'disciplina_retirada', format('Retirou %s da oferta (%s turma%s)', p_codigo, v_n, case when v_n > 1 then 's' else '' end),
      jsonb_build_object('antes', v_antes));
  end if;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create function salvar_disciplina(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_novo boolean;
begin
  perform _exigir_docente();
  v_novo := not exists (select 1 from disciplinas where codigo = upper(trim(p ->> 'codigo')));
  insert into disciplinas (codigo, nome, cred_t, cred_p, nivel, periodicidade, periodo, ativa, obs)
  values (upper(trim(p ->> 'codigo')), trim(p ->> 'nome'), coalesce((p ->> 'cred_t')::smallint, 0), coalesce((p ->> 'cred_p')::smallint, 0),
          coalesce(p ->> 'nivel', 'grad')::nivel, coalesce(p ->> 'periodicidade', 'ambos')::periodicidade,
          nullif(p ->> 'periodo', '')::smallint, coalesce((p ->> 'ativa')::boolean, true), nullif(trim(p ->> 'obs'), ''))
  on conflict (codigo) do update set
    nome = excluded.nome, cred_t = excluded.cred_t, cred_p = excluded.cred_p, nivel = excluded.nivel,
    periodicidade = excluded.periodicidade, periodo = excluded.periodo, ativa = excluded.ativa, obs = excluded.obs;
  perform _registrar(null, case when v_novo then 'disciplina_criada' else 'disciplina_alterada' end,
    (case when v_novo then 'Cadastrou ' else 'Alterou o cadastro de ' end) || upper(trim(p ->> 'codigo')), p);
  return upper(trim(p ->> 'codigo'));
end $$;

create function excluir_disciplina(p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_docente();
  if exists (select 1 from turmas where disciplina_codigo = p_codigo) then
    raise exception '% já foi ofertada. Em vez de excluir, marque como inativa.', p_codigo;
  end if;
  delete from disciplinas where codigo = p_codigo;
  perform _registrar(null, 'disciplina_excluida', 'Excluiu ' || p_codigo || ' do catálogo');
end $$;

-- ---------------------------------------------------------------------------
-- Semestres
-- ---------------------------------------------------------------------------
-- Cria o semestre copiando a oferta de outro (por padrão, o mesmo semestre do ano anterior).
create function criar_semestre(p_ano int, p_semestre int, p_origem text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id text := p_ano || '-' || p_semestre;
  v_origem text := coalesce(nullif(p_origem, ''), null);
  v_t turmas; v_nova uuid; v_n int := 0;
begin
  perform _exigir_docente();
  if exists (select 1 from semestres where id = v_id) then raise exception 'O semestre %/% já existe', p_ano, p_semestre; end if;
  insert into semestres (id, ano, semestre, origem) values (v_id, p_ano, p_semestre, v_origem);
  if v_origem is not null then
    for v_t in select * from turmas where semestre_id = v_origem loop
      insert into turmas (semestre_id, disciplina_codigo, tipo, numero, vagas, vagas_cursos, obs, atualizado_por)
      values (v_id, v_t.disciplina_codigo, v_t.tipo, v_t.numero, v_t.vagas, v_t.vagas_cursos, v_t.obs, (eu_docente()).apelido)
      returning id into v_nova;
      insert into horarios (turma_id, dia, inicio, fim, sala) select v_nova, dia, inicio, fim, sala from horarios where turma_id = v_t.id;
      insert into turma_docentes select v_nova, td.docente_id, td.horas from turma_docentes td join docentes d on d.id = td.docente_id
       where td.turma_id = v_t.id and d.situacao = 'ativo';
      v_n := v_n + 1;
    end loop;
  end if;
  perform _registrar(v_id, 'semestre_criado', format('Criou o semestre %s/%s%s', p_ano, p_semestre,
    case when v_origem is null then ' vazio' else format(' a partir de %s (%s turmas)', replace(v_origem, '-', '/'), v_n) end));
  return v_id;
end $$;

create function definir_situacao(p_id text, p_situacao situacao_semestre) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_admin();
  update semestres set situacao = p_situacao where id = p_id;
  if not found then raise exception 'Semestre não encontrado'; end if;
  perform _registrar(p_id, 'semestre_' || p_situacao,
    case when p_situacao = 'fechado' then 'Fechou ' else 'Reabriu ' end || 'o semestre ' || replace(p_id, '-', '/'));
end $$;

create function excluir_semestre(p_id text, p_confirmacao text) returns void
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform _exigir_admin();
  if p_confirmacao is distinct from p_id then raise exception 'Confirmação não confere'; end if;
  select count(*) into v_n from turmas where semestre_id = p_id;
  delete from semestres where id = p_id;
  if not found then raise exception 'Semestre não encontrado'; end if;
  perform _registrar(p_id, 'semestre_excluido', format('Excluiu o semestre %s com %s turmas', replace(p_id, '-', '/'), v_n));
end $$;

create function definir_publicacao(p_id text, p_publicado boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _exigir_admin();
  update semestres set publicado = p_publicado where id = p_id;
  if not found then raise exception 'Semestre não encontrado'; end if;
  perform _registrar(p_id, case when p_publicado then 'semestre_publicado' else 'semestre_despublicado' end,
    case when p_publicado then 'Publicou ' else 'Tirou da página pública ' end || 'o semestre ' || replace(p_id, '-', '/'));
end $$;

-- Página pública: só semestres publicados; sem e-mails, carga ou histórico.
create function oferta_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'semestres', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ano', ano, 'semestre', semestre, 'situacao', situacao) order by id)
                             from semestres where publicado), '[]'),
    'disciplinas', coalesce((select jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'cred_t', cred_t, 'cred_p', cred_p,
                               'nivel', nivel, 'periodicidade', periodicidade, 'periodo', periodo) order by codigo) from disciplinas), '[]'),
    'docentes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'apelido', apelido, 'situacao', situacao)) from docentes), '[]'),
    'turmas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'semestre_id', t.semestre_id, 'disciplina_codigo', t.disciplina_codigo, 'tipo', t.tipo, 'numero', t.numero,
        'vagas', t.vagas, 'vagas_cursos', t.vagas_cursos,
        'docentes', (select coalesce(jsonb_agg(jsonb_build_object('id', td.docente_id, 'horas', td.horas)), '[]') from turma_docentes td where td.turma_id = t.id),
        'horarios', (select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'inicio', to_char(h.inicio, 'HH24:MI'), 'fim', to_char(h.fim, 'HH24:MI'), 'sala', h.sala)), '[]') from horarios h where h.turma_id = t.id)))
      from turmas t join semestres s on s.id = t.semestre_id and s.publicado), '[]'))
$$;

-- ---------------------------------------------------------------------------
-- Docentes (administrador)
-- ---------------------------------------------------------------------------
create function salvar_docente(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu docentes := _exigir_admin(); v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id = v_eu.id and (coalesce((p ->> 'admin')::boolean, false) = false or coalesce(p ->> 'situacao', 'ativo') <> 'ativo') then
    raise exception 'Você não pode tirar o seu próprio acesso de administrador';
  end if;
  if v_id is null then
    insert into docentes (nome, apelido, email, ch_minima, situacao, admin)
    values (trim(p ->> 'nome'), trim(p ->> 'apelido'), nullif(lower(trim(p ->> 'email')), ''),
            coalesce((p ->> 'ch_minima')::numeric, 8), coalesce(p ->> 'situacao', 'ativo')::situacao_docente, coalesce((p ->> 'admin')::boolean, false))
    returning id into v_id;
  else
    update docentes set nome = trim(p ->> 'nome'), apelido = trim(p ->> 'apelido'),
      email = nullif(lower(trim(p ->> 'email')), ''), ch_minima = coalesce((p ->> 'ch_minima')::numeric, 8),
      situacao = coalesce(p ->> 'situacao', 'ativo')::situacao_docente, admin = coalesce((p ->> 'admin')::boolean, false),
      usuario_id = case when lower(email) is distinct from nullif(lower(trim(p ->> 'email')), '') then null else usuario_id end
    where id = v_id;
  end if;
  perform _registrar(null, 'docente_salvo', 'Atualizou o cadastro de ' || trim(p ->> 'apelido'));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe docente com o e-mail %', p ->> 'email';
end $$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
alter table docentes enable row level security;
alter table disciplinas enable row level security;
alter table semestres enable row level security;
alter table turmas enable row level security;
alter table turma_docentes enable row level security;
alter table horarios enable row level security;
alter table historico enable row level security;

create policy leitura on docentes for select to authenticated using (sou_docente());
create policy leitura on disciplinas for select to authenticated using (sou_docente());
create policy leitura on semestres for select to authenticated using (sou_docente());
create policy leitura on turmas for select to authenticated using (sou_docente());
create policy leitura on turma_docentes for select to authenticated using (sou_docente());
create policy leitura on horarios for select to authenticated using (sou_docente());
create policy leitura on historico for select to authenticated using (sou_docente());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on docentes, disciplinas, semestres, turmas, turma_docentes, horarios, historico to authenticated;
-- o e-mail e a ligação com a conta ficam só para o administrador
revoke select on docentes from authenticated;
grant select (id, nome, apelido, ch_minima, situacao, admin) on docentes to authenticated;
create function docentes_contato() returns table (id uuid, email text, ligado boolean)
language sql stable security definer set search_path = public as $$
  select id, email, usuario_id is not null from docentes where sou_admin()
$$;

grant execute on function
  eu_docente(), sou_docente(), sou_admin(), meu_email(), entrar(),
  salvar_turma(jsonb), excluir_turma(uuid), copiar_disciplina(text, text, text), retirar_disciplina(text, text),
  salvar_disciplina(jsonb), excluir_disciplina(text),
  criar_semestre(int, int, text), definir_situacao(text, situacao_semestre), excluir_semestre(text, text),
  salvar_docente(jsonb), docentes_contato(), definir_publicacao(text, boolean), oferta_publica()
to authenticated;
grant usage on schema public to anon;
grant execute on function oferta_publica() to anon;
