import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert, Loader2, KeyRound, Mail } from "lucide-react"

export default function Login() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()

  // Estados do formulário
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")

  // Estados operacionais
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Função utilitária para redirecionar conforme o perfil
  const redirecionarPorPerfil = (tipoPerfil: string) => {
    switch (tipoPerfil) {
      case "super_admin":
        navigate("/admin/dashboard")
        break
      case "imobiliaria":
        navigate("/imobiliaria/dashboard")
        break
      case "inquilino":
        navigate("/inquilino/dashboard")
        break
      case "prestador":
        navigate("/prestador/dashboard")
        break
      case "proprietario":
        navigate("/proprietario/dashboard")
        break
      default:
        navigate("/")
    }
  }

  // Intercepta e redireciona caso o usuário já esteja autenticado
  useEffect(() => {
    if (user && perfil) {
      redirecionarPorPerfil(perfil.perfil)
    }
  }, [user, perfil])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !senha) return
    setLoading(true)
    setErro(null)

    try {
      // 1. Efetua o login no Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha
      })

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error("E-mail ou senha incorretos. Por favor, verifique suas credenciais.")
        }
        throw authError
      }

      if (!data.user) {
        throw new Error("Erro inesperado no sistema ao efetuar o login.")
      }

      // 2. Busca o perfil diretamente da tabela pública para redirecionar de imediato
      const { data: perfilData, error: dbError } = await supabase
        .from("perfis")
        .select("perfil")
        .eq("id", data.user.id)
        .single()

      if (dbError) {
        console.error("Erro ao buscar o perfil do usuário logado:", dbError)
        // Fallback: deixa o useAuth resolver em background e joga na Home
        navigate("/")
        return
      }

      redirecionarPorPerfil(perfilData.perfil)

    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro inesperado ao tentar conectar-se.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-slate-50 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white overflow-hidden">
        
        {/* Banner com a Logo da marca */}
        <div className="bg-occasio-navy py-8 flex flex-col items-center justify-center text-center px-4 border-b border-slate-800">
          <img src="/logo.png" alt="Occasio.Imob" className="h-12 object-contain filter brightness-0 invert" />
          <p className="text-[11px] font-semibold text-slate-400 mt-2 uppercase tracking-widest">SaaS Enterprise B2B</p>
        </div>

        <CardHeader className="p-6 pb-2 text-center">
          <CardTitle className="text-xl font-extrabold text-occasio-navy">Acessar Occasio.Imob</CardTitle>
          <CardDescription className="text-xs">
            Entre com suas credenciais para gerenciar vistorias e ordens de serviço.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 pt-4 space-y-4">
          
          {erro && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <AlertTitle className="font-bold">Acesso Negado</AlertTitle>
              <AlertDescription className="text-xs font-semibold">{erro}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <Input
                  type="email"
                  placeholder="seuemail@imobiliaria.com"
                  className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <KeyRound className="h-4 w-4" />
                </span>
                <Input
                  type="password"
                  placeholder="Digite sua senha"
                  className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold h-10 shadow-lg shadow-occasio-blue/25 transition-all mt-6"
            >
              {loading ? (
                <span className="flex items-center gap-1.5 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Conectando...
                </span>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
          </form>

          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              Acesso exclusivo para parceiros credenciados.<br/>
              Deseja credenciar sua empresa? Contate o Administrador.
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
