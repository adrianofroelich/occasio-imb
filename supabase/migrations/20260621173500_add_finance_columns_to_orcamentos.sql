-- =========================================================================
-- MIGRAÇÃO: ADIÇÃO DE COLUNAS DE CONTROLE FINANCEIRO E RESPONSABILIDADE DE MATERIAIS
-- =========================================================================

-- 1. Adição das colunas financeiras originais do técnico na tabela de orçamentos
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS valor_servico_tecnico_r$ NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS valor_materiais_tecnico_r$ NUMERIC(10,2) DEFAULT 0.00;

-- 2. Adição das colunas de responsabilidade de pagamento de materiais
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS responsavel_material_tecnico TEXT DEFAULT 'empresa' CHECK (responsavel_material_tecnico IN ('tecnico', 'empresa'));
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS responsavel_material_empresa TEXT DEFAULT 'empresa' CHECK (responsavel_material_empresa IN ('empresa', 'imobiliaria', 'proprietario'));

-- Comentários explicativos
COMMENT ON COLUMN public.orcamentos.valor_servico_tecnico_r$ IS 'Valor de mão de obra cobrado pelo técnico.';
COMMENT ON COLUMN public.orcamentos.valor_materiais_tecnico_r$ IS 'Valor de materiais orçado pelo técnico.';
COMMENT ON COLUMN public.orcamentos.responsavel_material_tecnico IS 'Quem paga/providencia os materiais no nível do técnico (tecnico ou empresa).';
COMMENT ON COLUMN public.orcamentos.responsavel_material_empresa IS 'Quem paga/providencia os materiais no nível comercial (empresa, imobiliaria ou proprietario).';

-- 3. Inicialização dos dados antigos para manter integridade
UPDATE public.orcamentos 
SET 
  valor_servico_tecnico_r$ = COALESCE(valor_servico_r$, 0.00),
  valor_materiais_tecnico_r$ = COALESCE(valor_materiais_r$, 0.00)
WHERE valor_servico_tecnico_r$ IS NULL OR valor_servico_tecnico_r$ = 0.00;
