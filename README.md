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

### 🌟 Funcionalidades do Engajamento Mobile Premium:
1. **Assistente de Instalação Inteligente**:
   - **Android & Desktop**: Captura o evento nativo global `beforeinstallprompt` e o dispara quando o usuário clica em "Instalar Aplicativo".
   - **iOS (Safari)**: Exibe um assistente visual dinâmico que ensina o passo a passo de como clicar em "Compartilhar" (ícone com seta para cima) e, em seguida, em "Adicionar à Tela de Início".
   - **Ocultação Contextual**: O botão e o card de instalação ocultam-se automaticamente se o aplicativo já estiver rodando em modo standalone (instalado).
2. **Notificações Push (Opt-in)**:
   - Disponível nas dashboards/telas de perfil dos perfis de **Inquilino**, **Técnico (Prestador)** e **Proprietário**.
   - Fluxo de Toggle: Solicita a permissão do usuário nativamente (`Notification.requestPermission()`). Se autorizado, assina no navegador através do `PushManager` do service worker e envia a inscrição em formato JSON para o banco. Se desativado, desinscreve e remove do banco.
   - Suporte a chaves VAPID configuráveis via `.env.local` na variável `VITE_VAPID_PUBLIC_KEY` (com fallback local seguro).
   - Dados persistidos nas novas colunas `permite_push` e `push_subscription` na tabela `public.perfis`.

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

## 🔄 Fluxo de Contingência: Devolução de OS pelo Técnico de Campo

A partir do PWA de Técnicos e do Painel da Prestadora PJ, o sistema implementa um fluxo operacional de contingência para gerenciar devoluções de Ordens de Serviço:

1. **Devolução no PWA do Técnico (PF):** Quando uma OS está atribuída (`os_liberada`) ou em execução (`em_execucao`) no PWA do técnico, ele pode clicar em **"Devolver OS"**. Uma modal solicita a justificativa obrigatória (mínimo de 10 caracteres).
2. **Desvinculação e Triagem:** Ao confirmar, o sistema limpa o técnico atribuído (`tecnico_id = NULL`), retorna o status da OS para `os_liberada` (liberada para execução) e grava a justificativa de forma permanente na tabela `public.historico_chamados`.
3. **Alertas e Re-designação no Gestor (PJ):** A OS devolvida volta a aparecer instantaneamente na aba de OS Ativas do gestor da Prestadora PJ como sem responsável ("OS Sem Técnico Responsável!"). O card exibe um alerta amarelo proeminente indicando que ela já foi devolvida anteriormente e exibe a última justificativa de devolução, permitindo que o gestor a re-designe a um novo técnico diretamente dali.

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

## 🎨 Personalização de Marca e Upload de Logomarcas

A partir da versão 1.4.0, o Occasio.Imob oferece suporte completo à personalização dinâmica de identidade visual para Imobiliárias e Prestadores de Serviço PJ:

1. **Upload no Admin SaaS (`/admin/dashboard`):** O super administrador do ecossistema pode enviar e excluir logomarcas nos formulários de edição de parceiros corporativos.
2. **Compressão Inteligente Reativa (Frontend):** Se um arquivo maior que 2 MB for selecionado, o utilitário Canvas nativo (`comprimirLogomarca` em `src/lib/compressor.ts`) realiza o redimensionamento dinâmico automático limitando a resolução a 800px (preservando o formato original PNG/JPEG e canal de transparência de PNGs) mantendo o arquivo final bem abaixo do teto de 2 MB do banco.
3. **Bucket de Storage Seguro (`logomarcas`):** As imagens são organizadas em pastas correspondentes ao ID do perfil parceiro (`/id_perfil/logo_[timestamp].[ext]`). As políticas de RLS garantem que a leitura seja pública, mas que a gravação/exclusão pertença estritamente ao dono do perfil corporativo logado ou a administradores `super_admin`.
4. **Exibição Dinâmica no Ecossistema:**
   - **Navbar Superior:** Ao lado do nome corporativo e perfil do usuário logado (`App.tsx`).
   - **Cabeçalho das Dashboards:** No topo dos painéis da Imobiliária e da Prestadora PJ ao lado do nome da empresa.
   - **Relatórios de Impressão (PDF):** Cabeçalho timbrado dinâmico profissional em preto e branco ou colorido nas telas `/chamado/print/:id` (ChamadoPrint), `/financeiro/recibo-tecnico/` (ReciboTecnicoPrint) e no modal de laudo técnico (`LaudoTecnico.tsx`).


## 📷 Evidências Visuais e Upload de Imagens com Compressão

A partir da versão 1.5.0, o Occasio.Imob conta com suporte a anexo de evidências visuais (até 3 imagens) para documentar o problema e comprovar a resolução dos chamados:

1. **Upload nos Formulários de Abertura (Inquilino e Imobiliária):** Permite anexar até 3 fotos de evidência do problema. Os formatos aceitos são `.png`, `.jpg`, `.jpeg`.
2. **Upload no Formulário de Conclusão (Técnico):** O técnico de campo pode anexar até 3 fotos comprovando a resolução da O.S. ao finalizar o serviço.
3. **Compressão Canvas Inteligente (Frontend):** Se qualquer imagem passar do limite de 2 MB, o utilitário nativo (`comprimirImagemChamado` em `src/lib/compressor.ts`) realiza o redimensionamento dinâmico automático limitando a resolução máxima a 1200px e comprimindo para JPEG com 75% de qualidade.
4. **Bucket de Storage Público (`chamados`):** As imagens de problemas são salvas em `/chamado_id/problema/` e as de solução em `/chamado_id/solucao/`. O array de URLs das fotos é salvo diretamente nas colunas `imagens_problema` e `imagens_solucao` na tabela `public.chamados`.
5. **Exibição Dinâmica e Lightbox:** Nos painéis da Imobiliária e da Prestadora PJ, as evidências são exibidas como uma galeria elegante de miniaturas clicáveis que abrem em um visualizador (lightbox/modal) com zoom.
6. **Impressão e PDF de Prestação de Contas:** As fotos de "Antes" e "Depois" são injetadas perfeitamente no rodapé das telas de impressão (`ChamadoPrint.tsx` e no modal/PDF de `LaudoTecnico.tsx`), prontas para exportação em PDF.

## 🏷️ Dinamicidade de Categorias de Chamados

Anteriormente fixadas no código do frontend, as categorias de chamados (ex: Hidráulica, Elétrica) agora são dinâmicas e gerenciadas exclusivamente pelo Super Admin (Dono do SaaS) no Painel Administrativo.

### Funcionamento e Regras de Negócio:
1. **Controle Total (CRUD):** O Super Admin pode criar novas categorias, atualizar o nome e a descrição, e excluir categorias existentes.
2. **Exclusão Segura (`ON DELETE RESTRICT`):** Para evitar quebras de consistência dos dados históricos, o banco de dados impede a remoção de uma categoria se ela estiver vinculada a qualquer chamado (O.S.). O painel administrativo exibe um alerta amigável de erro operacional caso o administrador tente fazer isso.
3. **Consumo Dinâmico:** Os formulários de abertura de chamados do Inquilino e da Imobiliária leem dinamicamente as opções da tabela `public.categorias`.
4. **Mapeamento de Dados Síncrono:** Para manter compatibilidade de renderização de strings de categoria (ex: "Elétrica") no frontend, as listagens de todos os painéis e a RPC de impressão de O.S. resolvem dinamicamente os UUIDs das categorias em seus nomes equivalentes.

## 📞 Contato de Recebimento no Imóvel

Para otimizar a logística de atendimento técnico em campo, o sistema permite a coleta dos dados de contato específicos do responsável que receberá o técnico no imóvel.

### Regras de Negócio:
1. **Coleta Opcional na Abertura:** Tanto na abertura de chamado pelo Inquilino quanto administrativamente pela Imobiliária, são fornecidos os campos opcionais de "Nome do Responsável no Local" e "Telefone do Responsável" (com máscara padrão de telefone brasileiro).
2. **Fallback Automático:** Caso esses campos fiquem vazios, o sistema utiliza automaticamente os dados do próprio Inquilino titular como contato para a visita.
3. **Visibilidade em Destaque:** Nos painéis da Prestadora PJ (Gestor) e no PWA do Técnico PF, as informações de contato do recebedor e do inquilino titular são exibidas de forma clara em um bloco chamado **"Contatos para o Atendimento"**. Se a pessoa responsável no local for diferente do inquilino titular, ela é destacada visualmente com um badge colorido.
4. **Exportação e Impressão:** Os dados do responsável no local também são expostos na RPC segura de consulta anônima e são exibidos adequadamente no layout de impressão (`ChamadoPrint.tsx`).

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
   ```
4. visualize o build localmente:
   ```bash
   npm run preview
   ```
