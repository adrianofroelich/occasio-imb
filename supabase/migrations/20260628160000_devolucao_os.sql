-- =========================================================================
-- MIGRAÇÃO: DEVOLUÇÃO DE ORDEM DE SERVIÇO (OS) PELO TÉCNICO DE CAMPO
-- =========================================================================

-- 1. Adiciona colunas na tabela public.chamados para registrar devoluções anteriores
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS devolvido_anteriormente BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS ultima_devolucao_justificativa TEXT;

COMMENT ON COLUMN public.chamados.devolvido_anteriormente IS 'Indica se esta OS já foi devolvida anteriormente por algum técnico de campo.';
COMMENT ON COLUMN public.chamados.ultima_devolucao_justificativa IS 'Guarda a justificativa da última devolução realizada.';

-- 2. Criação da RPC para processar a devolução com SECURITY DEFINER para contornar RLS
CREATE OR REPLACE FUNCTION public.devolver_chamado(
  p_chamado_id UUID,
  p_justificativa TEXT
)
RETURNS VOID AS $$
DECLARE
  v_tecnico_nome TEXT;
  v_status_anterior status_chamado;
  v_tecnico_id UUID;
BEGIN
  -- A. Obtém dados atuais do chamado
  SELECT status, tecnico_id INTO v_status_anterior, v_tecnico_id
  FROM public.chamados
  WHERE id = p_chamado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  -- B. Valida se o técnico atribuído é o usuário autenticado que invocou a função
  IF v_tecnico_id IS NULL OR v_tecnico_id <> auth.uid() THEN
    RAISE EXCEPTION 'Você não é o técnico designado para esta Ordem de Serviço.';
  END IF;

  -- C. Valida se o chamado está em status elegível para devolução (os_liberada ou em_execucao)
  IF v_status_anterior NOT IN ('os_liberada'::status_chamado, 'em_execucao'::status_chamado) THEN
    RAISE EXCEPTION 'O chamado não está em um status que permite devolução.';
  END IF;

  -- D. Valida tamanho mínimo da justificativa
  IF char_length(trim(p_justificativa)) < 10 THEN
    RAISE EXCEPTION 'A justificativa de devolução deve conter no mínimo 10 caracteres.';
  END IF;

  -- E. Obtém o nome do técnico para registrar na auditoria
  SELECT nome INTO v_tecnico_nome
  FROM public.perfis
  WHERE id = v_tecnico_id;

  -- F. Atualiza o chamado desvinculando o técnico, resetando status e marcando a devolução
  UPDATE public.chamados
  SET tecnico_id = NULL,
      status = 'os_liberada'::status_chamado,
      devolvido_anteriormente = TRUE,
      ultima_devolucao_justificativa = trim(p_justificativa),
      atualizado_em = NOW()
  WHERE id = p_chamado_id;

  -- G. Registra log detalhado no histórico de auditoria
  INSERT INTO public.historico_chamados (
    chamado_id,
    usuario_id,
    status_anterior,
    novo_status,
    observacao
  ) VALUES (
    p_chamado_id,
    v_tecnico_id,
    v_status_anterior,
    'os_liberada'::status_chamado,
    'OS devolvida pelo técnico ' || v_tecnico_nome || '. Justificativa: ' || trim(p_justificativa)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.devolver_chamado(UUID, TEXT) IS 'Processa a devolução de uma OS pelo técnico de campo, limpando o responsável, registrando a justificativa no histórico de auditoria e sinalizando a devolução.';
