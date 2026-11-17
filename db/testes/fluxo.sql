-- Percorre as regras como cada tipo de pessoa. Qualquer falha interrompe o teste.
\set QUIET on
set search_path = oferta, public;
create function pg_temp.como(p_uid text, p_email text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', p_email)::text, false);
$$;
create function pg_temp.deve_falhar(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok (recusado): %', p_msg; return; end;
  raise exception 'DEVERIA TER FALHADO: %', p_msg;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- cadastro inicial feito pelo dono do banco (como no SQL Editor)
insert into docentes (nome, apelido, email, admin) values ('Admin Teste', 'Admin', 'admin@exemplo.ufv.br', true);

set role authenticated;

-- 0. visitante sem login: semestres em andamento e encerrados, nunca os em planejamento
reset role;
update semestres set situacao = 'planejamento' where id = '2026-2';
set role anon;
do $$ begin
  if (oferta_publica() -> 'semestres')::text like '%2026-2%' then raise exception 'página pública mostra semestre em planejamento'; end if;
  if jsonb_array_length(oferta_publica() -> 'semestres') = 0 then raise exception 'página pública sem semestres'; end if;
  if jsonb_array_length(oferta_publica() -> 'turmas') = 0 then raise exception 'página pública sem turmas'; end if;
  if (oferta_publica() -> 'docentes')::text like '%@%' then raise exception 'página pública com e-mail'; end if;
end $$;
select pg_temp.deve_falhar($$select * from turmas$$, 'visitante lê tabela');
select pg_temp.deve_falhar($$select salvar_turma('{}')$$, 'visitante grava');
reset role;
set role authenticated;

-- 1. alguém de fora da lista
select pg_temp.como('00000000-0000-0000-0000-000000000009', 'estranho@exemplo.ufv.br');
do $$ begin if (select entrar()).id is not null then raise exception 'estranho entrou'; end if; end $$;
do $$ begin if (select count(*) from turmas) <> 0 then raise exception 'estranho leu turmas'; end if; end $$;
select pg_temp.deve_falhar($$select criar_semestre(2027, 1, '2026-1')$$, 'estranho cria semestre');

-- 2. administrador libera um docente
select pg_temp.como('00000000-0000-0000-0000-000000000001', 'admin@exemplo.ufv.br');
do $$ begin if not (select entrar()).admin then raise exception 'admin não reconhecido'; end if; end $$;
select salvar_docente('{"nome":"Docente Teste","apelido":"Docente","email":"Docente@exemplo.UFV.br","ch_minima":8}');
select pg_temp.deve_falhar($$select salvar_docente('{"nome":"X Y Z","apelido":"X","email":"x@gmail.com"}')$$, 'e-mail fora da UFV');
select pg_temp.deve_falhar($$select salvar_docente(jsonb_build_object('id', (eu_docente()).id, 'nome','Admin Teste','apelido','Admin','admin',false))$$, 'admin tira o próprio acesso');

-- 3. docente trabalha na oferta
select pg_temp.como('00000000-0000-0000-0000-000000000002', 'docente@exemplo.ufv.br');
do $$ begin if (select entrar()).apelido <> 'Docente' then raise exception 'docente não ligado'; end if; end $$;
do $$ begin if (select count(*) from turmas where semestre_id = '2026-1') = 0 then raise exception 'docente não lê'; end if; end $$;
select pg_temp.deve_falhar($$select email from docentes$$, 'docente lê e-mails');
select criar_semestre(2027, 1, '2026-1');
do $$ begin
  if (select count(*) from turmas where semestre_id = '2027-1') <> (select count(*) from turmas where semestre_id = '2026-1') then
    raise exception 'cópia incompleta'; end if;
end $$;
-- editar uma turma: professor, novo horário e sala
select salvar_turma(jsonb_build_object(
  'id', (select id from turmas where semestre_id = '2027-1' and disciplina_codigo = 'EAM 300' and tipo = 'T' and numero = 1),
  'disciplina_codigo', 'EAM 300', 'tipo', 'T', 'numero', 1, 'vagas', 40,
  'docentes', jsonb_build_array(jsonb_build_object('id', (eu_docente()).id, 'horas', 2), (select id from docentes where apelido = 'Admin')),
  'horarios', '[{"dia":2,"inicio":"08:00","fim":"10:00","sala":"pva 117"},{"dia":null,"inicio":"10:00","fim":"11:00","sala":null}]'::jsonb));
do $$ begin
  if (select sala from horarios h join turmas t on t.id = h.turma_id where t.semestre_id = '2027-1' and t.disciplina_codigo = 'EAM 300' and t.tipo = 'T' and t.numero = 1 and h.dia = 2) <> 'PVA117' then
    raise exception 'sala não normalizada'; end if;
  if (select array_agg(horas::text order by horas nulls last) from turma_docentes td join turmas t on t.id = td.turma_id
       where t.semestre_id = '2027-1' and t.disciplina_codigo = 'EAM 300' and t.tipo = 'T' and t.numero = 1) <> array['2.0', null] then
    raise exception 'horas por docente não gravadas'; end if;
end $$;
-- nova turma, duplicada e exclusão
select salvar_turma('{"semestre_id":"2027-1","disciplina_codigo":"EAM 311","tipo":"P","numero":3,"horarios":[{"dia":4,"inicio":"14:00","fim":"16:00","sala":"LEA101"}]}');
select pg_temp.deve_falhar($$select salvar_turma('{"semestre_id":"2027-1","disciplina_codigo":"EAM 311","tipo":"P","numero":3}')$$, 'turma duplicada');
select pg_temp.deve_falhar($$select salvar_turma('{"semestre_id":"2027-1","disciplina_codigo":"EAM 311","tipo":"P","numero":4,"horarios":[{"dia":4,"inicio":"16:00","fim":"14:00"}]}')$$, 'fim antes do início');
select excluir_turma((select id from turmas where semestre_id = '2027-1' and disciplina_codigo = 'EAM 311' and numero = 3));
-- trocar disciplinas: sai uma ímpar, entra uma par
select retirar_disciplina('2027-1', 'EAM 380');
select copiar_disciplina('2027-1', 'EAM 311', '2026-2');
do $$ begin if exists (select 1 from turmas where semestre_id = '2027-1' and disciplina_codigo = 'EAM 380') then raise exception 'não retirou'; end if; end $$;
-- catálogo
select salvar_disciplina('{"codigo":"eam 999","nome":"Disciplina Nova","cred_t":2,"cred_p":2,"periodicidade":"eventual"}');
select excluir_disciplina('EAM 999');
select pg_temp.deve_falhar($$select excluir_disciplina('EAM 300')$$, 'excluir disciplina já ofertada');
-- o que só o administrador faz
select pg_temp.deve_falhar($$select definir_situacao('2027-1', 'encerrado')$$, 'docente encerra semestre');
select pg_temp.deve_falhar($$select excluir_semestre('2027-1', '2027-1')$$, 'docente exclui semestre');
select pg_temp.deve_falhar($$select salvar_docente('{"nome":"Outro Docente","apelido":"Outro"}')$$, 'docente cadastra docente');
-- nada de escrever direto nas tabelas nem mexer na estrutura
select pg_temp.deve_falhar($$delete from turmas$$, 'delete direto');
select pg_temp.deve_falhar($$update disciplinas set nome = 'x'$$, 'update direto');
select pg_temp.deve_falhar($$insert into historico (autor_nome, acao, resumo) values ('x','x','x')$$, 'insert no histórico');
select pg_temp.deve_falhar($$drop table turmas$$, 'drop table');
select pg_temp.deve_falhar($$alter table turmas add column x int$$, 'alter table');
select pg_temp.deve_falhar($$select _registrar('2027-1','x','x')$$, 'função interna');

-- 4. só um semestre em andamento; encerrado fica só para leitura
select pg_temp.como('00000000-0000-0000-0000-000000000001', 'admin@exemplo.ufv.br');
select definir_situacao('2026-1', 'andamento');
select definir_situacao('2027-1', 'andamento');
do $$ begin
  if (select count(*) from semestres where situacao = 'andamento') <> 1 then raise exception 'mais de um semestre em andamento'; end if;
  if (select situacao from semestres where id = '2026-1') <> 'encerrado' then raise exception 'anterior não foi encerrado'; end if;
end $$;
select definir_situacao('2027-1', 'encerrado');
select pg_temp.como('00000000-0000-0000-0000-000000000002', 'docente@exemplo.ufv.br');
select pg_temp.deve_falhar($$select retirar_disciplina('2027-1', 'EAM 300')$$, 'editar semestre encerrado');
select pg_temp.como('00000000-0000-0000-0000-000000000001', 'admin@exemplo.ufv.br');
select salvar_docente(jsonb_build_object('id', (select id from docentes where apelido = 'Docente'), 'nome', 'Docente Teste', 'apelido', 'Docente', 'email', 'docente@exemplo.ufv.br', 'situacao', 'aposentado'));
select pg_temp.como('00000000-0000-0000-0000-000000000002', 'docente@exemplo.ufv.br');
do $$ begin if (select entrar()).id is not null then raise exception 'aposentado ainda entra'; end if; end $$;

-- 5. histórico imutável, mesmo para o dono do banco
reset role;
select pg_temp.deve_falhar($$update historico set resumo = 'x'$$, 'alterar histórico');
select pg_temp.deve_falhar($$delete from historico$$, 'apagar histórico');
do $$ begin if (select count(*) from historico) < 8 then raise exception 'histórico incompleto'; end if; end $$;
select acao, autor_nome, resumo from historico order by id;

-- 6. administrador exclui o semestre; o histórico continua
select pg_temp.como('00000000-0000-0000-0000-000000000001', 'admin@exemplo.ufv.br');
set role authenticated;
select pg_temp.deve_falhar($$select excluir_semestre('2027-1', 'errado')$$, 'exclusão sem confirmação');
select excluir_semestre('2027-1', '2027-1');
reset role;
do $$ begin if exists (select 1 from turmas where semestre_id = '2027-1') then raise exception 'turmas ficaram'; end if; end $$;
