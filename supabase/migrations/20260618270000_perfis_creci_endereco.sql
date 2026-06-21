-- =========================================================================
-- MIGRAÇÃO: ADIÇÃO DE CRECI E ENDEREÇO NA TABELA PERFIS E ATUALIZAÇÃO DO TRIGGER
-- =========================================================================

-- 1. Modificações na tabela public.perfis
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS creci TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS estado VARCHAR(2);

COMMENT ON COLUMN public.perfis.creci IS 'Número do CRECI (exclusivo para imobiliárias/corretores).';
COMMENT ON COLUMN public.perfis.cep IS 'CEP do endereço do perfil.';
COMMENT ON COLUMN public.perfis.endereco IS 'Logradouro e número do perfil.';
COMMENT ON COLUMN public.perfis.bairro IS 'Bairro do perfil.';
COMMENT ON COLUMN public.perfis.cidade IS 'Cidade do perfil.';
COMMENT ON COLUMN public.perfis.estado IS 'Estado do perfil.';

-- 2. Atualização do autocadastro (Trigger handle_new_user)
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

  INSERT INTO public.perfis (
    id, nome, email, telefone, perfil, documento_identificacao, primeiro_acesso_pendente, 
    empresa_mae_id, categorias, creci, cep, endereco, bairro, cidade, estado, 
    criado_em, atualizado_em
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
    NOW(), 
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
