import { createClient } from "@supabase/supabase-js"

// Lê as variáveis de ambiente expostas pelo Vite com fallback para as chaves públicas oficiais do projeto
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://vdagkgahjykyxvisgfkp.supabase.co"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_FBb-ngtPAHwMjJHj7YvZpw_9B6if7zC"

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Extrai a mensagem de erro de forma amigável de uma falha de Edge Function do Supabase
 * e traduz mensagens comuns para o português brasileiro.
 */
export async function obterMensagemErroEdge(error: any): Promise<string> {
  if (!error) return "Erro desconhecido."
  
  let msg = error.message || "Erro desconhecido."
  
  // Se for um FunctionsHttpError do Supabase, o corpo do JSON de erro pode estar em error.context
  if (error.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json()
      if (body && body.error) {
        msg = body.error
      }
    } catch (_) {
      // Ignora falha ao ler o json do context
    }
  }
  
  const m = msg.toLowerCase()
  if (m.includes("user already exists") || m.includes("email already in use") || m.includes("already exists")) {
    return "Este e-mail já está sendo utilizado por outro usuário no sistema."
  }
  if (m.includes("weak_password") || m.includes("password should be")) {
    return "A senha fornecida é muito fraca. Escolha uma senha mais forte (mínimo de 6 caracteres)."
  }
  
  return msg
}

