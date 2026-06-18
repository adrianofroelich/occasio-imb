import { CheckCircle2, TrendingUp, ShieldCheck, HeartHandshake, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function Beneficios() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section - Benefícios */}
      <section className="relative overflow-hidden bg-occasio-navy pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-occasio-blue/20 blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-occasio-blue/10 blur-[80px]"></div>
        
        <div className="container relative mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            {/* Texto (Desktop: Direita, Mobile: Topo) */}
            <div className="flex flex-col justify-center space-y-6 lg:order-last">
              <div className="space-y-4">
                <div className="flex justify-center lg:justify-start">
                  <Badge className="bg-occasio-blue/30 border border-occasio-blue/60 text-white hover:bg-occasio-blue/40 px-5 py-2 text-sm md:text-base rounded-full font-semibold tracking-wide transition-all duration-300">
                    Gestão Patrimonial & ROI
                  </Badge>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl xl:text-5xl">
                  Valorize seus Imóveis. <br />
                  <span className="text-occasio-blue">Fidelize seus Clientes.</span>
                </h1>
                <p className="max-w-[600px] text-base text-slate-300 md:text-lg leading-relaxed">
                  A manutenção inteligente não é apenas consertar goteiras. É a blindagem jurídica, a preservação do valor de mercado do imóvel e a garantia de contratos de aluguel mais duradouros para sua imobiliária.
                </p>
              </div>
              
              <div className="space-y-3 pt-2 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-occasio-blue flex-shrink-0" />
                  <span>Atração de proprietários qualificados para sua carteira.</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-occasio-blue flex-shrink-0" />
                  <span>Redução imediata na vacância de imóveis.</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-occasio-blue flex-shrink-0" />
                  <span>Controle total de depreciação de ativos.</span>
                </div>
              </div>
            </div>
            
            {/* Imagem (Desktop: Esquerda, Mobile: Embaixo) */}
            <div className="relative mx-auto w-full max-w-[320px] lg:max-w-none flex justify-center lg:order-first">
              <img 
                src="/Personagem2.png" 
                alt="Mascote na Escada" 
                className="w-full max-h-[350px] object-contain drop-shadow-[0_25px_25px_rgba(0,0,0,0.45)] hover:scale-105 transition-transform duration-700 ease-out animate-in fade-in zoom-in"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Seção Detalhada de Benefícios */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-occasio-navy sm:text-4xl">
              Por que investir em Manutenção Automatizada?
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
              Veja como transformamos o setor mais estressante da imobiliária em um motor de crescimento e confiabilidade técnica.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Benefício 1 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-occasio-blue group-hover:bg-occasio-blue group-hover:text-white transition-colors">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-occasio-navy">Retenção de Inquilinos</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Chamados de reparo ignorados geram insatisfação e quebra de contratos. Com respostas rápidas e transparentes, o inquilino se sente seguro e renova a locação.
                </p>
              </CardContent>
            </Card>

            {/* Benefício 2 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-occasio-blue group-hover:bg-occasio-blue group-hover:text-white transition-colors">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="Valorização do Ativo"></h3 >
                <h3 className="mb-2 text-lg font-bold text-occasio-navy">Valorização do Ativo</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Evite custos brutais com reformas tardias. O acompanhamento periódico e a auditoria de problemas (como infiltrações) barram a depreciação e protegem o imóvel.
                </p>
              </CardContent>
            </Card>

            {/* Benefício 3 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-occasio-blue group-hover:bg-occasio-blue group-hover:text-white transition-colors">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-occasio-navy">Segurança e Auditoria</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  O histórico imutável com fotos de "Antes e Depois" protege juridicamente a imobiliária e o proprietário contra contestações e processos de vistoria.
                </p>
              </CardContent>
            </Card>

            {/* Benefício 4 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-xl hover:border-occasio-blue/30 transition-all group">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-occasio-blue group-hover:bg-occasio-blue group-hover:text-white transition-colors">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-occasio-navy">Eficiência da Equipe</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Chega de e-mails infinitos e planilhas confusas. Cotações automáticas e fluxos de aprovação de alçada liberam até 80% do tempo de atendimento da imobiliária.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Seção Estatísticas (Destaque e Impacto) */}
      <section className="bg-occasio-navy py-20 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
              Resultados Reais em Gestão de Manutenção
            </h2>
            <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
              Indicadores médios levantados por imobiliárias que digitalizaram e automatizaram seu setor de reformas e consertos.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="text-4xl font-extrabold text-occasio-blue sm:text-5xl mb-2">-35%</div>
              <div className="text-base font-semibold text-white mb-1">Tempo de Vacância</div>
              <p className="text-xs text-slate-400">Imóveis prontos para re-locar em muito menos tempo após a saída do inquilino.</p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="text-4xl font-extrabold text-occasio-blue sm:text-5xl mb-2">-40%</div>
              <div className="text-base font-semibold text-white mb-1">Custo de Reparos</div>
              <p className="text-xs text-slate-400">Economia em obras corretivas pesadas através de manutenções preventivas programadas.</p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="text-4xl font-extrabold text-occasio-blue sm:text-5xl mb-2">92%</div>
              <div className="text-base font-semibold text-white mb-1">Fidelização de Inquilinos</div>
              <p className="text-xs text-slate-400">Moradores que recomendam ou renovam aluguel pela rapidez de resolução de problemas.</p>
            </div>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="text-4xl font-extrabold text-occasio-blue sm:text-5xl mb-2">3x Mais</div>
              <div className="text-base font-semibold text-white mb-1">Produtividade</div>
              <p className="text-xs text-slate-400">Capacidade da imobiliária de gerenciar chamados e fechar orçamentos sem inchar a equipe.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
