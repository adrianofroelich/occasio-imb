-- =========================================================================
-- MIGRAÇÃO: AJUSTE DE RLS EM ORÇAMENTOS PARA PERMITIR CONCLUSÃO DE SERVIÇO
-- =========================================================================

-- Remove a política genérica anterior
DROP POLICY IF EXISTS "Prestadores gerenciam seus orçamentos" ON public.orcamentos;

-- 1. Permissão de SELECT: Prestadores visualizam apenas seus próprios orçamentos
CREATE POLICY "Prestadores leem seus próprios orçamentos"
  ON public.orcamentos FOR SELECT TO authenticated
  USING (prestador_id = auth.uid());

-- 2. Permissão de INSERT: Prestadores criam orçamento apenas se o chamado estiver aberto para cotação
CREATE POLICY "Prestadores inserem propostas em chamados abertos"
  ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (
    prestador_id = auth.uid() AND
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.is_chamado_aberto_para_orcamento(chamado_id)
  );

-- 3. Permissão de UPDATE: Prestadores atualizam seus próprios orçamentos (como data de agendamento e relatório de conclusão)
CREATE POLICY "Prestadores atualizam seus orçamentos vinculados"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (prestador_id = auth.uid())
  WITH CHECK (
    prestador_id = auth.uid() AND
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_user_access_chamado(chamado_id, auth.uid())
  );

COMMENT ON POLICY "Prestadores leem seus próprios orçamentos" ON public.orcamentos IS 'Permite ler apenas as próprias propostas.';
COMMENT ON POLICY "Prestadores inserem propostas em chamados abertos" ON public.orcamentos IS 'Permite criar propostas apenas em chamados aguardando cotação.';
COMMENT ON POLICY "Prestadores atualizam seus orçamentos vinculados" ON public.orcamentos IS 'Permite agendar execução ou enviar relatório de conclusão do serviço.';
