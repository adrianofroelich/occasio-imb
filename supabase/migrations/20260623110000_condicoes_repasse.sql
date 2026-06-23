-- =========================================================================
-- MIGRAÇÃO: ADIÇÃO DE CONDIÇÕES DE REPASSE FINANCEIRO
-- =========================================================================

-- 1. Criação do ENUM tipo_repasse se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_repasse') THEN
    CREATE TYPE public.tipo_repasse AS ENUM ('mensal', 'quinzenal', 'semanal', 'por_servico');
  END IF;
END
$$;

-- 2. Modificações na tabela public.perfis
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS tipo_repasse public.tipo_repasse;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS prazo_repasse_dias INTEGER;

COMMENT ON COLUMN public.perfis.tipo_repasse IS 'Tipo de repasse financeiro pactuado (mensal, quinzenal, semanal, por_servico).';
COMMENT ON COLUMN public.perfis.prazo_repasse_dias IS 'Regra numérica do repasse (dia do repasse no mês, ou prazo em dias após fechamento/entrega).';

-- 3. Modificações na tabela public.chamados
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ;
COMMENT ON COLUMN public.chamados.data_conclusao IS 'Data e hora exata em que o status do chamado foi alterado para concluído.';

-- 4. Função e trigger para automatizar data_conclusao
CREATE OR REPLACE FUNCTION public.set_data_conclusao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'servico_concluido' AND (OLD.status IS DISTINCT FROM 'servico_concluido') THEN
    NEW.data_conclusao := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_data_conclusao ON public.chamados;
CREATE TRIGGER trg_set_data_conclusao
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW
  EXECUTE FUNCTION public.set_data_conclusao();

-- 5. Atualiza retroativamente chamados concluídos/encerrados existentes
UPDATE public.chamados
SET data_conclusao = atualizado_em
WHERE status IN ('servico_concluido', 'encerrado') AND data_conclusao IS NULL;

-- 6. Atualização do trigger autocadastro handle_new_user()
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

  INSERT INTO public.perfis (
    id, nome, email, telefone, perfil, documento_identificacao, primeiro_acesso_pendente, 
    empresa_mae_id, categorias, creci, cep, endereco, bairro, cidade, estado, 
    tipo_repasse, prazo_repasse_dias, criado_em, atualizado_em
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
    NOW(), 
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
