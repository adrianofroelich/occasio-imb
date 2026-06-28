import { X, Printer, Hammer, Camera, Building, User, FileText, CheckCircle2 } from "lucide-react"

interface LaudoTecnicoProps {
  chamado: {
    id: string
    titulo: string
    descricao_problema: string
    categoria: string
    status: string
    criado_em: string
    imovel: {
      codigo_imovel: string
      endereco: string
      limite_alcada_r$: number
    }
    inquilino: {
      nome: string
    }
    orcamentos?: {
      id: string
      valor_servico_r$: number
      valor_materiais_r$: number
      valor_total_r$: number
      prazo_execucao_dias: number
      observacoes_tecnicas: string
      relatorio_conclusao?: string
      prestador: {
        nome: string
      }
    }[]
  }
  midias: {
    id: string
    url_storage: string
    tipo_midia: string
  }[]
  onClose: () => void
  imobiliaria?: {
    nome: string
    logo_url: string | null
  } | null
}

export default function LaudoTecnico({ chamado, midias, onClose, imobiliaria }: LaudoTecnicoProps) {
  // Filtra as fotos do "Antes" (enviadas pelo Inquilino) e do "Depois" (enviadas pelo Prestador)
  const fotosAntes = midias.filter(m => m.tipo_midia === "antes")
  const fotosDepois = midias.filter(m => m.tipo_midia === "depois")

  // Obtém o orçamento ativo/aprovado
  const orcamento = chamado.orcamentos?.[0]
  const valorMaoDeObra = orcamento?.valor_servico_r$ || 0
  const valorMateriais = orcamento?.valor_materiais_r$ || 0
  const valorTotal = orcamento?.valor_total_r$ || (valorMaoDeObra + valorMateriais)
  const prazoDias = orcamento?.prazo_execucao_dias || 0
  const prestadorNome = orcamento?.prestador?.nome || "Técnico Parceiro"
  const relatorioTecnico = orcamento?.relatorio_conclusao || "Nenhum relatório técnico foi enviado."

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto print:bg-white print:p-0 print:block print:relative print:z-0">
      
      {/* Container Principal */}
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden print:shadow-none print:border-none print:max-h-none print:overflow-visible print:w-full">
        
        {/* Barra superior de Ações (Oculta na impressão) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-occasio-blue" />
            <span className="font-extrabold text-occasio-navy text-sm">Laudo Técnico de Manutenção</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              type="button"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo do Laudo */}
        <div className="flex-grow p-8 overflow-y-auto space-y-6 print:overflow-visible print:p-0">
          
          {/* Cabeçalho do Laudo (Print-friendly) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-4 gap-4">
            <div className="flex items-center gap-3">
              {imobiliaria?.logo_url ? (
                <img 
                  src={imobiliaria.logo_url} 
                  alt={imobiliaria.nome} 
                  className="h-12 max-h-12 w-auto object-contain rounded" 
                />
              ) : (
                <img src="/logo.png" alt="Occasio.Imob" className="h-10 object-contain mb-2 print:h-12" />
              )}
              <div className="border-l border-slate-200 pl-3">
                <p className="text-xs font-bold text-slate-800">
                  {imobiliaria?.nome || "Occasio.Imob"}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider print:text-slate-500">
                  Laudo Técnico Consolidado de Manutenção Imobiliária
                </p>
              </div>
            </div>
            <div className="text-right sm:text-right text-xs text-slate-500 space-y-0.5 print:text-slate-800">
              <div>Chamado: <strong className="text-slate-800 font-bold">#{chamado.id.slice(0, 8).toUpperCase()}</strong></div>
              <div>Data de Emissão: <strong className="text-slate-800 font-bold">{new Date().toLocaleDateString("pt-BR")}</strong></div>
              <div>Status: <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize print:bg-transparent print:border-none print:p-0">Concluído &amp; Encerrado</span></div>
            </div>
          </div>

          {/* Grid de Informações Base */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Bloco 1: Cadastro do Imóvel e Inquilino */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-white print:border-slate-300">
                <h3 className="text-xs font-bold text-occasio-navy flex items-center gap-1.5 uppercase border-b border-slate-200 pb-1.5 mb-3 print:text-slate-900">
                  <Building className="h-4 w-4 text-occasio-blue" />
                  Imóvel &amp; Contrato
                </h3>
                <div className="text-xs space-y-1.5">
                  <div>Código de Identificação: <strong className="text-slate-700 font-bold">{chamado.imovel.codigo_imovel}</strong></div>
                  <div>Endereço: <span className="text-slate-600 font-medium">{chamado.imovel.endereco}</span></div>
                  <div className="pt-1 border-t border-slate-200/50 mt-1.5">Inquilino Responsável: <strong className="text-slate-700 font-bold">{chamado.inquilino.nome}</strong></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-white print:border-slate-300">
                <h3 className="text-xs font-bold text-occasio-navy flex items-center gap-1.5 uppercase border-b border-slate-200 pb-1.5 mb-3 print:text-slate-900">
                  <User className="h-4 w-4 text-occasio-blue" />
                  Ocorrência do Chamado
                </h3>
                <div className="text-xs space-y-1.5">
                  <div>Categoria do Problema: <strong className="text-slate-700 font-bold">{chamado.categoria}</strong></div>
                  <div>Título da Manutenção: <strong className="text-slate-700 font-bold">{chamado.titulo}</strong></div>
                  <div>Data de Abertura: <span className="text-slate-600">{new Date(chamado.criado_em).toLocaleDateString("pt-BR")}</span></div>
                  <div className="pt-2 border-t border-slate-200/50 mt-2">
                    <span className="block font-bold text-[10px] text-slate-400 uppercase mb-1">Problema Relatado:</span>
                    <p className="text-slate-600 leading-relaxed italic">&ldquo;{chamado.descricao_problema}&rdquo;</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Orçamento e Execução Técnica */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-white print:border-slate-300">
                <h3 className="text-xs font-bold text-occasio-navy flex items-center gap-1.5 uppercase border-b border-slate-200 pb-1.5 mb-3 print:text-slate-900">
                  <Hammer className="h-4 w-4 text-occasio-blue" />
                  Custos &amp; Proposta de Execução
                </h3>
                <div className="text-xs space-y-2">
                  <div>Técnico Executor: <strong className="text-slate-700 font-bold">{prestadorNome}</strong></div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Mão de Obra</span>
                      <span className="font-semibold text-slate-700">
                        {valorMaoDeObra.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Materiais</span>
                      <span className="font-semibold text-slate-700">
                        {valorMateriais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-800">Custo Total Aprovado:</span>
                    <strong className="text-occasio-blue text-sm font-extrabold print:text-slate-900">
                      {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                  </div>
                  <div>Prazo Estimado de Execução: <strong className="text-slate-700">{prazoDias} dias úteis</strong></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-white print:border-slate-300">
                <h3 className="text-xs font-bold text-occasio-navy flex items-center gap-1.5 uppercase border-b border-slate-200 pb-1.5 mb-3 print:text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-occasio-blue" />
                  Relatório Técnico de Execução
                </h3>
                <div className="text-xs">
                  <span className="block font-bold text-[10px] text-slate-400 uppercase mb-1.5">Conclusão do Prestador:</span>
                  <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded border border-slate-200/50 italic print:border-none print:p-0">
                    &ldquo;{relatorioTecnico}&rdquo;
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Comparativo Visual Lado a Lado */}
          <div className="space-y-3 pt-4 border-t border-slate-200 print:break-inside-avoid">
            <h3 className="text-xs font-bold text-occasio-navy flex items-center gap-1.5 uppercase print:text-slate-900">
              <Camera className="h-4 w-4 text-occasio-blue" />
              Comparativo Visual: Antes e Depois
            </h3>

            <div className="grid grid-cols-2 gap-4">
              
              {/* Fotos do Antes */}
              <div className="space-y-2">
                <span className="block text-center text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-150 py-1 rounded print:bg-transparent print:border-none print:text-slate-800">
                  ANTES (Vistoria Inicial Inquilino)
                </span>
                <div className="grid gap-2">
                  {fotosAntes.length > 0 ? (
                    fotosAntes.map(foto => (
                      <div key={foto.id} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50 print:border-slate-400">
                        <img src={foto.url_storage} alt="Antes da manutenção" className="w-full h-full object-cover" />
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center aspect-video bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                      Nenhuma imagem enviada.
                    </div>
                  )}
                </div>
              </div>

              {/* Fotos do Depois */}
              <div className="space-y-2">
                <span className="block text-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 py-1 rounded print:bg-transparent print:border-none print:text-slate-800">
                  DEPOIS (Finalização do Conserto)
                </span>
                <div className="grid gap-2">
                  {fotosDepois.length > 0 ? (
                    fotosDepois.map(foto => (
                      <div key={foto.id} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50 print:border-slate-400">
                        <img src={foto.url_storage} alt="Depois da manutenção" className="w-full h-full object-cover" />
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center aspect-video bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                      Nenhuma imagem enviada.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Assinaturas da Emissão */}
          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-400 border-t border-slate-200 mt-12 print:break-inside-avoid print:text-slate-800">
            <div>
              <div className="w-3/4 mx-auto border-b border-slate-300 pb-1 mb-1" />
              <span>Gestão de Manutenção - Imobiliária Responsável</span>
            </div>
            <div>
              <div className="w-3/4 mx-auto border-b border-slate-300 pb-1 mb-1" />
              <span>Homologação e Arquivamento - Occasio.Imob</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
