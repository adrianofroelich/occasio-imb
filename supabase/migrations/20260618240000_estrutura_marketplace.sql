-- =========================================================================
-- MIGRAÇÃO: ESTRUTURA PARA MODELO DE MARKETPLACE (SUB-GESTÃO DE TÉCNICOS)
-- =========================================================================

-- 1. Modificações na tabela public.perfis
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS empresa_mae_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS categorias TEXT[];

COMMENT ON COLUMN public.perfis.empresa_mae_id IS 'Indica a empresa prestadora (conta-mãe) à qual este técnico está vinculado.';
COMMENT ON COLUMN public.perfis.categorias IS 'Especialidades/categorias atendidas por este técnico (ex: Elétrica, Hidráulica).';

-- 2. Criação da tabela de Vínculos Comerciais (SaaS)
CREATE TABLE IF NOT EXISTS public.vinculos_saas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  empresa_prestadora_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT unico_vinculo UNIQUE (imobiliaria_id, empresa_prestadora_id)
);

COMMENT ON TABLE public.vinculos_saas IS 'Associação comercial entre imobiliárias e empresas prestadoras de serviço (controlado pelo Super Admin).';

-- Habilita RLS na tabela de vínculos
ALTER TABLE public.vinculos_saas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para vinculos_saas
DROP POLICY IF EXISTS "Super Admins gerenciam vinculos" ON public.vinculos_saas;
CREATE POLICY "Super Admins gerenciam vinculos"
  ON public.vinculos_saas TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Imobiliarias e Empresas visualizam seus vinculos" ON public.vinculos_saas;
CREATE POLICY "Imobiliarias e Empresas visualizam seus vinculos"
  ON public.vinculos_saas FOR SELECT TO authenticated
  USING (
    imobiliaria_id = auth.uid()
    OR empresa_prestadora_id = auth.uid()
  );

-- 3. Modificações na tabela public.chamados
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS empresa_prestadora_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS tecnico_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chamados.empresa_prestadora_id IS 'Empresa prestadora responsável pela OS.';
COMMENT ON COLUMN public.chamados.tecnico_id IS 'Técnico de campo designado pela Empresa Prestadora para realizar o serviço.';

-- 4. Modificação na tabela public.orcamentos
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS homologado_pela_empresa BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.orcamentos.homologado_pela_empresa IS 'Sinaliza se a Empresa Prestadora revisou e autorizou os valores enviados pelo técnico.';

-- 5. Atualização das Funções Auxiliares SECURITY DEFINER

-- Drops para evitar conflitos de assinaturas/parâmetros no PostgreSQL
DROP FUNCTION IF EXISTS public.can_user_access_chamado(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_prestador_access_imovel(UUID, UUID) CASCADE;

-- Atualiza can_user_access_chamado para lidar com Empresa e Técnico
CREATE OR REPLACE FUNCTION public.can_user_access_chamado(p_chamado_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_perfil tipo_perfil;
  v_inquilino_id UUID;
  v_imovel_id UUID;
  v_status status_chamado;
  v_empresa_prestadora_id UUID;
  v_tecnico_id UUID;
BEGIN
  -- Obtém perfil do usuário
  SELECT perfil INTO v_perfil FROM public.perfis WHERE id = p_user_id;
  
  -- Se for super admin, tem acesso irrestrito
  IF v_perfil = 'super_admin'::tipo_perfil THEN
    RETURN TRUE;
  END IF;

  -- Obtém dados do chamado
  SELECT inquilino_id, imovel_id, status, empresa_prestadora_id, tecnico_id 
  INTO v_inquilino_id, v_imovel_id, v_status, v_empresa_prestadora_id, v_tecnico_id
  FROM public.chamados WHERE id = p_chamado_id;

  -- Verifica acesso conforme perfil
  IF v_perfil = 'inquilino'::tipo_perfil THEN
    RETURN v_inquilino_id = p_user_id;
  ELSIF v_perfil = 'imobiliaria'::tipo_perfil THEN
    RETURN EXISTS (
      SELECT 1 FROM public.imoveis WHERE id = v_imovel_id AND imobiliaria_id = p_user_id
    );
  ELSIF v_perfil = 'proprietario'::tipo_perfil THEN
    RETURN EXISTS (
      SELECT 1 FROM public.imoveis WHERE id = v_imovel_id AND proprietario_id = p_user_id
    );
  ELSIF v_perfil = 'prestador'::tipo_perfil THEN
    RETURN (
      v_empresa_prestadora_id = p_user_id 
      OR v_tecnico_id = p_user_id
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atualiza can_prestador_access_imovel para o novo fluxo
CREATE OR REPLACE FUNCTION public.can_prestador_access_imovel(p_imovel_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chamados c
    WHERE c.imovel_id = p_imovel_id AND (
      c.empresa_prestadora_id = p_user_id
      OR c.tecnico_id = p_user_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Recriação das Políticas RLS baseadas nos novos relacionamentos

-- A) POLÍTICAS NA TABELA public.chamados
DROP POLICY IF EXISTS "Prestadores visualizam chamados disponíveis ou atribuídos" ON public.chamados;
CREATE POLICY "Prestadores visualizam chamados disponíveis ou atribuídos"
  ON public.chamados FOR SELECT TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND (
      empresa_prestadora_id = auth.uid()
      OR tecnico_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Prestadores atualizam chamados atribuídos ou em cotação" ON public.chamados;
CREATE POLICY "Prestadores atualizam chamados atribuídos ou em cotação"
  ON public.chamados FOR UPDATE TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_user_access_chamado(id, auth.uid())
  )
  WITH CHECK (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_user_access_chamado(id, auth.uid())
  );

-- B) POLÍTICAS NA TABELA public.orcamentos
DROP POLICY IF EXISTS "Prestadores e Empresas leem seus orçamentos" ON public.orcamentos;
CREATE POLICY "Prestadores e Empresas leem seus orçamentos"
  ON public.orcamentos FOR SELECT TO authenticated
  USING (
    prestador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id AND c.empresa_prestadora_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Prestadores inserem propostas em chamados abertos" ON public.orcamentos;
CREATE POLICY "Prestadores inserem propostas em chamados abertos"
  ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (
    prestador_id = auth.uid() AND
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.is_chamado_aberto_para_orcamento(chamado_id)
  );

DROP POLICY IF EXISTS "Prestadores e Empresas atualizam orçamentos vinculados" ON public.orcamentos;
CREATE POLICY "Prestadores e Empresas atualizam orçamentos vinculados"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (
    prestador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id AND c.empresa_prestadora_id = auth.uid()
    )
  )
  WITH CHECK (
    (
      prestador_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.chamados c
        WHERE c.id = chamado_id AND c.empresa_prestadora_id = auth.uid()
      )
    ) AND
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_user_access_chamado(chamado_id, auth.uid())
  );

-- C) POLÍTICAS NA TABELA public.imoveis (re-vincula com a nova lógica can_prestador_access_imovel)
DROP POLICY IF EXISTS "Prestadores visualizam imóveis com chamados ativos" ON public.imoveis;
CREATE POLICY "Prestadores visualizam imóveis com chamados ativos"
  ON public.imoveis FOR SELECT TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.can_prestador_access_imovel(id, auth.uid())
  );

-- 7. Atualização do autocadastro (Trigger handle_new_user)
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

  INSERT INTO public.perfis (
    id, nome, email, telefone, perfil, documento_identificacao, primeiro_acesso_pendente, empresa_mae_id, categorias, criado_em, atualizado_em
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
    NOW(), 
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
