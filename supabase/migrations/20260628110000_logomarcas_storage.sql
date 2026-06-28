-- =========================================================================
-- MIGRAÇÃO PARA PERSONALIZAÇÃO DE MARCA (UPLOAD DE LOGOMARCAS COM COMPRESSÃO)
-- Data: 2026-06-28
-- =========================================================================

-- 1. Adiciona o campo logo_url na tabela public.perfis se ele ainda não existir
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;

-- 2. Criação do Bucket 'logomarcas' público para as identidades visuais
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logomarcas', 
  'logomarcas', 
  true, 
  2097152, -- Limite estrito de 2MB por arquivo (2 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/jpg'] -- Apenas formatos solicitados
)
ON CONFLICT (id) DO NOTHING;

-- 3. Definição de Políticas de RLS para o bucket 'logomarcas'
-- Remove políticas anteriores para evitar qualquer conflito de deploy
DROP POLICY IF EXISTS "Leitura publica de logomarcas" ON storage.objects;
DROP POLICY IF EXISTS "Upload e gerenciamento de logomarcas por perfil ou admin" ON storage.objects;

-- Qualquer usuário (anônimo ou autenticado) pode visualizar as logomarcas públicas
CREATE POLICY "Leitura publica de logomarcas"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'logomarcas');

-- Permite que usuários autenticados gravem, atualizem ou excluam mídias nas pastas correspondentes 
-- ao seu próprio ID de usuário, ou que administradores super_admin gerenciem qualquer pasta
CREATE POLICY "Upload e gerenciamento de logomarcas por perfil ou admin"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'logomarcas' AND (
      split_part(name, '/', 1) = auth.uid()::text OR 
      EXISTS (
        SELECT 1 FROM public.perfis 
        WHERE perfis.id = auth.uid() 
        AND perfis.perfil = 'super_admin'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'logomarcas' AND (
      split_part(name, '/', 1) = auth.uid()::text OR 
      EXISTS (
        SELECT 1 FROM public.perfis 
        WHERE perfis.id = auth.uid() 
        AND perfis.perfil = 'super_admin'
      )
    )
  );

-- 4. Atualização da RPC get_chamado_public_details para expor os dados da imobiliária
-- Isso permite exibir a marca e nome corretos na tela de impressão pública ChamadoPrint.tsx
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
    'categoria', c.categoria,
    'disponibilidade_atendimento', c.disponibilidade_atendimento,
    'status', c.status,
    'responsabilidade', c.responsabilidade,
    'criado_em', c.criado_em,
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
  LEFT JOIN public.imoveis i ON i.id = c.imovel_id
  LEFT JOIN public.perfis imob ON imob.id = i.imobiliaria_id
  LEFT JOIN public.perfis prop ON prop.id = i.proprietario_id
  LEFT JOIN public.perfis inq ON inq.id = c.inquilino_id
  WHERE c.id = p_chamado_id;

  RETURN v_result;
END;
$$;
