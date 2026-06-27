-- Migração para adicionar suporte a proprietários híbridos (WhatsApp/telefone)
-- Criado em: 2026-06-27

-- 1. Adicionar coluna aceita_painel_digital no perfil do usuário
ALTER TABLE public.perfis ADD COLUMN aceita_painel_digital BOOLEAN DEFAULT TRUE;

-- 2. Atualizar a função do trigger handle_new_user() para persistir esta preferência a partir do auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nome TEXT;
  v_perfil tipo_perfil;
  v_telefone TEXT;
  v_documento TEXT;
  v_primeiro_acesso BOOLEAN;
  v_empresa_mae_id UUID;
  v_categorias TEXT[];
  v_creci TEXT;
  v_cep TEXT;
  v_endereco TEXT;
  v_bairro TEXT;
  v_cidade TEXT;
  v_estado VARCHAR(2);
  v_tipo_repasse public.tipo_repasse;
  v_prazo_repasse_dias INTEGER;
  v_aceita_painel_digital BOOLEAN;
BEGIN
  -- Extrai os metadados enviados no cadastro de forma segura
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'full_name',
    'Novo Usuário'
  );
  
  -- Converte o perfil com fallback seguro para inquilino
  BEGIN
    v_perfil := (NEW.raw_user_meta_data->>'perfil')::tipo_perfil;
  EXCEPTION WHEN OTHERS THEN
    v_perfil := 'inquilino'::tipo_perfil;
  END;

  v_telefone := NEW.raw_user_meta_data->>'telefone';
  v_documento := NEW.raw_user_meta_data->>'documento_identificacao';
  
  -- Determina se é primeiro acesso pendente
  BEGIN
    v_primeiro_acesso := COALESCE((NEW.raw_user_meta_data->>'primeiro_acesso_pendente')::boolean, true);
  EXCEPTION WHEN OTHERS THEN
    v_primeiro_acesso := true;
  END;

  -- Extrai empresa_mae_id se houver
  BEGIN
    v_empresa_mae_id := (NEW.raw_user_meta_data->>'empresa_mae_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_empresa_mae_id := NULL;
  END;

  -- Extrai categorias se houver (JSON array para text array)
  BEGIN
    IF NEW.raw_user_meta_data ? 'categorias' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'categorias')) INTO v_categorias;
    ELSE
      v_categorias := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_categorias := NULL;
  END;

  -- Extrai os novos campos de creci e endereço
  v_creci := NEW.raw_user_meta_data->>'creci';
  v_cep := NEW.raw_user_meta_data->>'cep';
  v_endereco := NEW.raw_user_meta_data->>'endereco';
  v_bairro := NEW.raw_user_meta_data->>'bairro';
  v_cidade := NEW.raw_user_meta_data->>'cidade';
  v_estado := NEW.raw_user_meta_data->>'estado';

  -- Extrai tipo_repasse se houver
  BEGIN
    IF NEW.raw_user_meta_data ? 'tipo_repasse' AND NEW.raw_user_meta_data->>'tipo_repasse' IS NOT NULL AND NEW.raw_user_meta_data->>'tipo_repasse' <> '' THEN
      v_tipo_repasse := (NEW.raw_user_meta_data->>'tipo_repasse')::public.tipo_repasse;
    ELSE
      v_tipo_repasse := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_tipo_repasse := NULL;
  END;

  -- Extrai prazo_repasse_dias se houver
  BEGIN
    IF NEW.raw_user_meta_data ? 'prazo_repasse_dias' AND NEW.raw_user_meta_data->>'prazo_repasse_dias' IS NOT NULL AND NEW.raw_user_meta_data->>'prazo_repasse_dias' <> '' THEN
      v_prazo_repasse_dias := (NEW.raw_user_meta_data->>'prazo_repasse_dias')::INTEGER;
    ELSE
      v_prazo_repasse_dias := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_prazo_repasse_dias := NULL;
  END;

  -- Extrai aceita_painel_digital se houver
  BEGIN
    IF NEW.raw_user_meta_data ? 'aceita_painel_digital' THEN
      v_aceita_painel_digital := (NEW.raw_user_meta_data->>'aceita_painel_digital')::BOOLEAN;
    ELSE
      v_aceita_painel_digital := TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_aceita_painel_digital := TRUE;
  END;

  INSERT INTO public.perfis (
    id, nome, email, telefone, perfil, documento_identificacao, primeiro_acesso_pendente, 
    empresa_mae_id, categorias, creci, cep, endereco, bairro, cidade, estado, 
    tipo_repasse, prazo_repasse_dias, aceita_painel_digital, criado_em, atualizado_em
  )
  VALUES (
    NEW.id, 
    v_nome, 
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'), 
    v_telefone, 
    v_perfil, 
    v_documento, 
    v_primeiro_acesso, 
    v_empresa_mae_id,
    v_categorias,
    v_creci,
    v_cep,
    v_endereco,
    v_bairro,
    v_cidade,
    v_estado,
    v_tipo_repasse,
    v_prazo_repasse_dias,
    v_aceita_painel_digital,
    NOW(), 
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Criar função RPC segura get_chamado_public_details para consulta anônima da tela de impressão
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
  JOIN public.imoveis i ON i.id = c.imovel_id
  LEFT JOIN public.perfis prop ON prop.id = i.proprietario_id
  JOIN public.perfis inq ON inq.id = c.inquilino_id
  WHERE c.id = p_chamado_id;

  RETURN v_result;
END;
$$;
