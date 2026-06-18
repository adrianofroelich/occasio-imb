-- =========================================================================
-- MIGRAÇÃO: RESOLUÇÃO DE RECURSÃO INFINITA NAS POLÍTICAS RLS (SECURITY DEFINER)
-- =========================================================================

-- 1. Criação das Funções Auxiliares SECURITY DEFINER para quebrar recursão infinita

CREATE OR REPLACE FUNCTION public.is_chamado_aberto_para_orcamento(p_chamado_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chamados
    WHERE id = p_chamado_id AND status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_chamado_aberto_para_orcamento IS 'Verifica se o chamado está aberto para receber orçamentos, ignorando RLS.';

CREATE OR REPLACE FUNCTION public.is_chamado_da_imobiliaria(p_chamado_id UUID, p_imobiliaria_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chamados c
    JOIN public.imoveis i ON i.id = c.imovel_id
    WHERE c.id = p_chamado_id AND i.imobiliaria_id = p_imobiliaria_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_chamado_da_imobiliaria IS 'Verifica se o chamado pertence à imobiliária informada, ignorando RLS.';

CREATE OR REPLACE FUNCTION public.is_chamado_do_proprietario(p_chamado_id UUID, p_proprietario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chamados c
    JOIN public.imoveis i ON i.id = c.imovel_id
    WHERE c.id = p_chamado_id AND i.proprietario_id = p_proprietario_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_chamado_do_proprietario IS 'Verifica se o chamado pertence ao proprietário informado, ignorando RLS.';

CREATE OR REPLACE FUNCTION public.is_prestador_do_chamado(p_chamado_id UUID, p_prestador_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orcamentos
    WHERE chamado_id = p_chamado_id AND prestador_id = p_prestador_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_prestador_do_chamado IS 'Verifica se o prestador possui orçamento para o chamado, ignorando RLS.';

CREATE OR REPLACE FUNCTION public.can_user_access_chamado(p_chamado_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_perfil tipo_perfil;
  v_inquilino_id UUID;
  v_imovel_id UUID;
  v_status status_chamado;
BEGIN
  -- Obtém perfil do usuário
  SELECT perfil INTO v_perfil FROM public.perfis WHERE id = p_user_id;
  
  -- Se for super admin, tem acesso irrestrito
  IF v_perfil = 'super_admin'::tipo_perfil THEN
    RETURN TRUE;
  END IF;

  -- Obtém dados do chamado
  SELECT inquilino_id, imovel_id, status INTO v_inquilino_id, v_imovel_id, v_status 
  FROM public.chamados WHERE id = p_chamado_id;

  IF v_inquilino_id IS NULL THEN
    RETURN FALSE;
  END IF;

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
      v_status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
      OR EXISTS (
        SELECT 1 FROM public.orcamentos WHERE chamado_id = p_chamado_id AND prestador_id = p_user_id
      )
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.can_user_access_chamado IS 'Centraliza e valida o acesso de qualquer usuário a um chamado de forma segura, contornando recursão infinita.';

-- 2. Recriação das Políticas RLS utilizando as funções auxiliares

-- A) POLÍTICAS NA TABELA: public.chamados (Prestadores)
DROP POLICY IF EXISTS "Prestadores visualizam chamados disponíveis ou atribuídos" ON public.chamados;
CREATE POLICY "Prestadores visualizam chamados disponíveis ou atribuídos"
  ON public.chamados FOR SELECT TO authenticated
  USING (
    public.get_user_perfil() = 'prestador'::tipo_perfil AND (
      status IN ('aberto'::status_chamado, 'em_triagem'::status_chamado, 'aguardando_orcamento'::status_chamado)
      OR public.is_prestador_do_chamado(id, auth.uid())
    )
  );

-- B) POLÍTICAS NA TABELA: public.orcamentos
DROP POLICY IF EXISTS "Prestadores gerenciam seus orçamentos" ON public.orcamentos;
CREATE POLICY "Prestadores gerenciam seus orçamentos"
  ON public.orcamentos TO authenticated
  USING (prestador_id = auth.uid())
  WITH CHECK (
    prestador_id = auth.uid() AND
    public.get_user_perfil() = 'prestador'::tipo_perfil AND
    public.is_chamado_aberto_para_orcamento(chamado_id)
  );

DROP POLICY IF EXISTS "Imobiliárias gerenciam orçamentos dos seus imóveis" ON public.orcamentos;
CREATE POLICY "Imobiliárias gerenciam orçamentos dos seus imóveis"
  ON public.orcamentos TO authenticated
  USING (public.is_chamado_da_imobiliaria(chamado_id, auth.uid()))
  WITH CHECK (public.is_chamado_da_imobiliaria(chamado_id, auth.uid()));

DROP POLICY IF EXISTS "Proprietários gerenciam orçamentos dos seus imóveis" ON public.orcamentos;
CREATE POLICY "Proprietários gerenciam orçamentos dos seus imóveis"
  ON public.orcamentos TO authenticated
  USING (public.is_chamado_do_proprietario(chamado_id, auth.uid()))
  WITH CHECK (public.is_chamado_do_proprietario(chamado_id, auth.uid()));

-- C) POLÍTICAS NA TABELA: public.chamados_midias
DROP POLICY IF EXISTS "Usuários com acesso ao chamado veem suas mídias" ON public.chamados_midias;
CREATE POLICY "Usuários com acesso ao chamado veem suas mídias"
  ON public.chamados_midias FOR SELECT TO authenticated
  USING (public.can_user_access_chamado(chamado_id, auth.uid()));

DROP POLICY IF EXISTS "Usuários criam mídias para chamados permitidos" ON public.chamados_midias;
CREATE POLICY "Usuários criam mídias para chamados permitidos"
  ON public.chamados_midias FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    public.can_user_access_chamado(chamado_id, auth.uid())
  );

-- D) POLÍTICAS NA TABELA: public.historico_chamados
DROP POLICY IF EXISTS "Usuários com acesso ao chamado veem seu histórico" ON public.historico_chamados;
CREATE POLICY "Usuários com acesso ao chamado veem seu histórico"
  ON public.historico_chamados FOR SELECT TO authenticated
  USING (public.can_user_access_chamado(chamado_id, auth.uid()));

DROP POLICY IF EXISTS "Usuários autorizados criam histórico de ações" ON public.historico_chamados;
CREATE POLICY "Usuários autorizados criam histórico de ações"
  ON public.historico_chamados FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    public.can_user_access_chamado(chamado_id, auth.uid())
  );
