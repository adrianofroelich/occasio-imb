import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { 
  Printer, ArrowLeft, Loader2, AlertCircle, Wrench, 
  User, Calendar, FileText, Hammer, Clock
} from "lucide-react"

// Interface dos detalhes consumidos via RPC get_chamado_public_details
interface PublicChamadoDetails {
  id: string
  titulo: string
  descricao_problema: string
  categoria: string
  disponibilidade_atendimento: string
  status: string
  responsabilidade: string
  criado_em: string
  imovel: {
    codigo_imovel: string
    endereco: string
    bairro: string
    cidade: string
    estado: string
    cep: string
    limite_alcada_r$: number
    proprietario: {
      nome: string
      telefone: string | null
      aceita_painel_digital?: boolean
    } | null
  }
  inquilino: {
    nome: string
    telefone: string | null
  }
  orcamentos: {
    id: string
    valor_servico_r$: number
    valor_materiais_r$: number
    valor_total_r$: number
    prazo_execucao_dias: number
    observacoes_tecnicas: string
    relatorio_conclusao: string
    homologado_pela_empresa: boolean
    prestador: {
      nome: string
    }
  }[]
  historico: {
    id: string
    status_anterior: string | null
    status_novo: string
    observacao: string | null
    criado_em: string
    criado_por_nome: string | null
  }[]
}

const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_triagem: "Em Triagem",
  aguardando_orcamento: "Aguardando Orçamento",
  orcamento_recebido: "Orçamento Recebido",
  analise_proprietario: "Análise do Proprietário",
  aguardando_autorizacao: "Aguardando Autorização",
  os_liberada: "O.S. Liberada",
  em_execucao: "Em Execução",
  servico_concluido: "Serviço Concluído",
  encerrado: "Encerrado",
  reprovado: "Reprovado"
}

export default function ChamadoPrint() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [chamado, setChamado] = useState<PublicChamadoDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDetalhes() {
      if (!id) return
      try {
        setLoading(true)
        const { data, error: rpcError } = await supabase.rpc("get_chamado_public_details", { p_chamado_id: id })
        if (rpcError) throw rpcError
        if (!data) {
          setError("Chamado não encontrado.")
        } else {
          setChamado(data as PublicChamadoDetails)
        }
      } catch (err: any) {
        console.error("Erro ao carregar detalhes do chamado:", err)
        setError("Não foi possível carregar os detalhes do chamado.")
      } finally {
        setLoading(false)
      }
    }

    carregarDetalhes()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-occasio-blue mb-2" />
        <p className="text-sm font-medium">Carregando detalhes do chamado...</p>
      </div>
    )
  }

  if (error || !chamado) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white p-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-slate-800">Erro ao carregar chamado</h1>
        <p className="text-slate-500 mt-2 max-w-md">{error || "Chamado inválido ou inexistente."}</p>
        <Button onClick={() => navigate(-1)} className="mt-6 bg-occasio-blue hover:bg-occasio-navy text-white">
          Voltar
        </Button>
      </div>
    )
  }

  const formatarData = (dataStr: string) => {
    return new Date(dataStr).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const orcamentoHomologado = chamado.orcamentos?.find(o => o.homologado_pela_empresa) || chamado.orcamentos?.[0]

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 bg-white min-h-screen text-slate-800">
      {/* Estilos específicos para impressão */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
            font-size: 12px !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Barra de Ferramentas / no-print */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100 no-print">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-800 flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button 
            onClick={() => window.print()}
            className="bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold gap-1.5 px-4 h-9 shadow-md shadow-occasio-blue/15"
          >
            <Printer className="h-4 w-4" /> Imprimir ou Salvar PDF
          </Button>
        </div>
      </div>

      {/* Cabeçalho do Documento */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Occasio Imob" className="h-10 object-contain" />
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ordem de Serviço / Chamado</div>
          <div className="text-sm font-mono font-bold text-slate-700 mt-0.5">ID: {chamado.id}</div>
          <div className="text-xs text-slate-500 mt-1">Gerado em: {formatarData(new Date().toISOString())}</div>
        </div>
      </div>

      {/* Título Principal e Status */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print-card">
        <div>
          <span className="text-[10px] bg-occasio-blue/10 text-occasio-blue font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {chamado.categoria}
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 mt-1.5">{chamado.titulo}</h1>
          <p className="text-xs text-slate-500 mt-1">Aberto em: {formatarData(chamado.criado_em)}</p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status Atual</span>
          <span className="inline-block bg-slate-200 text-slate-800 font-bold px-3 py-1 rounded-lg text-xs md:text-sm shadow-sm border border-slate-300/50">
            {STATUS_LABELS[chamado.status] || chamado.status}
          </span>
        </div>
      </div>

      {/* Grid de Informações: Imóvel e Envolvidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Detalhes do Imóvel */}
        <div className="border border-slate-200 rounded-xl p-5 print-card">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
            <Wrench className="h-4 w-4 text-occasio-blue" />
            Dados do Imóvel
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Código do Imóvel:</span>
              <strong className="text-slate-800 font-semibold">{chamado.imovel.codigo_imovel}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Endereço:</span>
              <span className="text-slate-800 font-medium text-right max-w-[200px] truncate">{chamado.imovel.endereco}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bairro/Cidade:</span>
              <span className="text-slate-800 font-medium">{chamado.imovel.bairro}, {chamado.imovel.cidade} - {chamado.imovel.estado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CEP:</span>
              <span className="text-slate-800 font-mono">{chamado.imovel.cep}</span>
            </div>
          </div>
        </div>

        {/* Detalhes das Partes */}
        <div className="border border-slate-200 rounded-xl p-5 print-card">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
            <User className="h-4 w-4 text-occasio-blue" />
            Contatos Envolvidos
          </h3>
          <div className="space-y-3 text-xs">
            {chamado.imovel.proprietario && (
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Proprietário</span>
                <div className="flex justify-between items-center mt-0.5">
                  <strong className="text-slate-800">{chamado.imovel.proprietario.nome}</strong>
                  {chamado.imovel.proprietario.telefone && (
                    <span className="text-slate-600 font-mono">{chamado.imovel.proprietario.telefone}</span>
                  )}
                </div>
              </div>
            )}
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">Inquilino</span>
              <div className="flex justify-between items-center mt-0.5">
                <strong className="text-slate-800">{chamado.inquilino.nome}</strong>
                {chamado.inquilino.telefone && (
                  <span className="text-slate-600 font-mono">{chamado.inquilino.telefone}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Descrição do Problema */}
      <div className="border border-slate-200 rounded-xl p-5 mb-8 print-card">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
          <FileText className="h-4 w-4 text-occasio-blue" />
          Descrição da Manutenção Solicitada
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/50 p-3.5 border border-slate-100 rounded-lg whitespace-pre-wrap">
          {chamado.descricao_problema}
        </p>
        <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Disponibilidade para Atendimento: <strong>{chamado.disponibilidade_atendimento}</strong></span>
        </div>
      </div>

      {/* Detalhes do Orçamento (se houver) */}
      {orcamentoHomologado ? (
        <div className="border border-slate-200 rounded-xl p-5 mb-8 print-card">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
            <Hammer className="h-4 w-4 text-occasio-blue" />
            Orçamento de Serviço
          </h3>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-4 mb-4">
            <div className="flex justify-between text-xs border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Prestador Responsável:</span>
              <strong className="text-slate-800">{orcamentoHomologado.prestador?.nome || "Técnico Parceiro"}</strong>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white border border-slate-200/65 p-2 rounded">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Mão de Obra</span>
                <strong className="text-slate-800 text-xs">
                  {Number(orcamentoHomologado.valor_servico_r$).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </div>
              <div className="bg-white border border-slate-200/65 p-2 rounded">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Materiais</span>
                <strong className="text-slate-800 text-xs">
                  {Number(orcamentoHomologado.valor_materiais_r$).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </div>
              <div className="bg-white border border-slate-200/65 p-2 rounded">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Prazo</span>
                <strong className="text-slate-800 text-xs">
                  {orcamentoHomologado.prazo_execucao_dias} dias
                </strong>
              </div>
            </div>

            <div className="flex justify-between items-center bg-occasio-blue/5 border border-occasio-blue/15 p-3 rounded-lg mt-2">
              <span className="text-xs font-bold text-slate-700">Valor Total do Orçamento:</span>
              <strong className="text-occasio-blue text-base font-black">
                {Number(orcamentoHomologado.valor_total_r$).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </div>
          </div>

          {orcamentoHomologado.observacoes_tecnicas && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100 italic">
              <strong>Observações Técnicas:</strong> &ldquo;{orcamentoHomologado.observacoes_tecnicas}&rdquo;
            </div>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 border-dashed rounded-xl p-6 text-center text-slate-400 mb-8 print-card">
          <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold">Aguardando cotação técnica</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Nenhum orçamento foi recebido para este chamado até o momento.</p>
        </div>
      )}

      {/* Histórico / Linha do Tempo de Auditoria */}
      {chamado.historico && chamado.historico.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 print-card">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-4">
            <Clock className="h-4 w-4 text-occasio-blue" />
            Histórico de Atualizações
          </h3>
          <div className="relative pl-6 border-l border-slate-200 space-y-5">
            {chamado.historico.map((log) => (
              <div key={log.id} className="relative">
                <span className="absolute -left-[27px] top-1 bg-white border border-slate-300 rounded-full h-3.5 w-3.5 flex items-center justify-center">
                  <span className="bg-occasio-blue rounded-full h-1.5 w-1.5" />
                </span>
                <div className="text-xs flex justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    Status: {STATUS_LABELS[log.status_novo] || log.status_novo}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
                    {formatarData(log.criado_em)}
                  </span>
                </div>
                {log.observacao && (
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{log.observacao}</p>
                )}
                {log.criado_por_nome && (
                  <div className="text-[10px] text-slate-400 mt-0.5 italic">
                    Realizado por: {log.criado_por_nome}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rodapé de Validação */}
      <div className="mt-12 pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400">
        <p>Documento de controle interno sob a plataforma Occasio.Imob.</p>
        <p className="mt-1">© {new Date().getFullYear()} Occasio.Imob. Todos os direitos reservados.</p>
      </div>
    </div>
  )
}
