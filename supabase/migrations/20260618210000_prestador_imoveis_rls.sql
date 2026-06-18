-- =========================================================================
-- MIGRAÇÃO: PERMISSÃO PARA PRESTADORES VISUALIZAREM IMÓVEIS COM CHAMADOS ATIVOS
-- =========================================================================

-- 1. Cria a função SECURITY DEFINER para verificar se o prestador tem acesso ao imóvel
CREATE OR REPLACE FUNCTION public.can_prestador_access_imovel(p_imovel_id UUID, p_prestador_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.imovel_id = p_imovel_id AND (
      c.status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
      OR EXISTS (
        SELECT 1 FROM public.orcamentos o
        WHERE o.chamado_id = c.id AND o.prestador_id = p_prestador_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.can_prestador_access_imovel IS 'Verifica se o prestador tem chamado aberto/atribuído associado ao imóvel, ignorando RLS.';

-- 2. Cria a política RLS na tabela public.imoveis
DROP POLICY IF EXISTS "Prestadores visualizam imóveis com chamados ativos" ON public.imoveis;
CREATE POLICY "Prestadores visualizam imóveis com chamados ativos"
  ON public.imoveis FOR SELECT TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_prestador_access_imovel(id, auth.uid())
  );
