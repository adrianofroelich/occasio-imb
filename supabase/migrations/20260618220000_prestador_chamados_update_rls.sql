-- =========================================================================
-- MIGRAÇÃO: PERMISSÃO PARA PRESTADORES ATUALIZAREM STATUS DE CHAMADOS
-- =========================================================================

-- Cria a política RLS para permitir UPDATE na tabela public.chamados por prestadores
DROP POLICY IF EXISTS "Prestadores atualizam chamados atribuídos ou em cotação" ON public.chamados;
CREATE POLICY "Prestadores atualizam chamados atribuídos ou em cotação"
  ON public.chamados FOR UPDATE TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_user_access_chamado(id, auth.uid())
  )
  WITH CHECK (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_user_access_chamado(id, auth.uid())
  );

COMMENT ON POLICY "Prestadores atualizam chamados atribuídos ou em cotação" ON public.chamados 
  IS 'Permite que prestadores alterem status dos chamados que estão em cotação aberta ou que possuem orçamento vinculado.';
