import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Loader2, AlertCircle, FileText } from "lucide-react"

interface ReciboData {
  fechamento: {
    mes: number
    ano: number
    total_pago_tecnicos: number
    criado_em: string
    empresa: {
      nome: string
      documento_identificacao: string | null
      telefone: string | null
      email: string | null
      logo_url?: string | null
    }
  }
  tecnico: {
    nome: string
    documento_identificacao: string | null
  }
  chamados: {
    id: string
    titulo: string
    data_conclusao: string | null
    criado_em: string
    imovel: {
      codigo_imovel: string
      endereco: string
    }
    orcamento: {
      valor_servico_tecnico_r$: number
      valor_materiais_tecnico_r$: number
      responsavel_material_tecnico: string
    }
  }[]
}

// Helper para valor por extenso em Português
function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais"

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"]
  const dezenas_10_19 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
  const dezenas = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
  const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]

  const extrairCentena = (num: number) => {
    let result = ""
    const c = Math.floor(num / 100)
    const d = Math.floor((num % 100) / 10)
    const u = num % 10

    if (c > 0) {
      if (c === 1 && d === 0 && u === 0) {
        return "cem"
      }
      result += (c === 1 ? "cento" : centenas[c])
    }

    if (d > 0) {
      if (result) result += " e "
      if (d === 1) {
        result += dezenas_10_19[u]
        return result
      } else {
        result += dezenas[d]
      }
    }

    if (u > 0) {
      if (result) result += " e "
      result += unidades[u]
    }

    return result
  }

  const parteInteira = Math.floor(valor)
  const centavos = Math.round((valor - parteInteira) * 100)

  let extensoReais = ""
  if (parteInteira > 0) {
    if (parteInteira < 1000) {
      extensoReais = extrairCentena(parteInteira)
    } else {
      const milhares = Math.floor(parteInteira / 1000)
      const resto = parteInteira % 1000
      const extensoMilhares = milhares === 1 ? "mil" : extrairCentena(milhares) + " mil"
      const extensoResto = resto > 0 ? " e " + extrairCentena(resto) : ""
      extensoReais = extensoMilhares + extensoResto
    }
    extensoReais += (parteInteira === 1 ? " real" : " reais")
  }

  let extensoCentavos = ""
  if (centavos > 0) {
    if (extensoReais) extensoCentavos = " e "
    if (centavos < 10) {
      extensoCentavos += unidades[centavos]
    } else if (centavos < 20) {
      extensoCentavos += dezenas_10_19[centavos - 10]
    } else {
      const d = Math.floor(centavos / 10)
      const u = centavos % 10
      extensoCentavos += dezenas[d]
      if (u > 0) extensoCentavos += " e " + unidades[u]
    }
    extensoCentavos += (centavos === 1 ? " centavo" : " centavos")
  }

  return extensoReais + extensoCentavos
}

// Máscaras brasileiras para CPF e CNPJ
function formatarCpfCnpj(doc: string | null): string {
  if (!doc) return "Não informado"
  const limpo = doc.replace(/\D/g, "")
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }
  return doc
}

export default function ReciboTecnicoPrint() {
  const { fechamento_id, tecnico_id } = useParams<{ fechamento_id: string; tecnico_id: string }>()
  const [data, setData] = useState<ReciboData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDadosRecibo() {
      if (!fechamento_id || !tecnico_id) return
      try {
        setLoading(true)
        
        // 1. Busca dados do fechamento e da prestadora
        const { data: fechamentoData, error: fError } = await supabase
          .from("fechamentos_tecnicos")
          .select(`
            *,
            empresa:empresa_prestadora_id (
              nome,
              documento_identificacao,
              telefone,
              email,
              logo_url
            )
          `)
          .eq("id", fechamento_id)
          .single()

        if (fError) throw fError
        if (!fechamentoData) throw new Error("Fechamento não encontrado.")

        // 2. Busca dados do perfil do técnico
        const { data: tecnicoData, error: tError } = await supabase
          .from("perfis")
          .select("nome, documento_identificacao")
          .eq("id", tecnico_id)
          .single()

        if (tError) throw tError
        if (!tecnicoData) throw new Error("Técnico não encontrado.")

        // 3. Busca chamados vinculados a este fechamento e técnico
        const { data: chamadosData, error: cError } = await supabase
          .from("chamados")
          .select(`
            id,
            titulo,
            data_conclusao,
            criado_em,
            imovel:imovel_id (codigo_imovel, endereco),
            orcamentos (
              valor_servico_tecnico_r$,
              valor_materiais_tecnico_r$,
              responsavel_material_tecnico,
              homologado_pela_empresa
            )
          `)
          .eq("fechamento_tecnico_id", fechamento_id)
          .eq("tecnico_id", tecnico_id)

        if (cError) throw cError

        const chamadosMapeados = (chamadosData || []).map((c: any) => {
          const orc = c.orcamentos?.find((o: any) => o.homologado_pela_empresa)
          return {
            id: c.id,
            titulo: c.titulo,
            data_conclusao: c.data_conclusao,
            criado_em: c.criado_em,
            imovel: c.imovel,
            orcamento: {
              valor_servico_tecnico_r$: Number(orc?.valor_servico_tecnico_r$ || 0),
              valor_materiais_tecnico_r$: Number(orc?.valor_materiais_tecnico_r$ || 0),
              responsavel_material_tecnico: orc?.responsavel_material_tecnico || 'empresa'
            }
          }
        })

        setData({
          fechamento: fechamentoData as any,
          tecnico: tecnicoData as any,
          chamados: chamadosMapeados
        })
      } catch (err: any) {
        console.error("Erro ao carregar dados do recibo:", err)
        setError(err.message || "Não foi possível carregar os dados para gerar o recibo.")
      } finally {
        setLoading(false)
      }
    }

    carregarDadosRecibo()
  }, [fechamento_id, tecnico_id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-500 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
        <span className="text-sm font-semibold">Carregando dados para geração do recibo...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-slate-500 bg-white p-6 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <h2 className="text-lg font-bold text-slate-800">Falha ao Gerar Recibo</h2>
        <p className="text-sm max-w-sm text-slate-500">{error || "Fechamento ou Técnico inválido."}</p>
        <Button onClick={() => window.close()} className="bg-occasio-blue text-white">
          Fechar Janela
        </Button>
      </div>
    )
  }

  // Cálculo do total geral deste recibo
  const totalRecibo = data.chamados.reduce((acc, c) => {
    const mo = c.orcamento.valor_servico_tecnico_r$
    const mat = c.orcamento.responsavel_material_tecnico === 'tecnico' ? c.orcamento.valor_materiais_tecnico_r$ : 0
    return acc + mo + mat
  }, 0)

  const hoje = new Date()
  const dataExtenso = hoje.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })

  return (
    <div className="bg-white min-h-screen p-8 md:p-16 max-w-[800px] mx-auto text-slate-800 relative font-sans leading-relaxed selection:bg-occasio-blue selection:text-white">
      {/* Botões do Topo (Ocultos ao imprimir) */}
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <Button 
          variant="outline" 
          onClick={() => window.close()}
          className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Fechar Guia
        </Button>
        <Button 
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-bold bg-occasio-blue hover:bg-occasio-navy text-white shadow-sm"
        >
          <Printer className="h-4 w-4" /> Imprimir Recibo / Salvar PDF
        </Button>
      </div>

      {/* Recibo Estruturado */}
      <div className="border-[3px] border-double border-slate-800 p-8 space-y-6 bg-white relative">
        {/* Marca d'água decorativa no topo */}
        <div className="absolute top-2 right-4 text-[10px] font-bold text-slate-400 font-mono">
          Ref. Competência {String(data.fechamento.mes).padStart(2, '0')}/{data.fechamento.ano}
        </div>

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b pb-4 gap-4">
          <div className="text-center sm:text-left space-y-1.5 flex-grow">
            <h1 className="text-lg font-black uppercase tracking-wider text-slate-900">
              Recibo de Pagamento de Prestação de Serviços
            </h1>
            <div className="text-xs text-slate-600 font-semibold uppercase">
              Emitido por: {data.fechamento.empresa.nome}
            </div>
            {data.fechamento.empresa.documento_identificacao && (
              <div className="text-xs text-slate-500 font-mono">
                CNPJ: {formatarCpfCnpj(data.fechamento.empresa.documento_identificacao)}
              </div>
            )}
          </div>
          {data.fechamento.empresa.logo_url && (
            <img 
              src={data.fechamento.empresa.logo_url} 
              alt={data.fechamento.empresa.nome} 
              className="h-14 max-h-14 w-auto object-contain rounded border border-slate-200 p-0.5 bg-white flex-shrink-0" 
            />
          )}
        </div>

        {/* Corpo do Recibo */}
        <div className="space-y-4 text-sm text-justify">
          <div className="bg-slate-50 border p-3 rounded flex justify-between items-center font-bold text-slate-900">
            <span>VALOR LÍQUIDO:</span>
            <span className="text-lg font-mono">R$ {totalRecibo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>

          <p>
            Recebi(emos) de <strong className="text-slate-950">{data.fechamento.empresa.nome}</strong>, CNPJ n.º <strong>{formatarCpfCnpj(data.fechamento.empresa.documento_identificacao)}</strong>, a importância líquida de <strong>R$ {totalRecibo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> (<span className="italic">{valorPorExtenso(totalRecibo)}</span>), correspondente ao pagamento de mão de obra e reembolso de despesas de materiais efetuados no desempenho de serviços técnicos de manutenção de campo, referentes ao lote de competência <strong>{String(data.fechamento.mes).padStart(2, '0')}/{data.fechamento.ano}</strong>.
          </p>

          <p>
            Damos, por meio deste instrumento, plena, geral e irrevogável quitação pelos serviços prestados nas Ordens de Serviço discriminadas abaixo, sem mais nada a reclamar a qualquer título.
          </p>
        </div>

        {/* Detalhamento de Ordens de Serviço */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1 border-b pb-1">
            <FileText className="h-3.5 w-3.5" /> Serviços Inclusos e Reembolsos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <th className="py-2 px-2">Cód. Imóvel</th>
                  <th className="py-2 px-2">Título do Serviço / OS</th>
                  <th className="py-2 px-2 text-right">Mão de Obra</th>
                  <th className="py-2 px-2 text-right">Reembolso Material</th>
                  <th className="py-2 px-2 text-right">Total OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.chamados.map(c => {
                  const mo = c.orcamento.valor_servico_tecnico_r$
                  const mat = c.orcamento.responsavel_material_tecnico === 'tecnico' ? c.orcamento.valor_materiais_tecnico_r$ : 0
                  const totalOS = mo + mat

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2 font-mono font-bold text-slate-600">
                        {c.imovel?.codigo_imovel || "N/A"}
                      </td>
                      <td className="py-2 px-2 text-slate-700">
                        {c.titulo}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        R$ {mo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500">
                        R$ {mat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-right font-bold font-mono">
                        R$ {totalOS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé e Assinatura */}
        <div className="pt-10 space-y-12">
          {/* Cidade, Data */}
          <div className="text-right text-sm">
            Localidade, {dataExtenso}.
          </div>

          {/* Linha de Assinatura */}
          <div className="flex flex-col items-center justify-center space-y-2 pt-6">
            <div className="w-[350px] border-b border-slate-600"></div>
            <div className="text-sm font-bold text-slate-900">{data.tecnico.nome}</div>
            {data.tecnico.documento_identificacao && (
              <div className="text-xs text-slate-500 font-mono">
                CPF: {formatarCpfCnpj(data.tecnico.documento_identificacao)}
              </div>
            )}
            <div className="text-[10px] text-slate-400 italic">Prestador de Serviço Autônomo / Técnico de Campo</div>
          </div>
        </div>
      </div>

      {/* Estilo CSS customizado de impressão */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Oculta margens padrão do navegador */
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  )
}
