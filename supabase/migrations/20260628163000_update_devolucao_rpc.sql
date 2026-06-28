-- =========================================================================
-- MIGRAÇÃO: ATUALIZAÇÃO DA RPC DE DEVOLUÇÃO PARA ATENDER FASE DE ORÇAMENTO
-- =========================================================================

CREATE OR REPLACE FUNCTION public.devolver_chamado(
  p_chamado_id UUID,
  p_justificativa TEXT
)
RETURNS VOID AS $$
DECLARE
  v_tecnico_nome TEXT;
  v_status_anterior status_chamado;
  v_tecnico_id UUID;
  v_novo_status status_chamado;
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

  -- C. Valida se o chamado está em status elegível para devolução
  IF v_status_anterior NOT IN ('aguardando_orcamento'::status_chamado, 'os_liberada'::status_chamado, 'em_execucao'::status_chamado) THEN
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

  -- Define o novo status: se for em_execucao, volta para os_liberada. Caso contrário, mantém o anterior.
  IF v_status_anterior = 'em_execucao'::status_chamado THEN
    v_novo_status := 'os_liberada'::status_chamado;
  ELSE
    v_novo_status := v_status_anterior;
  END IF;

  -- F. Atualiza o chamado desvinculando o técnico, definindo o status e marcando a devolução
  UPDATE public.chamados
  SET tecnico_id = NULL,
      status = v_novo_status,
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
    v_novo_status,
    'OS devolvida pelo técnico ' || v_tecnico_nome || ' na fase de ' || 
    CASE 
      WHEN v_status_anterior = 'aguardando_orcamento'::status_chamado THEN 'vistoria/cotação'
      ELSE 'execução'
    END || '. Justificativa: ' || trim(p_justificativa)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
