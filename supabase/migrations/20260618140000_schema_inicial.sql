-- =========================================================================
-- ENUMS (Tipos customizados para garantir consistência de status e perfis)
-- =========================================================================

-- Tipos de perfis de usuários no sistema
CREATE TYPE tipo_perfil AS ENUM ('super_admin', 'imobiliaria', 'inquilino', 'prestador', 'proprietario');

-- Responsabilidade financeira triada pela imobiliária
CREATE TYPE tipo_responsabilidade AS ENUM ('proprietario', 'inquilino', 'indefinido');

-- Status possíveis para o fluxo de um chamado / ordem de serviço
CREATE TYPE status_chamado AS ENUM (
  'aberto',                   -- Inquilino acabou de criar
  'em_triagem',               -- Imobiliária analisando responsabilidade
  'aguardando_orcamento',     -- Enviado para o prestador cotar
  'orcamento_recebido',       -- Prestador enviou os valores
  'analise_proprietario',     -- Orçamento enviado para aprovação do proprietário
  'aguardando_autorizacao',  -- Proprietário aprovou, falta clique final da imobiliária
  'os_liberada',              -- Imobiliária clicou em "Autorizar Execução"
  'em_execucao',              -- Prestador iniciou o serviço no PWA
  'servico_concluido',        -- Prestador finalizou e enviou fotos do "depois"
  'encerrado',                -- Imobiliária homologou e arquivou
  'reprovado'                 -- Orçamento ou chamado recusado definitivamente
);

-- =========================================================================
-- TABELAS DO SISTEMA
-- =========================================================================

-- 1. Perfis de Usuários (Extensão da tabela nativa auth.users do Supabase)
CREATE TABLE public.perfis (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  perfil tipo_perfil NOT NULL DEFAULT 'inquilino',
  -- Se o perfil for imobiliaria, prestador ou proprietario, pode ter CNPJ/CPF cadastrado
  documento_identificacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.perfis IS 'Armazena os dados complementares dos usuários e define seu nível de acesso no SaaS.';

-- 2. Imóveis (Cadastro exclusivo e gerenciado pela Imobiliária)
CREATE TABLE public.imoveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID REFERENCES public.perfis(id) ON DELETE RESTRICT NOT NULL,
  proprietario_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  inquilino_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  codigo_imovel TEXT NOT NULL, -- Código de identificação interno da imobiliária (Ex: AP-102)
  endereco TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL DEFAULT 'Curitiba',
  estado VARCHAR(2) NOT NULL DEFAULT 'PR',
  cep TEXT NOT NULL,
  metragem_m2 NUMERIC(10,2), -- Medida padronizada no formato brasileiro
  limite_alcada_r$ NUMERIC(10,2) DEFAULT 500.00, -- Valor limite para aprovação direta pela imobiliária
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unico_codigo_por_imobiliaria UNIQUE (imobiliaria_id, codigo_imovel)
);

COMMENT ON TABLE public.imoveis IS 'Cadastro dos imóveis sob gestão. Somente a imobiliária vinculada pode inserir ou modificar.';

-- 3. Chamados (Abertos pelo Inquilino ou pela própria Imobiliária)
CREATE TABLE public.chamados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE RESTRICT NOT NULL,
  inquilino_id UUID REFERENCES public.perfis(id) ON DELETE RESTRICT NOT NULL,
  titulo TEXT NOT NULL,
  descricao_problema TEXT NOT NULL,
  categoria TEXT NOT NULL, -- Elétrica, Hidráulica, Pintura, Reparos, etc.
  disponibilidade_atendimento TEXT NOT NULL, -- Texto descrevendo melhores dias/horários
  status status_chamado NOT NULL DEFAULT 'aberto',
  responsabilidade tipo_responsabilidade NOT NULL DEFAULT 'indefinido',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chamados IS 'Registro principal dos chamados de manutenção e controle de sua evolução no fluxo.';

-- 4. Orçamentos / Propostas (Enviados pelos Prestadores de Serviço)
CREATE TABLE public.orcamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE CASCADE NOT NULL,
  prestador_id UUID REFERENCES public.perfis(id) ON DELETE RESTRICT NOT NULL,
  valor_servico_r$ NUMERIC(10,2) NOT NULL,
  valor_materiais_r$ NUMERIC(10,2) DEFAULT 0.00,
  valor_total_r$ NUMERIC(10,2) GENERATED ALWAYS AS (valor_servico_r$ + valor_materiais_r$) STORED,
  prazo_execucao_dias INTEGER NOT NULL,
  observacoes_tecnicas TEXT,
  aprovado_pelo_proprietario BOOLEAN DEFAULT FALSE,
  autorizado_pela_imobiliaria BOOLEAN DEFAULT FALSE,
  data_agendamento_servico TIMESTAMPTZ, -- Preenchido pelo prestador para execução
  relatorio_conclusao TEXT,              -- Relatório textual final enviado pelo prestador
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.orcamentos IS 'Propostas financeiras enviadas pelos prestadores para execução de um chamado.';

-- 5. Imagens e Mídias dos Chamados (Galeria vinculada ao Supabase Storage)
CREATE TABLE public.chamados_midias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE CASCADE NOT NULL,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE, -- Preenchido se a foto for do orçamento/conclusão
  usuario_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL, -- Quem fez o upload
  url_storage TEXT NOT NULL, -- Caminho do arquivo compactado (Max 2MB) no Supabase Storage
  tipo_midia TEXT NOT NULL,   -- 'antes', 'depois', 'diagnostico'
  marcacoes_json JSONB,      -- Guarda as coordenadas de pins ou desenhos feitos sobre a imagem
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chamados_midias IS 'Armazena as URLs das imagens tratadas/comprimidas e as marcações/pins visuais efetuados na interface.';

-- 6. Histórico / Auditoria do Chamado (Crucial para alimentar a Timeline em tempo real)
CREATE TABLE public.historico_chamados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL, -- Operador que realizou a ação
  status_anterior status_chamado,
  novo_status status_chamado NOT NULL,
  observacao TEXT, -- Ex: "Orçamento de R$650,00 encaminhado ao proprietário pois excede alçada de R$500,00"
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.historico_chamados IS 'Logs de auditoria e mudanças de estado. Dispara atualizações em tempo real para os listeners do app.';
