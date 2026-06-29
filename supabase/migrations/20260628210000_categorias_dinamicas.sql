-- Migration: Categorias Dinâmicas
-- Autor: Antigravity
-- Data: 2026-06-28

-- 1. Criar tabela public.categorias
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS
CREATE POLICY "Permitir leitura para todos autenticados" ON public.categorias
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção para super_admin" ON public.categorias
    FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

CREATE POLICY "Permitir atualização para super_admin" ON public.categorias
    FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Permitir exclusão para super_admin" ON public.categorias
    FOR DELETE TO authenticated USING (public.is_super_admin());

-- 4. Seed inicial de categorias padrão
INSERT INTO public.categorias (nome, descricao) VALUES
    ('Elétrica', 'Instalações elétricas, tomadas, disjuntores, chuveiros, curto-circuitos'),
    ('Hidráulica', 'Vazamentos, infiltrações, canos quebrados, torneiras, registros'),
    ('Pintura', 'Pintura de paredes, tetos, portas, reparos de acabamento'),
    ('Alvenaria', 'Rachaduras, infiltrações estruturais, reparos em alvenaria e reboco'),
    ('Serralheria', 'Reparos em portas, portões, janelas, fechaduras e esquadrias'),
    ('Outros', 'Reparos diversos não contemplados nas outras categorias')
ON CONFLICT (nome) DO NOTHING;

-- 5. Mapear a coluna categoria na tabela public.chamados para ser chave estrangeira
-- 5.1 Adicionar coluna temporária de UUID
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias(id) ON DELETE RESTRICT;

-- 5.2 Mapear dados existentes baseados no texto
UPDATE public.chamados c
SET categoria_id = (
    SELECT id FROM public.categorias
    WHERE nome = CASE
        WHEN c.categoria = 'Elétrica' THEN 'Elétrica'
        WHEN c.categoria = 'Hidráulica' THEN 'Hidráulica'
        WHEN c.categoria = 'Pintura' THEN 'Pintura'
        WHEN c.categoria IN ('Alvenaria', 'Reparos', 'Reparos e Alvenaria', 'Alvenaria/Estrutura') THEN 'Alvenaria'
        WHEN c.categoria = 'Serralheria' THEN 'Serralheria'
        ELSE 'Outros'
    END
);

-- 5.3 Garantir que não existam nulos
UPDATE public.chamados
SET categoria_id = (SELECT id FROM public.categorias WHERE nome = 'Outros')
WHERE categoria_id IS NULL;

-- 5.4 Definir NOT NULL na coluna temporária
ALTER TABLE public.chamados ALTER COLUMN categoria_id SET NOT NULL;

-- 5.5 Remover coluna de texto antiga
ALTER TABLE public.chamados DROP COLUMN categoria;

-- 5.6 Renomear coluna temporária para o nome oficial
ALTER TABLE public.chamados RENAME COLUMN categoria_id TO categoria;

-- 6. Atualizar RPC get_chamado_public_details
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
