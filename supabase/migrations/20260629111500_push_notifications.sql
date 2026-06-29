-- Migração: Adicionar suporte para notificações por push na tabela public.perfis
-- Data de Criação: 2026-06-29 11:15:00

ALTER TABLE public.perfis 
ADD COLUMN permite_push BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN push_subscription JSONB NULL;

COMMENT ON COLUMN public.perfis.permite_push IS 'Indica se o usuário ativou o opt-in de notificações push no navegador.';
COMMENT ON COLUMN public.perfis.push_subscription IS 'Estrutura JSON com o endpoint, chaves criptográficas (p256dh, auth) e tokens da inscrição.';
