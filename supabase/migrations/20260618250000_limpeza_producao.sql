-- =========================================================================
-- MIGRAÇÃO: RESET DE DADOS OPERACIONAIS E PREPARAÇÃO PARA PRODUÇÃO
-- =========================================================================

-- 1. Atualizar e-mail do Super Admin para o e-mail real de produção
-- Atualiza na tabela nativa auth.users
UPDATE auth.users
SET email = 'contato@occasio.imb.br'
WHERE email = 'super@occasio.imb.br';

-- Atualiza na tabela pública public.perfis
UPDATE public.perfis
SET email = 'contato@occasio.imb.br'
WHERE email = 'super@occasio.imb.br';

-- 2. Limpeza profunda das tabelas operacionais de teste (dados de homologação)
TRUNCATE TABLE public.historico_chamados CASCADE;
TRUNCATE TABLE public.chamados_midias CASCADE;
TRUNCATE TABLE public.orcamentos CASCADE;
TRUNCATE TABLE public.chamados CASCADE;
TRUNCATE TABLE public.imoveis CASCADE;
TRUNCATE TABLE public.vinculos_saas CASCADE;

-- 3. Remoção de todas as contas mockadas e dinâmicas de teste (restando apenas o Super Admin)
-- O cascade de chave estrangeira limpará automaticamente a tabela public.perfis correspondente
DELETE FROM auth.users
WHERE email != 'contato@occasio.imb.br';

-- Limpeza preventiva de qualquer perfil residual na tabela pública
DELETE FROM public.perfis
WHERE email != 'contato@occasio.imb.br';
