# Arquitetura do Sistema - Occasio.Imob 💡🏢

Este documento detalha as definições de arquitetura, fluxos de negócio, permissões e padrões técnicos a serem seguidos no desenvolvimento do **Occasio.Imob**.

---

## 🔑 Perfis de Usuário & Políticas de Acesso (RLS)

O banco de dados (Supabase PostgreSQL) implementará políticas de segurança estritas baseadas em linhas (Row Level Security - RLS). Nenhuma consulta poderá expor dados de outras organizações.

| Perfil | Nível de Acesso | Ações Principais |
| :--- | :--- | :--- |
| **Super Admin** | Total e irrestrito (ex: equipe Occasio) | Auditoria geral, suporte técnico e capacidade de alternar entre perfis para homologação do fluxo. |
| **Imobiliária** | Apenas à sua própria carteira | Cadastro exclusivo de imóveis, triagem de chamados, direcionamento, aprovação de alçadas, liberação de OS. |
| **Inquilino** | Apenas ao seu imóvel locado | Abertura de chamados, envio de mídias (fotos/vídeos), acompanhamento de status. |
| **Prestador** | Suas próprias OS e orçamentos | Visualização de chamados recebidos, envio de orçamentos, fotos de antes/depois, relatórios de conclusão. |
| **Proprietário** | Seus imóveis associados | Visualização de relatórios, aprovação/reprovação de despesas que excedem a alçada de aprovação direta da imobiliária. |

---

## 🔄 Fluxo de Ciclo de Vida do Chamado (Manutenção)

O fluxo principal do chamado percorre os seguintes estados:

```mermaid
graph TD
    A[Inquilino: Abre Chamado com fotos/horários] --> B[Imobiliária: Efetua Triagem e Define Responsabilidade]
    B -->|Define Prestador| C[Prestadores: Enviam Orçamentos com prazos/valores]
    C --> D{Imobiliária: Análise de Alçada}
    D -->|Dentro do limite| E[Aprovação Automática/Direta]
    D -->|Excede limite| F[Proprietário: Notificação e Aprovação manual]
    D -->|Inadequado| G[Reprovado: Solicitar Novo Orçamento]
    E --> H[Imobiliária: Validação e Liberação Final - Autorizar Execução]
    F -->|Aprovado pelo Proprietário| H
    H --> I[Prestador: OS Ativa no App, executa e tira fotos do antes/depois]
    I --> J[Imobiliária: Encerramento com Checkout e Auditoria]
    J --> K[Histórico Imutável arquivado no Imóvel]
```

---

## 📁 Diretrizes Técnicas

### 📷 Gerenciamento e Compressão de Imagens
- **Regra**: Imagens enviadas em campo (tanto por Inquilinos no chamado quanto por Prestadores na execução) devem ser comprimidas client-side para no máximo **2MB** antes do upload para o Supabase Storage.
- **Auditoria**: O sistema gravará de forma imutável a data/hora e o ID do usuário responsável por qualquer upload, alteração ou exclusão de mídias.

### ⚡ Atualizações em Tempo Real (Real-time)
- Interfaces de controle crítico (listagem de OS da Imobiliária e painel de execução do Prestador) utilizarão listeners em tempo real (`Supabase Realtime`) ou invalidação proativa de cache (`React Query` / `SWR`) para que o status mude na tela instantaneamente após qualquer aprovação ou finalização.

### 📶 Resiliência Offline (PWA)
- Prestadores operando em subsolos, áreas remotas ou sem rede devem conseguir listar suas Ordens de Serviço ativas e armazenar dados de conclusão temporariamente em cache local (`IndexedDB` ou `localStorage`), sincronizando-os automaticamente assim que a conexão for restabelecida.

---

## 🎨 Guia de Estilo (Cores & Fontes)

Este projeto utiliza o Tailwind CSS estruturado com tokens de cores HSL dinâmicas e classes utilitárias para fontes.

### 🎨 Cores (Colors)
A paleta de cores institucional da **Occasio** está definida em [tailwind.config.js](file:///c:/Users/Samsung/occasio-imb/tailwind.config.js):
* **Azul-Marinho Institucional (`occasio-navy`):** `#002244` (Cor primária escura para cabeçalhos e elementos de destaque do painel).
* **Azul Celeste (`occasio-blue`):** `#2A92D0` (Cor de realce para botões, links e estados ativos da linha do tempo).
* **Fundo Suave (`occasio-light`):** `#F4F9FD` (Tom azulado sutil e agradável para backgrounds).

As cores dinâmicas padrão (shadcn/ui) estão configuradas no arquivo [src/index.css](file:///c:/Users/Samsung/occasio-imb/src/index.css) mapeadas para variáveis CSS HSL:
* `--primary`: `210 100% 14%` (Equivalente ao marinho profundo da Occasio).
* `--secondary`: `202 67% 49%` (Equivalente ao azul celeste da Occasio).
* `--background`: `210 40% 98%` (Tom suave de fundo).
* `--border`: `214.3 31.8% 91.4%` (Bordas claras e elegantes).

### 🔤 Fontes (Fonts)
* A tipografia padrão do projeto utiliza a classe utilitária `font-sans` do Tailwind, configurada globalmente no `body` do arquivo [src/index.css](file:///c:/Users/Samsung/occasio-imb/src/index.css#L74).
* Como não há sobrescritas personalizadas na configuração de família de fontes, a pilha utiliza a família de fontes padrão sem serifa do Tailwind CSS (*Inter*, *system-ui*, *-apple-system*, *BlinkMacSystemFont*, *Segoe UI*, *Roboto*, *Helvetica Neue*, *Arial*, etc.), ideal para interfaces SaaS responsivas e de carregamento rápido.

