import { createClient } from "@supabase/supabase-js"

// Lê as variáveis de ambiente expostas pelo Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validação simples em tempo de desenvolvimento para certificar que o arquivo .env.local foi configurado
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Erro: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não foram encontradas. Verifique se o arquivo .env.local existe na raiz do projeto."
  )
}

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "")
