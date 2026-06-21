import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  ShieldAlert, Loader2, KeyRound, Mail, 
  MessageSquare, Sparkles, Eye, EyeOff 
} from "lucide-react"

export default function Login() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()

  // Estados do formulário
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [verSenha, setVerSenha] = useState(false)

  // Estados operacionais
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Frases do Bob da Occasio
  const frases = [
    "Pode deixar comigo! Ferramentas prontas e café ainda não derramado.",
    "Se tem conserto, a OCCASIO tem solução!",
    "Nada de gambiarra por aqui. Vamos fazer direito!",
    "Enquanto você relaxa, a gente coloca a mão na massa.",
    "Bob à disposição! Qual serviço você precisa hoje?"
  ]

  const [indiceFrase, setIndiceFrase] = useState(0)
  const [animando, setAnimando] = useState(false)

  // Ciclo automático de frases a cada 6 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      proximaFrase()
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const proximaFrase = () => {
    setAnimando(true)
    setTimeout(() => {
      setIndiceFrase((prev) => (prev + 1) % frases.length)
      setAnimando(false)
    }, 300)
  }

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
    <div className="min-h-[85vh] bg-white flex flex-col items-center justify-center px-4 py-8 md:py-12 overflow-hidden relative">
      {/* Elementos de fundo sutis */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-occasio-blue/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-6xl w-full flex flex-col items-center relative z-10">
        
        {/* Cabeçalho superior com a logo e título */}
        <div className="text-center space-y-3 mb-8 animate-in fade-in slide-in-from-top duration-700">
          <div className="flex justify-center mb-2">
            <img src="/logo.png" alt="Occasio.Imob" className="h-10 object-contain" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-occasio-blue/10 border border-occasio-blue/20 text-occasio-blue text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Portal de Acesso ao Usuário
          </div>
        </div>

        {/* Grid com Mascotes e o Formulário Central */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full max-w-5xl">
          
          {/* Lado Esquerdo: Mascote Bob (Personagem 3) com Balão de Fala */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center space-y-4 animate-in fade-in slide-in-from-left duration-700 order-2 lg:order-none">
            {/* Balão de Fala do Bob */}
            <div className="relative w-full max-w-xs bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-lg shadow-slate-100/50">
              {/* Seta do balão apontando para baixo/esquerda no mobile, ou para baixo no desktop */}
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-slate-200 rotate-45"></div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-1.5 bg-slate-50 rounded-full text-occasio-blue">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <p 
                  className={`text-xs md:text-sm font-extrabold text-occasio-navy leading-relaxed transition-all duration-300 ${
                    animando ? "opacity-0 scale-95" : "opacity-100 scale-100"
                  }`}
                >
                  &ldquo;{frases[indiceFrase]}&rdquo;
                </p>
                <button 
                  onClick={proximaFrase}
                  className="text-[10px] text-slate-400 hover:text-occasio-blue font-bold border-b border-slate-100 hover:border-occasio-blue transition-colors"
                >
                  Próxima dica ☕
                </button>
              </div>
            </div>

            {/* Imagem do Bob */}
            <div className="relative group pt-2">
              <div className="absolute inset-0 bg-occasio-blue/10 rounded-full blur-xl group-hover:bg-occasio-blue/20 transition-all duration-500 scale-75"></div>
              <img 
                src="/Personagem3.png" 
                alt="Bob Mascote" 
                className="h-48 md:h-56 object-contain relative transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

          {/* Lado Central: Formulário de Login (Card) */}
          <div className="lg:col-span-5 flex justify-center animate-in fade-in zoom-in duration-700 order-1 lg:order-none">
            <Card className="w-full max-w-sm border-slate-200 shadow-xl shadow-slate-100 bg-white overflow-hidden hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="p-6 pb-2 text-center border-b border-slate-50">
                <CardTitle className="text-lg font-black text-occasio-navy">Acessar o Sistema</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Entre com suas credenciais de acesso
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                
                {erro && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    <AlertTitle className="font-bold text-xs">Erro</AlertTitle>
                    <AlertDescription className="text-[10px] font-semibold leading-normal">{erro}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      E-mail
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400">
                        <Mail className="h-4 w-4" />
                      </span>
                      <Input
                        type="email"
                        placeholder="seuemail@imobiliaria.com"
                        className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue h-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                   <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Senha
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400">
                        <KeyRound className="h-4 w-4" />
                      </span>
                      <Input
                        type={verSenha ? "text" : "password"}
                        placeholder="Digite sua senha"
                        className="pl-9 pr-10 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue h-9"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        disabled={loading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setVerSenha(!verSenha)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                        title={verSenha ? "Ocultar senha" : "Exibir senha"}
                      >
                        {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold h-9 shadow-lg shadow-occasio-blue/20 transition-all mt-4 cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-1.5 justify-center">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Conectando...
                      </span>
                    ) : (
                      "Entrar no Sistema"
                    )}
                  </Button>
                </form>

                <div className="text-center pt-3 border-t border-slate-100">
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Acesso restrito para inquilinos, proprietários, prestadores de serviço e imobiliárias credenciadas.
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Lado Direito: Mascote Técnico (Personagem 6) */}
          <div className="lg:col-span-3 flex justify-center animate-in fade-in slide-in-from-right duration-700 order-3 lg:order-none">
            <div className="relative group">
              <div className="absolute inset-0 bg-yellow-500/15 rounded-full blur-2xl group-hover:bg-yellow-500/25 transition-all duration-500 scale-75"></div>
              <img 
                src="/Personagem6.png" 
                alt="Técnico Mascote" 
                className="h-48 md:h-56 object-contain relative transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
