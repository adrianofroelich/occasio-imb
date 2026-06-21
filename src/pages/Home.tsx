import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { Button } from "@/components/ui/button"
import { 
  Wrench, ArrowRight, UserCheck, Play, 
  Sparkles, MessageSquare, Coffee, ShieldCheck 
} from "lucide-react"

export default function Home() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  
  // Frases da Occasio
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

  // Redireciona o usuário para seu painel específico caso já esteja logado
  const irParaPainel = () => {
    if (!perfil) return
    switch (perfil.perfil) {
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
      case "super_admin":
        navigate("/admin/dashboard")
        break
      default:
        navigate("/login")
    }
  }

  return (
    <div className="min-h-[85vh] bg-white flex flex-col items-center justify-center px-4 py-12 md:py-16 overflow-hidden relative">
      {/* Elementos de fundo sutis */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-occasio-blue/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-5xl w-full flex flex-col items-center relative z-10">
        
        {/* Cabeçalho de Boas-vindas com Micro-animação */}
        <div className="text-center space-y-4 mb-10 max-w-2xl animate-in fade-in slide-in-from-top duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-occasio-blue/10 border border-occasio-blue/20 text-occasio-blue text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Manutenção Inteligente Sem Estresse
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-occasio-navy tracking-tight leading-tight">
            Seja bem-vindo à <span className="text-occasio-blue">OCCASIO</span>
          </h1>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Conectamos proprietários, inquilinos, imobiliárias e prestadores de serviço em uma plataforma ágil, transparente e sem complicações.
          </p>
        </div>

        {/* Bloco Central com Mascotes e Balão de Fala */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-4 items-center w-full mb-12">
          
          {/* Mascote Bob (Esquerda - Personagem 3) */}
          <div className="md:col-span-3 flex justify-center order-2 md:order-1 animate-in fade-in slide-in-from-left duration-700">
            <div className="relative group">
              <div className="absolute inset-0 bg-occasio-blue/10 rounded-full blur-2xl group-hover:bg-occasio-blue/20 transition-all duration-500 scale-75"></div>
              <img 
                src="/Personagem3.png" 
                alt="Bob Mascote Occasio" 
                className="h-56 md:h-64 object-contain relative transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

          {/* Balão de Fala Centralizado (Meio) */}
          <div className="md:col-span-6 flex flex-col items-center justify-center order-1 md:order-2 px-4">
            <div className="relative w-full max-w-md bg-white border-2 border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:border-occasio-blue/30 transition-all duration-300">
              
              {/* Seta do balão para a esquerda (Bob) */}
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-4 h-4 bg-white border-b-2 border-l-2 border-slate-200/80 rotate-45 hidden md:block"></div>
              {/* Seta do balão para a direita (Técnico) */}
              <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-4 h-4 bg-white border-t-2 border-r-2 border-slate-200/80 rotate-45 hidden md:block"></div>
              {/* Seta para baixo no mobile */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-slate-200/80 rotate-45 md:hidden"></div>

              {/* Conteúdo da frase reativa */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-2 bg-slate-50 rounded-full text-occasio-blue">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p 
                  className={`text-sm md:text-base font-extrabold text-occasio-navy leading-relaxed transition-all duration-300 ${
                    animando ? "opacity-0 scale-95" : "opacity-100 scale-100"
                  }`}
                >
                  &ldquo;{frases[indiceFrase]}&rdquo;
                </p>
                <div className="pt-2">
                  <button 
                    onClick={proximaFrase}
                    className="text-xs text-slate-400 hover:text-occasio-blue font-semibold border-b border-slate-200 hover:border-occasio-blue pb-0.5 transition-colors"
                  >
                    Ver outra frase ☕
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mascote Técnico (Direita - Personagem 6) */}
          <div className="md:col-span-3 flex justify-center order-3 animate-in fade-in slide-in-from-right duration-700">
            <div className="relative group">
              <div className="absolute inset-0 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all duration-500 scale-75"></div>
              <img 
                src="/Personagem6.png" 
                alt="Técnico Occasio" 
                className="h-56 md:h-64 object-contain relative transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

        </div>

        {/* Painel de Ações e Portais */}
        <div className="w-full max-w-4xl bg-slate-50 border border-slate-200/80 rounded-2xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom duration-700">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-lg font-extrabold text-occasio-navy flex items-center gap-1.5 justify-center md:justify-start">
                <Wrench className="h-5 w-5 text-occasio-blue" />
                Como você deseja acessar a plataforma?
              </h3>
              <p className="text-xs text-slate-400">
                Selecione abaixo para entrar com suas credenciais ou utilizar o simulador de testes.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto">
              {user ? (
                <Button 
                  onClick={irParaPainel}
                  className="bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold py-5 px-6 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                >
                  <UserCheck className="h-4 w-4" />
                  Ir para meu Painel
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={() => navigate("/login")}
                    className="bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold py-5 px-6 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                  >
                    Acessar o Sistema
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  {!import.meta.env.PROD && (
                    <Button 
                      onClick={() => navigate("/login-teste")}
                      variant="outline"
                      className="border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold py-5 px-6 rounded-lg transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <Play className="h-4 w-4 text-occasio-blue" />
                      Simulador de Perfis
                    </Button>
                  )}
                </>
              )}
            </div>

          </div>
        </div>

        {/* Pilares da Occasio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mt-10 text-center animate-in fade-in duration-1000">
          <div className="space-y-1.5 p-4">
            <div className="mx-auto w-8 h-8 rounded-full bg-occasio-blue/10 flex items-center justify-center text-occasio-blue mb-1">
              <Coffee className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-bold text-occasio-navy">Agilidade</h4>
            <p className="text-[11px] text-slate-400">Chamados e vistorias em tempo real na palma da mão.</p>
          </div>
          <div className="space-y-1.5 p-4">
            <div className="mx-auto w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mb-1">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-bold text-occasio-navy">Transparência</h4>
            <p className="text-[11px] text-slate-400">Aprovações rápidas e registros com antes e depois.</p>
          </div>
          <div className="space-y-1.5 p-4">
            <div className="mx-auto w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 mb-1">
              <Wrench className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-bold text-occasio-navy">Sem Gambiarras</h4>
            <p className="text-[11px] text-slate-400">Técnicos homologados fazendo o trabalho direito.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
