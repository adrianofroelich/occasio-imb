# Regras e Contexto do Projeto - Occasio.Imob

Este arquivo contém as diretrizes do projeto e referências rápidas para a IA de desenvolvimento (Antigravity).

## 🗂️ Diretrizes do Projeto
1. **Idioma**: Comentar todo o código backend, hooks e banco de dados em **Português Brasileiro (pt-BR)**.
2. **Formatação Regional**:
   - Moeda: **Real (R$)**
   - Data/Hora: **DD/MM/AAAA** no Horário de Brasília.
3. **Visual Aesthetics**:
   - Manter design premium e responsivo (estilo PWA).
   - Componentes centralizados e limpos.

## 🔑 Banco de Dados e Serviços (Supabase)
O projeto está integrado ao Supabase. Os detalhes de conexão estão salvos nos seguintes locais locais:
- As chaves de acesso público estão configuradas em [.env.local](file:///c:/Users/Samsung/occasio-imb/.env.local).
- Os tokens administrativos e chaves secretas estão centralizados de forma segura e fora do Git no arquivo [.agents/secrets.md](file:///c:/Users/Samsung/occasio-imb/.agents/secrets.md).

### Projeto Supabase
- **Nome**: Occasio.Imob
- **Project ID**: `vdagkgahjykyxvisgfkp`
- **Region**: `sa-east-1` (São Paulo)
