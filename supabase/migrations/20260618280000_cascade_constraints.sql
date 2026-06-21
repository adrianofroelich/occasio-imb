-- =========================================================================
-- MIGRAÇÃO: ATUALIZAÇÃO DE CHAVES ESTRANGEIRAS PARA EXCLUSÃO EM CASCATA
-- =========================================================================

-- 1. Remove as constraints antigas que impediam exclusões (RESTRICT)
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_imobiliaria_id_fkey;
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_imovel_id_fkey;
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_prestador_id_fkey;

-- 2. Adiciona as novas constraints com ON DELETE CASCADE
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_imobiliaria_id_fkey
  FOREIGN KEY (imobiliaria_id)
  REFERENCES public.perfis(id)
  ON DELETE CASCADE;

ALTER TABLE public.chamados
  ADD CONSTRAINT chamados_imovel_id_fkey
  FOREIGN KEY (imovel_id)
  REFERENCES public.imoveis(id)
  ON DELETE CASCADE;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_prestador_id_fkey
  FOREIGN KEY (prestador_id)
  REFERENCES public.perfis(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT imoveis_imobiliaria_id_fkey ON public.imoveis IS 'Remove automaticamente os imóveis associados ao deletar o perfil da imobiliária.';
COMMENT ON CONSTRAINT chamados_imovel_id_fkey ON public.chamados IS 'Remove automaticamente os chamados associados ao deletar o imóvel.';
COMMENT ON CONSTRAINT orcamentos_prestador_id_fkey ON public.orcamentos IS 'Remove automaticamente os orçamentos do prestador ao deletar o seu perfil.';
