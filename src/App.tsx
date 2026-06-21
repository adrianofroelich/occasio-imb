import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom"
import Home from "./pages/Home"
import Beneficios from "./pages/Beneficios"
import { Button } from "@/components/ui/button"
import { AuthProvider, useAuth } from "./hooks/useAuth"
import type { TipoPerfil } from "./hooks/useAuth"
import { Loader2 } from "lucide-react"
import LoginTeste from "./pages/LoginTeste"
import Login from "./pages/Login"
import Imoveis from "./pages/imobiliaria/Imoveis"
import Dashboard from "./pages/imobiliaria/Dashboard"
import Clientes from "./pages/imobiliaria/Clientes"
import InquilinoDashboard from "./pages/inquilino/Dashboard"
import PrestadorDashboard from "./pages/prestador/Dashboard"
import ProprietarioDashboard from "./pages/proprietario/Dashboard"
import AdminDashboard from "./pages/admin/Dashboard"
import PrestadorEquipe from "./pages/prestador/Equipe"

// Componente auxiliar para tratar rolagem suave de âncoras (hash)
// e garantir que a página role para o topo ao alternar de rota
function ScrollToHash() {
  const location = useLocation()
  
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.substring(1)
      const element = document.getElementById(id)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" })
        }, 100)
      }
    } else {
      window.scrollTo(0, 0)
    }
  }, [location])
  
  return null
}

// Componente de Rota Protegida com base em autenticação e perfil
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: TipoPerfil[] }) {
  const { user, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
      </div>
    )
  }

  if (!user || !perfil) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles && !allowedRoles.includes(perfil.perfil)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Layout principal unificado para cabeçalho e rodapé compartilhados
function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === "/"
  const { user, perfil, signOut } = useAuth()

  // Ação de clique na logo (rola para o topo se já estiver na home, senão vai para a home)
  const handleLogoClick = () => {
    if (isHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate("/")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-occasio-blue selection:text-white flex flex-col">
      {/* Navbar principal */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          {/* Botão de Logomarca Interativa com zoom no hover */}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 focus:outline-none transition-all duration-300 ease-in-out hover:scale-[2.8] origin-top-left z-50 cursor-pointer p-1 rounded-lg bg-gradient-to-t from-white/0 via-white/0 to-white/0 hover:from-white/95 hover:via-white hover:to-white border border-transparent hover:border-slate-200/50 hover:shadow-2xl"
            aria-label="Ir para a página inicial"
          >
            <img src="/logo.png" alt="Occasio Imob" className="h-10 object-contain" />
          </button>
          
          {/* Navegação de Links (detecta rota atual para redirecionamento correto) */}
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-600 items-center">
            {!user && (
              <Link 
                to="/beneficios" 
                className={`${location.pathname === "/beneficios" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
              >
                Benefícios
              </Link>
            )}

            {/* Links administrativos exclusivos para Imobiliária ou Super Admin */}
            {(perfil?.perfil === "imobiliaria" || perfil?.perfil === "super_admin") && (
              <>
                <Link 
                  to="/imobiliaria/clientes" 
                  className={`${location.pathname === "/imobiliaria/clientes" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
                >
                  Clientes
                </Link>
                <Link 
                  to="/imobiliaria/imoveis" 
                  className={`${location.pathname === "/imobiliaria/imoveis" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
                >
                  Imóveis
                </Link>
                <Link 
                  to="/imobiliaria/dashboard" 
                  className={`${location.pathname === "/imobiliaria/dashboard" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
                >
                  Painel OS
                </Link>
              </>
            )}

            {/* Links exclusivos para Inquilino ou Super Admin */}
            {(perfil?.perfil === "inquilino" || perfil?.perfil === "super_admin") && (
              <Link 
                to="/inquilino/dashboard" 
                className={`${location.pathname === "/inquilino/dashboard" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
              >
                Meu Chamado
              </Link>
            )}

            {/* Links exclusivos para Prestador ou Super Admin */}
            {(perfil?.perfil === "prestador" || perfil?.perfil === "super_admin") && (
              <>
                <Link 
                  to="/prestador/dashboard" 
                  className={`${location.pathname === "/prestador/dashboard" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
                >
                  Painel Prestador
                </Link>
                {/* Se for prestador empresa (conta-mãe), mostra o link Minha Equipe */}
                {(perfil?.perfil === "prestador" && !perfil?.empresa_mae_id) && (
                  <Link 
                    to="/prestador/equipe" 
                    className={`${location.pathname === "/prestador/equipe" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
                  >
                    Minha Equipe
                  </Link>
                )}
              </>
            )}
            
            {/* Links exclusivos para Proprietário ou Super Admin */}
            {(perfil?.perfil === "proprietario" || perfil?.perfil === "super_admin") && (
              <Link 
                to="/proprietario/dashboard" 
                className={`${location.pathname === "/proprietario/dashboard" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
              >
                Painel Proprietário
              </Link>
            )}

            {/* Links exclusivos para Super Admin */}
            {perfil?.perfil === "super_admin" && (
              <Link 
                to="/admin/dashboard" 
                className={`${location.pathname === "/admin/dashboard" ? "text-occasio-blue font-bold border-b-2 border-occasio-blue pb-1" : "hover:text-occasio-blue"} transition-colors`}
              >
                Painel Admin
              </Link>
            )}

            {!import.meta.env.PROD && (
              <Link 
                to="/login-teste" 
                className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2.5 py-1 rounded transition-all font-semibold"
              >
                Simulador
              </Link>
            )}
          </nav>
          
          {/* Botões de Ação da Direita */}
          <div className="flex items-center gap-2 sm:gap-4">
            {user && perfil ? (
              <div className="flex items-center gap-2 md:gap-4 text-xs">
                <span className="hidden lg:inline text-slate-500 font-medium">
                  Olá, <strong className="text-occasio-navy">{perfil.nome.split(" ")[0]}</strong> ({perfil.perfil.replace("_", " ")})
                </span>
                <Button 
                  variant="outline" 
                  onClick={signOut}
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs px-2.5 h-8 py-1"
                >
                  Sair
                </Button>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                onClick={() => navigate("/login")}
                className="text-occasio-navy hover:text-occasio-blue text-sm md:text-base px-2 md:px-4"
              >
                Entrar
              </Button>
            )}
            {!user && (
              <Button className="bg-occasio-blue hover:bg-occasio-navy text-white shadow-lg shadow-occasio-blue/20 transition-all text-xs sm:text-sm px-3 sm:px-4">
                Agendar Demo
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Dinâmico das Páginas */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/beneficios" element={<Beneficios />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login-teste" element={<LoginTeste />} />
          <Route path="/imobiliaria/clientes" element={<ProtectedRoute allowedRoles={["imobiliaria", "super_admin"]}><Clientes /></ProtectedRoute>} />
          <Route path="/imobiliaria/imoveis" element={<ProtectedRoute allowedRoles={["imobiliaria", "super_admin"]}><Imoveis /></ProtectedRoute>} />
          <Route path="/imobiliaria/dashboard" element={<ProtectedRoute allowedRoles={["imobiliaria", "super_admin"]}><Dashboard /></ProtectedRoute>} />
          <Route path="/inquilino/dashboard" element={<ProtectedRoute allowedRoles={["inquilino", "super_admin"]}><InquilinoDashboard /></ProtectedRoute>} />
          <Route path="/prestador/dashboard" element={<ProtectedRoute allowedRoles={["prestador", "super_admin"]}><PrestadorDashboard /></ProtectedRoute>} />
          <Route path="/proprietario/dashboard" element={<ProtectedRoute allowedRoles={["proprietario", "super_admin"]}><ProprietarioDashboard /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["super_admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/vinculos" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/prestador/equipe" element={<ProtectedRoute allowedRoles={["prestador", "super_admin"]}><PrestadorEquipe /></ProtectedRoute>} />
        </Routes>
      </main>

      {/* Rodapé compartilhado */}
      <footer className="bg-white py-12 border-t border-slate-200 text-center">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/" onClick={() => { if (isHome) window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
              <img src="/logo.png" alt="Occasio Imob" className="h-8 object-contain" />
            </Link>
          </div>
          <p className="text-slate-500 mb-6">
            Oportunidade de eficiência e valorização patrimonial.
          </p>
          <div className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Occasio.Imob. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}

// Componente Root com Router configurado
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToHash />
        <MainLayout />
      </BrowserRouter>
    </AuthProvider>
  )
}
