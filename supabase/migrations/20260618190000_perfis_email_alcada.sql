-- =========================================================================
-- MIGRAÇÃO: ADIÇÃO DE E-MAIL E PRIMEIRO ACESSO EM PERFIS
-- =========================================================================

-- Adiciona colunas na tabela public.perfis
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS primeiro_acesso_pendente BOOLEAN DEFAULT TRUE;

-- Popula os e-mails dos usuários já cadastrados em auth.users
UPDATE public.perfis p
SET email = u.email,
    primeiro_acesso_pendente = FALSE
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Atualiza a função trigger handle_new_user para registrar e-mail e primeiro_acesso_pendente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nome TEXT;
  v_perfil tipo_perfil;
  v_telefone TEXT;
  v_documento TEXT;
  v_primeiro_acesso BOOLEAN;
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

  INSERT INTO public.perfis (id, nome, email, telefone, perfil, documento_identificacao, primeiro_acesso_pendente, criado_em, atualizado_em)
  VALUES (
    NEW.id, 
    v_nome, 
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'), 
    v_telefone, 
    v_perfil, 
    v_documento, 
    v_primeiro_acesso, 
    NOW(), 
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.handle_new_user() IS 'Sincroniza novos cadastros em auth.users para a tabela public.perfis automaticamente com suporte a e-mail e primeiro acesso.';
