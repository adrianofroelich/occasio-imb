import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-occasio-navy pt-20 pb-32 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-occasio-blue/20 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-occasio-blue/10 blur-[80px]"></div>
        
        <div className="container relative mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            <div className="flex flex-col justify-center space-y-8 lg:order-last">
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Badge className="bg-occasio-blue/30 border border-occasio-blue/60 text-white hover:bg-occasio-blue/40 px-5 py-2.5 text-sm md:text-base rounded-full font-semibold tracking-wide transition-all duration-300">
                    Revolucionando a Manutenção Predial
                  </Badge>
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl xl:text-6xl/none">
                  Sua Imobiliária com <span className="text-occasio-blue">Manutenção Zero Stress.</span>
                </h1>
                <p className="max-w-[600px] text-lg text-slate-300 md:text-xl leading-relaxed">
                  Transforme o problema crítico da manutenção predial em uma oportunidade de eficiência, transparência e valorização patrimonial.
                </p>
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
            
            <div className="relative mx-auto w-full max-w-[450px] lg:max-w-none flex justify-center lg:order-first">
              <img 
                src="/Personagem1.png" 
                alt="Personagem Occasio Imob" 
                className="w-full max-h-[500px] object-contain drop-shadow-[0_35px_35px_rgba(0,0,0,0.4)] hover:scale-105 transition-transform duration-700 ease-out animate-in fade-in zoom-in"
              />
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
                <div className="flex justify-center mb-6">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-occasio-blue/10 transition-colors">
                    <img src="/tools.png" alt="Ferramentas" className="w-16 h-16 mix-blend-multiply object-contain group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-bold text-occasio-navy text-center">Gestão de Chamados</h3>
                <p className="text-slate-600 leading-relaxed">
                  Inquilinos abrem chamados rapidamente pelo celular. Imobiliárias fazem a triagem e direcionam para prestadores em segundos.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group overflow-hidden">
              <CardContent className="p-8">
                <div className="flex justify-center mb-6">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-occasio-blue/10 transition-colors">
                    <img src="/shovel.png" alt="Obras" className="w-16 h-16 mix-blend-multiply object-contain group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-bold text-occasio-navy text-center">Aprovação Inteligente</h3>
                <p className="text-slate-600 leading-relaxed">
                  Alçadas pré-definidas aprovam orçamentos de forma automática ou encaminham para validação do proprietário com um clique.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group overflow-hidden md:col-span-2 lg:col-span-1">
              <CardContent className="p-8">
                <div className="flex justify-center mb-6">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-occasio-blue/10 transition-colors">
                    <img src="/helmet.png" alt="Capacete de Auditoria" className="w-16 h-16 mix-blend-multiply object-contain group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-bold text-occasio-navy text-center">Auditoria e Histórico</h3>
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
    </>
  )
}
