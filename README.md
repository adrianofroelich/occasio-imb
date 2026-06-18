# Occasio.Imob 💡🏢

O **Occasio.Imob** é uma plataforma SaaS de gestão de manutenção predial focada em imobiliárias. O sistema centraliza e automatiza o fluxo de ponta a ponta: desde a abertura do chamado pelo inquilino, cotação com prestadores de serviço, aprovação de alçada (imobiliária/proprietário), execução, até o encerramento com registro histórico do imóvel.

> 💡 **Significado da Marca:** A palavra *Occasio* vem do latim e significa "Oportunidade". Transforma o problema crítico e estressante da manutenção predial em uma oportunidade de eficiência, transparência e valorização patrimonial para a imobiliária.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React (v19) + TypeScript + Vite + Tailwind CSS (v3)
- **Componentes:** Shadcn UI + Radix UI + Lucide Icons
- **PWA:** Habilitado via `@vite-plugin-pwa` para suporte offline e instalabilidade.
- **Deploy:** Containerizado via Docker (pronto para EasyPanel / VPS Hostinger).
- **Backend (Futuro):** Integração com Supabase (Autenticação, PostgreSQL e Storage).

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

## 📁 Estrutura de Pastas (Mapa do Projeto)

```bash
occasio-imb/
├── logo/                   # Contém os arquivos originais da logomarca oficial
├── public/                 # Assets estáticos globais (favicon, logo, imagens 3D)
├── src/
│   ├── assets/             # Imagens e vetores secundários do app
│   ├── components/
│   │   └── ui/             # Componentes primitivos do Shadcn UI (Badge, Button, Card)
│   ├── lib/
│   │   └── utils.ts        # Utilitários de junção de classes Tailwind (clsx + tailwind-merge)
│   ├── App.tsx             # Componente central contendo a Landing Page e logo interativa
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
