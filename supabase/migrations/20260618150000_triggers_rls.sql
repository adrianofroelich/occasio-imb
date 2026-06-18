-- =========================================================================
-- FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER)
-- Evitam recursão infinita nas políticas de Row Level Security (RLS)
-- =========================================================================

-- Função para verificar se o usuário ativo é super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND perfil = 'super_admin'::tipo_perfil
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_super_admin IS 'Verifica se o usuário autenticado é um Super Administrador (bypassa RLS).';

-- Função para obter o tipo de perfil do usuário ativo
CREATE OR REPLACE FUNCTION public.get_user_perfil()
RETURNS tipo_perfil AS $$
DECLARE
  v_perfil tipo_perfil;
BEGIN
  SELECT perfil INTO v_perfil FROM public.perfis WHERE id = auth.uid();
  RETURN v_perfil;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.get_user_perfil IS 'Retorna o perfil (tipo_perfil) do usuário autenticado atualmente.';

-- =========================================================================
-- TRIGGER DE AUTOCADASTRO DE PERFIL (auth.users -> public.perfis)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nome TEXT;
  v_perfil tipo_perfil;
  v_telefone TEXT;
  v_documento TEXT;
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

  INSERT INTO public.perfis (id, nome, telefone, perfil, documento_identificacao, criado_em, atualizado_em)
  VALUES (NEW.id, v_nome, v_telefone, v_perfil, v_documento, NOW(), NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Associa o trigger ao auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Sincroniza novos cadastros em auth.users para a tabela public.perfis automaticamente.';

-- =========================================================================
-- ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) NAS TABELAS
-- =========================================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_chamados ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLÍTICAS RLS - 1. PERFIS (public.perfis)
-- =========================================================================

-- Super admin pode tudo
CREATE POLICY "Super Admins possuem acesso irrestrito em perfis"
  ON public.perfis TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Qualquer usuário autenticado pode ler os perfis (necessário para listar prestadores, proprietários, inquilinos nas listagens)
CREATE POLICY "Usuários autenticados podem ver perfis"
  ON public.perfis FOR SELECT TO authenticated USING (true);

-- Usuários podem atualizar seus próprios perfis
CREATE POLICY "Usuários podem alterar seu próprio perfil"
  ON public.perfis FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- =========================================================================
-- POLÍTICAS RLS - 2. IMÓVEIS (public.imoveis)
-- =========================================================================

CREATE POLICY "Super Admins possuem acesso irrestrito em imoveis"
  ON public.imoveis TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Imobiliárias gerenciam seus próprios imóveis
CREATE POLICY "Imobiliárias gerenciam seus imóveis"
  ON public.imoveis TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

-- Inquilinos visualizam apenas o imóvel em que residem
CREATE POLICY "Inquilinos visualizam seu imóvel"
  ON public.imoveis FOR SELECT TO authenticated
  USING (inquilino_id = auth.uid());

-- Proprietários visualizam seus imóveis sob gestão
CREATE POLICY "Proprietários visualizam seus imóveis"
  ON public.imoveis FOR SELECT TO authenticated
  USING (proprietario_id = auth.uid());

-- =========================================================================
-- POLÍTICAS RLS - 3. CHAMADOS (public.chamados)
-- =========================================================================

CREATE POLICY "Super Admins possuem acesso irrestrito em chamados"
  ON public.chamados TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Inquilinos leem e abrem chamados vinculados ao seu próprio imóvel
CREATE POLICY "Inquilinos leem seus próprios chamados"
  ON public.chamados FOR SELECT TO authenticated
  USING (inquilino_id = auth.uid());

CREATE POLICY "Inquilinos abrem chamados no seu imóvel"
  ON public.chamados FOR INSERT TO authenticated
  WITH CHECK (
    inquilino_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = imovel_id AND i.inquilino_id = auth.uid()
    )
  );

CREATE POLICY "Inquilinos atualizam seus chamados em aberto"
  ON public.chamados FOR UPDATE TO authenticated
  USING (inquilino_id = auth.uid() AND status = 'aberto'::status_chamado)
  WITH CHECK (inquilino_id = auth.uid() AND status = 'aberto'::status_chamado);

-- Imobiliárias leem e alteram chamados dos imóveis sob sua gestão
CREATE POLICY "Imobiliárias gerenciam chamados dos seus imóveis"
  ON public.chamados TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = imovel_id AND i.imobiliaria_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = imovel_id AND i.imobiliaria_id = auth.uid()
    )
  );

-- Proprietários visualizam os chamados de seus imóveis
CREATE POLICY "Proprietários visualizam chamados de seus imóveis"
  ON public.chamados FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imoveis i
      WHERE i.id = imovel_id AND i.proprietario_id = auth.uid()
    )
  );

-- Prestadores de serviço visualizam chamados abertos, em triagem ou atribuídos a eles por propostas
CREATE POLICY "Prestadores visualizam chamados disponíveis ou atribuídos"
  ON public.chamados FOR SELECT TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND (
      status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
      OR EXISTS (
        SELECT 1 FROM public.orcamentos o
        WHERE o.chamado_id = id AND o.prestador_id = auth.uid()
      )
    )
  );

-- =========================================================================
-- POLÍTICAS RLS - 4. ORÇAMENTOS (public.orcamentos)
-- =========================================================================

CREATE POLICY "Super Admins possuem acesso irrestrito em orcamentos"
  ON public.orcamentos TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Prestadores gerenciam seus próprios orçamentos
CREATE POLICY "Prestadores gerenciam seus orçamentos"
  ON public.orcamentos TO authenticated
  USING (prestador_id = auth.uid())
  WITH CHECK (
    prestador_id = auth.uid() AND
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id AND c.status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
    )
  );

-- Imobiliárias visualizam e atualizam orçamentos dos chamados de seus imóveis
CREATE POLICY "Imobiliárias gerenciam orçamentos dos seus imóveis"
  ON public.orcamentos TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados c
      JOIN public.imoveis i ON i.id = c.imovel_id
      WHERE c.id = chamado_id AND i.imobiliaria_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chamados c
      JOIN public.imoveis i ON i.id = c.imovel_id
      WHERE c.id = chamado_id AND i.imobiliaria_id = auth.uid()
    )
  );

-- Proprietários visualizam e aprovam orçamentos dos chamados de seus imóveis
CREATE POLICY "Proprietários gerenciam orçamentos dos seus imóveis"
  ON public.orcamentos TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados c
      JOIN public.imoveis i ON i.id = c.imovel_id
      WHERE c.id = chamado_id AND i.proprietario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chamados c
      JOIN public.imoveis i ON i.id = c.imovel_id
      WHERE c.id = chamado_id AND i.proprietario_id = auth.uid()
    )
  );

-- Inquilinos visualizam os orçamentos de seus chamados para acompanhamento
CREATE POLICY "Inquilinos visualizam orçamentos de seus chamados"
  ON public.orcamentos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id AND c.inquilino_id = auth.uid()
    )
  );

-- =========================================================================
-- POLÍTICAS RLS - 5. IMAGENS E MÍDIAS (public.chamados_midias)
-- =========================================================================

CREATE POLICY "Super Admins possuem acesso irrestrito em chamados_midias"
  ON public.chamados_midias TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Qualquer usuário que tenha acesso de leitura ao chamado pode ler as mídias associadas
CREATE POLICY "Usuários com acesso ao chamado veem suas mídias"
  ON public.chamados_midias FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id
      -- Reaplica as lógicas de leitura simplificadas baseadas no chamado
      AND (
        c.inquilino_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.imoveis i
          WHERE i.id = c.imovel_id AND (i.imobiliaria_id = auth.uid() OR i.proprietario_id = auth.uid())
        )
        -- Ou prestador com acesso ao chamado
        OR (
          public.get_user_perfil() = 'prestador'::tipo_perfil AND (
            c.status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
            OR EXISTS (
              SELECT 1 FROM public.orcamentos o
              WHERE o.chamado_id = c.id AND o.prestador_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Permite inserção de mídias por inquilinos, prestadores ou imobiliárias vinculadas
CREATE POLICY "Usuários criam mídias para chamados permitidos"
  ON public.chamados_midias FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id
      AND (
        -- É o inquilino do chamado
        c.inquilino_id = auth.uid()
        -- É a imobiliária do imóvel do chamado
        OR EXISTS (
          SELECT 1 FROM public.imoveis i
          WHERE i.id = c.imovel_id AND i.imobiliaria_id = auth.uid()
        )
        -- É o prestador associado a um orçamento do chamado
        OR (
          public.get_user_perfil() = 'prestador'::tipo_perfil AND
          EXISTS (
            SELECT 1 FROM public.orcamentos o
            WHERE o.chamado_id = c.id AND o.prestador_id = auth.uid()
          )
        )
      )
    )
  );

-- =========================================================================
-- POLÍTICAS RLS - 6. HISTÓRICO DE CHAMADOS (public.historico_chamados)
-- =========================================================================

CREATE POLICY "Super Admins possuem acesso irrestrito em historico_chamados"
  ON public.historico_chamados TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Usuários que leem o chamado podem ler o histórico dele
CREATE POLICY "Usuários com acesso ao chamado veem seu histórico"
  ON public.historico_chamados FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id
      AND (
        c.inquilino_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.imoveis i
          WHERE i.id = c.imovel_id AND (i.imobiliaria_id = auth.uid() OR i.proprietario_id = auth.uid())
        )
        OR (
          public.get_user_perfil() = 'prestador'::tipo_perfil AND (
            c.status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
            OR EXISTS (
              SELECT 1 FROM public.orcamentos o
              WHERE o.chamado_id = c.id AND o.prestador_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Inserção de histórico associado a mudanças de status
CREATE POLICY "Usuários autorizados criam histórico de ações"
  ON public.historico_chamados FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chamados c
      WHERE c.id = chamado_id
      AND (
        c.inquilino_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.imoveis i
          WHERE i.id = c.imovel_id AND i.imobiliaria_id = auth.uid()
        )
        OR (
          public.get_user_perfil() = 'prestador'::tipo_perfil AND
          EXISTS (
            SELECT 1 FROM public.orcamentos o
            WHERE o.chamado_id = c.id AND o.prestador_id = auth.uid()
          )
        )
      )
    )
  );
