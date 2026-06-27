-- =========================================================================
-- MIGRAÇÃO: FECHAMENTO FINANCEIRO E RECIBOS DE TÉCNICOS DE CAMPO
-- =========================================================================

-- 1. Criação da tabela de fechamentos de técnicos
CREATE TABLE IF NOT EXISTS public.fechamentos_tecnicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2020),
  total_pago_tecnicos NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  empresa_prestadora_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  criado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  -- Garante que não haja duplicidade de fechamento para a mesma competência por empresa
  CONSTRAINT unique_competencia_prestadora UNIQUE (mes, ano, empresa_prestadora_id)
);

COMMENT ON TABLE public.fechamentos_tecnicos IS 'Registros permanentes de fechamentos mensais de técnicos realizados pelas prestadoras.';

-- 2. Modificações na tabela public.chamados para vinculação com fechamentos de técnicos
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS fechamento_tecnico_id UUID REFERENCES public.fechamentos_tecnicos(id) ON DELETE SET NULL;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS status_financeiro_tecnico TEXT DEFAULT 'pendente' CHECK (status_financeiro_tecnico IN ('pendente', 'pago')) NOT NULL;

COMMENT ON COLUMN public.chamados.fechamento_tecnico_id IS 'Identificador do fechamento de técnicos ao qual esta OS foi vinculada.';
COMMENT ON COLUMN public.chamados.status_financeiro_tecnico IS 'Status de conciliação financeira do técnico (pendente ou pago).';

-- 3. Habilitação de RLS na tabela de fechamentos de técnicos
ALTER TABLE public.fechamentos_tecnicos ENABLE ROW LEVEL SECURITY;

-- 4. Criação de políticas de segurança (RLS)
DROP POLICY IF EXISTS "Permitir leitura de fechamentos para prestadores e seus tecnicos" ON public.fechamentos_tecnicos;
CREATE POLICY "Permitir leitura de fechamentos para prestadores e seus tecnicos"
ON public.fechamentos_tecnicos FOR SELECT
TO authenticated
USING (
  empresa_prestadora_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND empresa_mae_id = fechamentos_tecnicos.empresa_prestadora_id
  )
);

DROP POLICY IF EXISTS "Permitir inserção de fechamentos apenas por prestadoras" ON public.fechamentos_tecnicos;
CREATE POLICY "Permitir inserção de fechamentos apenas por prestadoras"
ON public.fechamentos_tecnicos FOR INSERT
TO authenticated
WITH CHECK (
  empresa_prestadora_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND perfil = 'prestador' AND empresa_mae_id IS NULL
  )
);
