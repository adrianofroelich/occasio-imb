-- =========================================================================
-- MIGRATION: 20260618180000_proprietario_rls.sql
-- Adiciona políticas de Row Level Security (RLS) para o perfil de Proprietário
-- Permitindo atualização de status de chamados e inserção no histórico de auditoria
-- =========================================================================

-- 1. Permitir que proprietários atualizem status de chamados vinculados aos seus imóveis
-- Esta política permite que o proprietário aprove, reprove ou solicite esclarecimentos, mudando o status.
CREATE POLICY "Proprietários atualizam chamados de seus imóveis"
  ON public.chamados FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = imovel_id AND i.proprietario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = imovel_id AND i.proprietario_id = auth.uid()
    )
  );

-- 2. Permitir que proprietários insiram registros no histórico de chamados (auditoria)
-- Esta política permite que o proprietário salve a justificativa ou registro de sua ação no histórico.
CREATE POLICY "Proprietários criam histórico de ações para seus chamados"
  ON public.historico_chamados FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chamados c
      JOIN public.imoveis i ON i.id = c.imovel_id
      WHERE c.id = chamado_id AND i.proprietario_id = auth.uid()
    )
  );
