-- =========================================================================
-- HABILITAÇÃO DE REALTIME PARA A TABELA DE CHAMADOS
-- Permite que o Supabase envie eventos em tempo real para os clientes conectados
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados;
