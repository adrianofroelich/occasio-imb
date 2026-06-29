-- Migração: Adiciona colunas para Contato de Recebimento no Imóvel
-- Criado em: 29/06/2026

-- 1. Adicionar colunas recebedor_nome e recebedor_telefone na tabela public.chamados
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS recebedor_nome TEXT,
ADD COLUMN IF NOT EXISTS recebedor_telefone TEXT;

-- 2. Atualizar a RPC get_chamado_public_details para retornar os novos campos
CREATE OR REPLACE FUNCTION public.get_chamado_public_details(p_chamado_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'titulo', c.titulo,
    'descricao_problema', c.descricao_problema,
    'categoria', cat.nome, -- Retorna o nome da categoria no JSON para compatibilidade com o frontend
    'disponibilidade_atendimento', c.disponibilidade_atendimento,
    'status', c.status,
    'responsabilidade', c.responsabilidade,
    'criado_em', c.criado_em,
    'imagens_problema', c.imagens_problema,
    'imagens_solucao', c.imagens_solucao,
    'recebedor_nome', c.recebedor_nome,
    'recebedor_telefone', c.recebedor_telefone,
    'imovel', jsonb_build_object(
      'codigo_imovel', i.codigo_imovel,
      'endereco', i.endereco,
      'bairro', i.bairro,
      'cidade', i.cidade,
      'estado', i.estado,
      'cep', i.cep,
      'limite_alcada_r$', i.limite_alcada_r$,
      'proprietario', CASE WHEN prop.id IS NOT NULL THEN jsonb_build_object(
        'nome', prop.nome,
        'telefone', prop.telefone,
        'aceita_painel_digital', prop.aceita_painel_digital
      ) ELSE NULL END
    ),
    'inquilino', jsonb_build_object(
      'nome', inq.nome,
      'telefone', inq.telefone
    ),
    'imobiliaria', CASE WHEN imob.id IS NOT NULL THEN jsonb_build_object(
      'nome', imob.nome,
      'logo_url', imob.logo_url
    ) ELSE NULL END,
    'orcamentos', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'valor_servico_r$', o.valor_servico_r$,
            'valor_materiais_r$', o.valor_materiais_r$,
            'valor_total_r$', o.valor_total_r$,
            'prazo_execucao_dias', o.prazo_execucao_dias,
            'observacoes_tecnicas', o.observacoes_tecnicas,
            'relatorio_conclusao', o.relatorio_conclusao,
            'homologado_pela_empresa', o.homologado_pela_empresa,
            'prestador', jsonb_build_object('nome', prest.nome)
          )
        )
        FROM public.orcamentos o
        LEFT JOIN public.perfis prest ON prest.id = o.prestador_id
        WHERE o.chamado_id = c.id
      ),
      '[]'::jsonb
    ),
    'historico', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'status_anterior', h.status_anterior,
            'status_novo', h.novo_status,
            'observacao', h.observacao,
            'criado_em', h.criado_em,
            'criado_por_nome', p_hist.nome
          )
          ORDER BY h.criado_em DESC
        )
        FROM public.historico_chamados h
        LEFT JOIN public.perfis p_hist ON p_hist.id = h.usuario_id
        WHERE h.chamado_id = c.id
      ),
      '[]'::jsonb
    )
  ) INTO v_result
  FROM public.chamados c
  LEFT JOIN public.categorias cat ON cat.id = c.categoria
  LEFT JOIN public.imoveis i ON i.id = c.imovel_id
  LEFT JOIN public.perfis imob ON imob.id = i.imobiliaria_id
  LEFT JOIN public.perfis prop ON prop.id = i.proprietario_id
  LEFT JOIN public.perfis inq ON inq.id = c.inquilino_id
  WHERE c.id = p_chamado_id;

  RETURN v_result;
END;
$$;
