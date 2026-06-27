# Occasio.Imob 💡🏢

O **Occasio.Imob** é uma plataforma SaaS de gestão de manutenção predial focada em imobiliárias. O sistema centraliza e automatiza o fluxo de ponta a ponta: desde a abertura do chamado pelo inquilino, cotação com prestadores de serviço, aprovação de alçada (imobiliária/proprietário), execução, até o encerramento com registro histórico do imóvel.

> 💡 **Significado da Marca:** A palavra *Occasio* vem do latim e significa "Oportunidade". Transforma o problema crítico e estressante da manutenção predial em uma oportunidade de eficiência, transparência e valorização patrimonial para a imobiliária.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React (v19) + TypeScript + Vite + Tailwind CSS (v3)
- **Componentes:** Shadcn UI + Radix UI + Lucide Icons
- **PWA:** Habilitado via `@vite-plugin-pwa` para suporte offline e instalabilidade.
- **Deploy:** Containerizado via Docker (pronto para EasyPanel / VPS Hostinger).
- **Backend:** Supabase (Autenticação nativa, PostgreSQL com RLS e Realtime ativo).

---

## 📱 Progressive Web App (PWA)

O suporte a PWA está ativado via `vite-plugin-pwa`. Ele gera automaticamente:
- O manifesto do aplicativo (`manifest.webmanifest`) com o tema escuro oficial da marca (`#002244`).
- Registro automático do Service Worker para cache local e suporte offline de assets estáticos (essencial para prestadores em áreas de campo sem sinal).
- Ícones adaptáveis e maskables a partir da logo.

---

## 🐳 Deploy no EasyPanel (Docker)

O projeto está pronto para deploy contínuo em VPS utilizando o **EasyPanel** ou qualquer orquestrador baseado em Docker.

### Estrutura do Deploy
- **[Dockerfile](file:///c:/Users/Samsung/occasio-imb/Dockerfile)**: Configuração multi-stage.
  1. **Stage 1 (Node 20-alpine)**: Instala as dependências e roda o build (`npm run build`).
  2. **Stage 2 (Nginx stable-alpine)**: Copia a pasta `/dist` compilada e expõe o app na porta `80`.
- **[nginx.conf](file:///c:/Users/Samsung/occasio-imb/nginx.conf)**: Configura o roteamento das requisições para `try_files $uri $uri/ /index.html` para que o roteador client-side do React gerencie as URLs de forma nativa e impeça erros 404.

### Como realizar o Deploy no EasyPanel:
1. No painel do EasyPanel, crie um novo **App**.
2. Na aba **Source**, escolha **Git** e aponte para o repositório: `adrianofroelich/occasio-imb`.
3. Escolha o branch: `main`.
4. Em **Build**, defina o tipo como **Dockerfile** (ele detectará o arquivo raiz automaticamente).
5. Defina a porta de exposição como `80`.
6. Na aba **Domains**, configure o seu domínio oficial `www.occasio.imb.br`.

---

## 🌐 Regras de Localização e Código (Diretrizes do Repositório)

Para manter a consistência do projeto, todos os desenvolvedores (e IAs auxiliares) devem seguir as diretrizes abaixo:

1. **Idioma de Código e Comentários**: Todo e qualquer comentário no código, hooks, migrations ou documentação complementar deve ser escrito rigorosamente em **Português do Brasil (pt-BR)**.
2. **Moeda e Formato Numérico**: Valores financeiros devem usar o padrão brasileiro (ex: `R$ 1.250,50`).
3. **Unidades de Medida**: Padrão métrico brasileiro (ex: `m²`, `cm`, `kg`).
4. **Formato de Datas e Horas**: 
   - Datas: `DD/MM/AAAA` (ex: `17/06/2026`).
   - Horários: Formato de 24 horas baseado no **Horário de Brasília (UTC-3)** (ex: `14:30`).

---

## 💰 Regras de Acertos Financeiros e Condições de Repasse

O sistema conta com um motor financeiro de repasse de valores para Prestadoras (PJ) e Técnicos de Campo (PF) com as seguintes condições de acerto:

1. **Mensal**: O repasse ocorre no dia programado `X` (ex: todo dia 10) do mês subsequente à data de conclusão do chamado.
2. **Quinzenal**: O repasse é computado a partir do fechamento da quinzena da conclusão (dia 15 ou último dia do mês), somado a `Y` dias de prazo de carência.
3. **Semanal**: O repasse ocorre após o fechamento da semana (domingo do encerramento), acrescido de `Z` dias de carência.
4. **Por Serviço**: O repasse é liberado exatamente `W` dias após a conclusão do chamado.

### Painel Financeiro PJ (Prestador)
- **A Receber**: Calculado e previsto com base nos termos de repasse definidos no cadastro da **Imobiliária** contratante.
- **A Pagar**: Calculado e previsto com base nos termos de repasse configurados na própria conta da **Prestadora PJ** para repasse ao técnico.
- Exibe o consolidado dividido em: **Total**, **Vencidos** (prazos expirados) e **A Vencer**.

### Painel Financeiro PF (Técnico de Campo)
- Apresenta as ordens de serviço concluídas com a previsão de recebimento de repasse baseado nos termos configurados no perfil da sua **Empresa Mãe**.
- Exibe o consolidado de **Total**, **Vencido** e **A Vencer** com reembolso de materiais integrado.

### Painel Financeiro da Imobiliária
- **A Receber (Dos Proprietários)**: Soma de mão de obra e materiais das ordens de serviço concluídas/encerradas cuja responsabilidade financeira seja do Proprietário.
- **A Pagar (Aos Prestadores PJ)**: Soma homologada a repassar às prestadoras parceiras (incluindo reembolsos de materiais comprados pela empresa).
- **Extrato do Proprietário**: Cópia rápida em um clique de um demonstrativo textual mono-espaçado pronto para lançamento e desconto do aluguel do proprietário.
- **Conciliação**: Filtro por status de conciliação (Pendente / Pago) e filtro inteligente por prestadora PJ credora.

---

## 📱 Suporte a Proprietários Não-Tecnológicos (Fluxo Híbrido / WhatsApp)

Nem todos os proprietários de imóveis acessam ou desejam acessar o painel digital do Occasio.Imob. Para garantir a fluidez operacional das imobiliárias, implementamos o **Fluxo Híbrido**:

1. **Flag de Preferência no Perfil (`aceita_painel_digital`):** No cadastro do cliente Proprietário, a imobiliária define se ele utilizará o painel digital. Se marcado como "Não", um aviso visual discreto é exibido na listagem de clientes.
2. **Compartilhamento via WhatsApp:** No painel da imobiliária, o operador conta com o botão **"Enviar para Proprietário via WhatsApp"**. Ao clicar, o sistema gera dinamicamente uma mensagem premium formatada com o código do imóvel, resumo do problema, custos (se houver orçamento) e um link amigável.
3. **Página de Impressão e PDF (`/chamado/print/:id`):** Rota pública otimizada que apresenta um "PDF visual" do chamado, com layout profissional *print-friendly* (ocultando barras de ferramentas e cabeçalhos ao imprimir), permitindo que a imobiliária salve como PDF ou envie o link direto.
4. **Bypass de Aprovação Externa:** Se o proprietário estiver configurado como analógico, o operador da imobiliária terá acesso ao botão **"Aprovar em nome do Proprietário (Autorização Externa)"** na etapa de análise de orçamentos, destravando a O.S. e gravando a auditoria no histórico do chamado.

---

## 📅 Conciliação Financeira Definitiva e Fechamento Mensal

A conciliação definitiva de saldos e fechamento de competência de ordens de serviço é centralizada no painel da imobiliária na aba "Financeiro / Repasses":

1. **Sub-Abas de Navegação:** Alternância limpa e responsiva entre "Lotes de Acerto / Conciliação" (lista de OSs pendentes e liquidadas individualmente) e "Histórico de Fechamentos Mensais".
2. **Conciliação e Pagamento Individual Persistente:** O botão "Pagar/Pendente" altera diretamente no banco de dados o campo `status_financeiro` (`pago` / `pendente`).
3. **Novo Fechamento Mensal (Competência):** O operador pode selecionar a competência (mês/ano) e visualizar um preview consolidado (saldo intermediado, repasses previstos e OSs elegíveis). Ao confirmar, o sistema persiste o registro na tabela `fechamentos_mensais`, associa as OSs ao fechamento correspondente (`fechamento_id`), bloqueando-as contra novas alterações manuais.
4. **Relatório Detalhado de Fechamento (Extratos Consolidados):** Detalhamento completo da competência com o fechamento consolidado, dividindo descontos de aluguel por proprietário, repasses a prestadoras PJ e reembolsos devidos a inquilinos (reembolsos de materiais).

---

## 📅 Fechamento de Técnicos e Recibos de Pagamento (Prestador PJ)

A prestadora PJ possui uma rotina específica no seu painel financeiro para faturar e acertar as contas com sua equipe de técnicos de campo:

1. **Sub-Abas de Navegação:** Alternância no painel de controle financeiro do prestador entre "Lotes de Técnicos / Conciliação" (gerenciamento individual) e "Histórico de Fechamentos Técnicos".
2. **Pagamento Persistente ao Técnico:** O botão "Pagar" na listagem de acertos PJ atualiza de forma permanente no banco de dados o campo `status_financeiro_tecnico` (`pago` / `pendente`). Fica desabilitado com o rótulo *"Fechado"* se o chamado já pertencer a um lote homologado.
3. **Novo Fechamento de Técnicos:** Seleção da competência (Mês/Ano) que gera um preview reativo contendo o consolidado de serviços e reembolsos de materiais devidos aos profissionais, associando os chamados ao novo fechamento de técnicos.
4. **Relatório e Geração de Recibos Profissionais:** A visualização de um fechamento detalha o repasse devido por profissional de campo. Um botão **"Gerar Recibo / PDF"** abre a rota de impressão `/financeiro/recibo-tecnico/:fechamento_id/:tecnico_id`.
5. **Layout de Recibo Imprimível (`/financeiro/recibo-tecnico/`):** Apresenta o recibo formal brasileiro com o cabeçalho completo da Prestadora PJ, os dados do Técnico, a discriminação por extenso do valor faturado, a lista detalhada de OS's trabalhadas e o local para data e assinatura. Otimizado para impressão direta ou salvamento em PDF.

---

## 📁 Estrutura de Pastas (Mapa do Projeto)

```bash
occasio-imb/
├── .agents/                # Configurações e diretrizes de desenvolvimento local (IAs)
├── logo/                   # Contém os arquivos originais da logomarca oficial
├── public/                 # Assets estáticos globais (favicon, logo, imagens 3D)
├── supabase/               # Arquivos e migrations do banco de dados remoto
│   └── migrations/         # DDLs, triggers e políticas RLS
├── src/
│   ├── assets/             # Imagens e vetores secundários do app
│   ├── components/
│   │   ├── ui/             # Componentes primitivos do Shadcn UI (Badge, Button, Card, Input)
│   │   ├── LaudoTecnico.tsx # Componente modal do Laudo Técnico consolidado e print-friendly (Fase 7)
│   │   └── VisualizadorImagem.tsx # Modal de visualização de vistorias com Zoom interativo (Fase 5)
│   ├── hooks/
│   │   └── useAuth.tsx     # Contexto e hook de autenticação e sessão com perfil integrado
│   ├── lib/
│   │   ├── compressor.ts   # Utilitário de compressão de imagens via Canvas no frontend
│   │   ├── supabase.ts     # Inicialização e instância do SDK do Supabase Client
│   │   └── utils.ts        # Utilitários de classes Tailwind (clsx + tailwind-merge)
│   ├── pages/
│   │   ├── admin/
│   │   │   └── Dashboard.tsx # Painel SaaS Enterprise para controle centralizado de Imobiliárias, Prestadoras e Vínculos (Fase 10)
│   │   ├── imobiliaria/
│   │   │   ├── Clientes.tsx  # Cadastro e onboarding de clientes com supabaseAdmin (Fase 8)
│   │   │   ├── Dashboard.tsx # Painel realtime de chamados estilo lista dinâmica (Fase 3)
│   │   │   └── Imoveis.tsx   # Cadastro e listagem de imóveis (Fase 3)
│   │   ├── inquilino/
│   │   │   └── Dashboard.tsx # Painel realtime e abertura de chamado do inquilino (Fase 4)
│   │   ├── prestador/
│   │   │   ├── Dashboard.tsx # Painel mobile-first de propostas, delegação técnica e OS do prestador/técnico (Fase 9)
│   │   │   └── Equipe.tsx    # Cadastro de técnicos vinculados à Empresa Prestadora PJ (Fase 9)
│   │   ├── proprietario/
│   │   │   └── Dashboard.tsx # Painel de aprovações de orçamentos e histórico do proprietário (Fase 6)
│   │   ├── Beneficios.tsx  # Página detalhada de ROI e Gestão Patrimonial
│   │   ├── Home.tsx        # Landing Page institucional da plataforma
│   │   ├── Login.tsx       # Tela de login oficial real integrada com redirecionamento de perfis (Fase 10)
│   │   └── LoginTeste.tsx  # Simulador de autenticação protegido para testes locais RLS (Fase 10)
│   ├── App.tsx             # Roteador central e layout global com AuthProvider
│   ├── main.tsx            # Arquivo de entrada do React
│   └── index.css           # Estilos globais e tokens de cores Tailwind
├── Dockerfile              # Script de containerização do app
├── nginx.conf              # Configuração Nginx para roteamento SPA
├── tailwind.config.js      # Configurações de tema (navy: #002244, blue: #2A92D0)
└── vite.config.ts          # Bundler Vite + Configurações de PWA
```

---

## 💻 Desenvolvimento Local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Para testar o build de produção:
   ```bash
   npm run build
   npm run preview
   ```
