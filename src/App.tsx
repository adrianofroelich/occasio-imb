import { ArrowRight, CheckCircle2, HardHat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-occasio-blue selection:text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 focus:outline-none transition-all duration-300 ease-in-out hover:scale-[2.8] origin-top-left z-50 cursor-pointer p-1 rounded-lg bg-gradient-to-t from-white/0 via-white/0 to-white/0 hover:from-white/95 hover:via-white hover:to-white border border-transparent hover:border-slate-200/50 hover:shadow-2xl"
            aria-label="Voltar ao topo"
          >
            <img src="/logo.png" alt="Occasio Imob" className="h-10 object-contain" />
          </button>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-occasio-blue transition-colors">Funcionalidades</a>
            <a href="#benefits" className="hover:text-occasio-blue transition-colors">Benefícios</a>
            <a href="#how-it-works" className="hover:text-occasio-blue transition-colors">Como Funciona</a>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden md:inline-flex text-occasio-navy hover:text-occasio-blue">
              Login
            </Button>
            <Button className="bg-occasio-blue hover:bg-occasio-navy text-white shadow-lg shadow-occasio-blue/20 transition-all">
              Agendar Demo
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-occasio-navy pt-20 pb-32 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-occasio-blue/20 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-occasio-blue/10 blur-[80px]"></div>
        
        <div className="container relative mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            <div className="flex flex-col justify-center space-y-8">
              <div className="space-y-4">
                <Badge className="bg-occasio-blue/20 text-occasio-blue hover:bg-occasio-blue/30 border-none px-3 py-1 text-sm">
                  Revolucionando a Manutenção Predial
                </Badge>
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl xl:text-6xl/none">
                  Sua Imobiliária com <span className="text-occasio-blue">Manutenção Zero Stress.</span>
                </h1>
                <p className="max-w-[600px] text-lg text-slate-300 md:text-xl leading-relaxed">
                  Transforme o problema crítico da manutenção predial em uma oportunidade de eficiência, transparência e valorização patrimonial.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-occasio-blue hover:bg-[#1a7bb5] text-white h-14 px-8 text-lg font-medium shadow-xl shadow-occasio-blue/20 transition-all hover:scale-105">
                  Acessar Plataforma <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-medium border-slate-600 text-occasio-navy bg-white hover:bg-slate-100 transition-all">
                  Falar com Consultor
                </Button>
              </div>
              
              <div className="flex items-center gap-6 pt-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-occasio-blue" />
                  <span>Para Imobiliárias</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-occasio-blue" />
                  <span>Para Inquilinos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-occasio-blue" />
                  <span>Para Prestadores</span>
                </div>
              </div>
            </div>
            
            <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none">
              <div className="relative rounded-3xl bg-[#002244] p-2 backdrop-blur-sm border border-white/10 shadow-2xl overflow-hidden">
                <img 
                  src="/helmet.png" 
                  alt="Capacete de Manutenção 3D" 
                  className="w-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700 ease-out animate-in fade-in zoom-in"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white relative">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-occasio-navy sm:text-4xl">
              Tudo o que você precisa em um só lugar
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              O fluxo de ponta a ponta centralizado: da abertura do chamado pelo inquilino até o encerramento com registro histórico.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group overflow-hidden">
              <CardContent className="p-8">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-occasio-blue/10 transition-colors">
                  <img src="/tools.png" alt="Ferramentas" className="w-16 h-16 mix-blend-multiply object-contain group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-occasio-navy">Gestão de Chamados</h3>
                <p className="text-slate-600 leading-relaxed">
                  Inquilinos abrem chamados rapidamente pelo celular. Imobiliárias fazem a triagem e direcionam para prestadores em segundos.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group overflow-hidden">
              <CardContent className="p-8">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-occasio-blue/10 transition-colors">
                  <img src="/shovel.png" alt="Obras" className="w-16 h-16 mix-blend-multiply object-contain group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-occasio-navy">Aprovação Inteligente</h3>
                <p className="text-slate-600 leading-relaxed">
                  Alçadas pré-definidas aprovam orçamentos de forma automática ou encaminham para validação do proprietário com um clique.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group overflow-hidden md:col-span-2 lg:col-span-1">
              <CardContent className="p-8">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-occasio-blue/10 transition-colors">
                  <HardHat className="h-8 w-8 text-occasio-blue group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-occasio-navy">Auditoria e Histórico</h3>
                <p className="text-slate-600 leading-relaxed">
                  Relatórios completos de conclusão com fotos do antes e depois. Histórico imutável de manutenção salvo para o imóvel.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-occasio-light py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="rounded-3xl bg-occasio-navy overflow-hidden relative shadow-2xl">
            <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-occasio-blue/20 to-transparent"></div>
            <div className="relative p-12 md:p-16 text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">
                Pronto para transformar sua gestão de manutenções?
              </h2>
              <p className="text-lg text-slate-300 mb-10">
                Junte-se às imobiliárias mais modernas do país e elimine as dores de cabeça com reformas e consertos.
              </p>
              <Button size="lg" className="bg-occasio-blue hover:bg-[#1a7bb5] text-white h-14 px-10 text-lg font-medium shadow-xl">
                Começar Agora
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-slate-200 text-center">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src="/logo.png" alt="Occasio Imob" className="h-8 object-contain" />
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
