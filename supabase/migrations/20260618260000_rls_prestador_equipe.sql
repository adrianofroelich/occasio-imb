-- =========================================================================
-- MIGRAÇÃO: RLS PERMISSÃO DE EDIÇÃO DE TÉCNICOS PELA EMPRESA PRESTADORA PJ
-- =========================================================================

-- Permite que a Empresa Prestadora (conta-mãe) atualize os registros públicos de seus técnicos vinculados
DROP POLICY IF EXISTS "Empresas mães atualizam perfis de seus técnicos" ON public.perfis;
CREATE POLICY "Empresas mães atualizam perfis de seus técnicos"
  ON public.perfis FOR UPDATE TO authenticated
  USING (empresa_mae_id = auth.uid())
  WITH CHECK (empresa_mae_id = auth.uid());
