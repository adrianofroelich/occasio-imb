-- =========================================================================
-- MIGRAÇÃO: CONCILIAÇÃO FINANCEIRA DEFINITIVA E FECHAMENTO MENSAL
-- =========================================================================

-- 1. Criação da tabela de fechamentos mensais
CREATE TABLE IF NOT EXISTS public.fechamentos_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2020),
  total_receber_proprietarios NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_pagar_prestadores NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  criado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  -- Garante que não haja duplicidade de fechamento para a mesma competência
  CONSTRAINT unique_competencia UNIQUE (mes, ano)
);

COMMENT ON TABLE public.fechamentos_mensais IS 'Registros permanentes de fechamentos financeiros mensais de OSs finalizadas.';

-- 2. Modificações na tabela public.chamados para vinculação com fechamentos
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS fechamento_id UUID REFERENCES public.fechamentos_mensais(id) ON DELETE SET NULL;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'pendente' CHECK (status_financeiro IN ('pendente', 'pago')) NOT NULL;

COMMENT ON COLUMN public.chamados.fechamento_id IS 'Identificador do fechamento mensal ao qual esta OS foi vinculada.';
COMMENT ON COLUMN public.chamados.status_financeiro IS 'Status de conciliação financeira do chamado (pendente ou pago).';

-- 3. Habilitação de RLS na tabela de fechamentos
ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;

-- 4. Criação de políticas de segurança (RLS)
DROP POLICY IF EXISTS "Permitir leitura para todos os usuários autenticados" ON public.fechamentos_mensais;
CREATE POLICY "Permitir leitura para todos os usuários autenticados" 
ON public.fechamentos_mensais FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir inserção apenas para imobiliárias e super admins" ON public.fechamentos_mensais;
CREATE POLICY "Permitir inserção apenas para imobiliárias e super admins" 
ON public.fechamentos_mensais FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() AND perfil IN ('imobiliaria', 'super_admin')
  )
);
