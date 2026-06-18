import { createClient } from "@supabase/supabase-js"

// Lê as variáveis de ambiente expostas pelo Vite com fallback para as chaves públicas oficiais do projeto
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://vdagkgahjykyxvisgfkp.supabase.co"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_FBb-ngtPAHwMjJHj7YvZpw_9B6if7zC"

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
