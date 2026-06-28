import React, { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

// Definição dos tipos de perfis suportados pelo sistema
export type TipoPerfil = 'super_admin' | 'imobiliaria' | 'inquilino' | 'prestador' | 'proprietario'

// Interface para mapear a tabela public.perfis
export interface Perfil {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  perfil: TipoPerfil
  documento_identificacao: string | null
  primeiro_acesso_pendente?: boolean
  empresa_mae_id?: string | null
  categorias?: string[] | null
  tipo_repasse?: 'mensal' | 'quinzenal' | 'semanal' | 'por_servico' | null
  prazo_repasse_dias?: number | null
  criado_em: string
  atualizado_em: string
  logo_url?: string | null
}

// Interface que define o valor provido pelo contexto de autenticação
interface AuthContextType {
  user: User | null
  perfil: Perfil | null
  loading: boolean
  signOut: () => Promise<void>
  refreshPerfil: () => Promise<void>
}

// Inicializa o contexto de autenticação com valor indefinido por padrão
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider do contexto de autenticação que envolve toda a aplicação
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Função para buscar e atualizar o perfil do usuário logado a partir da tabela public.perfis
  async function fetchPerfil(userId: string) {
    try {
      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .eq("id", userId)
        .single()

      if (error) {
        throw error
      }

      setPerfil(data as Perfil)
    } catch (err) {
      console.error("Erro ao buscar perfil do usuário no banco:", err)
      setPerfil(null)
    }
  }

  // Função pública para forçar a atualização do perfil do usuário em tela
  async function refreshPerfil() {
    if (user) {
      await fetchPerfil(user.id)
    }
  }

  // Função para efetuar o logout do usuário da sessão do Supabase
  async function signOut() {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setPerfil(null)
    } catch (err) {
      console.error("Erro ao deslogar usuário:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 1. Busca a sessão atual ativa ao iniciar o provider
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        fetchPerfil(session.user.id).finally(() => setLoading(false))
      } else {
        setUser(null)
        setPerfil(null)
        setLoading(false)
      }
    })

    // 2. Escuta mudanças em tempo real no estado da autenticação (Login, Logout, Token renovado)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user)
        await fetchPerfil(session.user.id)
      } else {
        setUser(null)
        setPerfil(null)
      }
      setLoading(false)
    })

    // Remove a escuta ao desmontar o componente
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signOut, refreshPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook de consumo simplificado do contexto de autenticação em qualquer página
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("Erro: useAuth só pode ser usado dentro de um AuthProvider.")
  }
  return context
}
