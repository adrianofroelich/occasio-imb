import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import VisualizadorImagem from "@/components/VisualizadorImagem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Building, CheckCircle2, XCircle, MessageSquare, Loader2, 
  RefreshCw, Calendar, Camera, Hammer, AlertCircle, HelpCircle
} from "lucide-react"

// Interfaces de tipos mapeados
type StatusChamado = 
  | 'aberto' | 'em_triagem' | 'aguardando_orcamento' | 'orcamento_recebido' 
  | 'analise_proprietario' | 'aguardando_autorizacao' | 'os_liberada' 
  | 'em_execucao' | 'servico_concluido' | 'encerrado' | 'reprovado'

interface Chamado {
  id: string
  titulo: string
  descricao_problema: string
  categoria: string
  status: StatusChamado
  criado_em: string
  imovel_id: string
  inquilino_id: string
  imovel: {
    codigo_imovel: string
    endereco: string
    limite_alcada_r$: number
  }
  inquilino: {
    nome: string
  }
  orcamentos: {
    id: string
    valor_servico_r$: number
    valor_materiais_r$: number
    valor_total_r$: number
    prazo_execucao_dias: number
    observacoes_tecnicas: string
    aprovado_pelo_proprietario: boolean
    prestador: {
      nome: string
    }
  }[]
}

const STATUS_CONFIG: Record<StatusChamado, { label: string; cor: string; bg: string }> = {
  aberto: { label: "Aberto", cor: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  em_triagem: { label: "Em Triagem", cor: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  aguardando_orcamento: { label: "Aguardando Orçamento", cor: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  orcamento_recebido: { label: "Orçamento Recebido", cor: "text-pink-700", bg: "bg-pink-50 border-pink-200" },
  analise_proprietario: { label: "Aguardando seu Aval", cor: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  aguardando_autorizacao: { label: "Aprovado por você", cor: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  os_liberada: { label: "O.S. Liberada", cor: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
  em_execucao: { label: "Em Execução", cor: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  servico_concluido: { label: "Serviço Concluído", cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  encerrado: { label: "Encerrado", cor: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
  reprovado: { label: "Reprovado", cor: "text-red-700", bg: "bg-red-50 border-red-200" }
}

export default function ProprietarioDashboard() {
  const { user, perfil } = useAuth()
  
  // Abas do dashboard: aval (aguardando aprovação) ou historico (concluídos/arquivados)
  const [activeTab, setActiveTab] = useState<"aval" | "historico">("aval")
  
  // Listas de chamados
  const [chamadosAval, setChamadosAval] = useState<Chamado[]>([])
  const [chamadosHistorico, setChamadosHistorico] = useState<Chamado[]>([])
  
  // Loading, alertas e estado de salvar
  const [loading, setLoading] = useState(true)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  
  // Chamado sob análise detalhada no painel lateral
  const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null)
  const [midias, setMidias] = useState<{ id: string; url_storage: string; tipo_midia: string }[]>([])
  const [urlImagemZoom, setUrlImagemZoom] = useState<string | null>(null)
  
  // Modal de esclarecimentos
  const [mostrarModalEsclarecimento, setMostrarModalEsclarecimento] = useState(false)
  const [textoEsclarecimento, setTextoEsclarecimento] = useState("")

  // Carrega os dados vinculados ao Proprietário logado
  const loadProprietarioData = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    setErro(null)

    try {
      // 1. Primeiro descobre os imóveis deste proprietário
      const { data: meusImoveis, error: imoveisError } = await supabase
        .from("imoveis")
        .select("id")
        .eq("proprietario_id", user?.id)

      if (imoveisError) throw imoveisError

      const imoveisIds = meusImoveis?.map(item => item.id) || []

      if (imoveisIds.length === 0) {
        setChamadosAval([])
        setChamadosHistorico([])
        setLoading(false)
        setRealtimeLoading(false)
        return
      }

      // 2. Busca chamados aguardando análise do proprietário
      const { data: avalData, error: avalError } = await supabase
        .from("chamados")
        .select(`
          *,
          imovel:imovel_id (codigo_imovel, endereco, limite_alcada_r$),
          inquilino:inquilino_id (nome),
          orcamentos (
            id,
            valor_servico_r$,
            valor_materiais_r$,
            valor_total_r$,
            prazo_execucao_dias,
            observacoes_tecnicas,
            aprovado_pelo_proprietario,
            prestador:prestador_id (nome)
          )
        `)
        .in("imovel_id", imoveisIds)
        .eq("status", "analise_proprietario")
        .order("criado_em", { ascending: false })

      if (avalError) throw avalError
      setChamadosAval((avalData as unknown) as Chamado[] || [])

      // 3. Busca histórico de chamados (resolvidos ou reprovados)
      const { data: historicoData, error: historicoError } = await supabase
        .from("chamados")
        .select(`
          *,
          imovel:imovel_id (codigo_imovel, endereco, limite_alcada_r$),
          inquilino:inquilino_id (nome),
          orcamentos (
            id,
            valor_servico_r$,
            valor_materiais_r$,
            valor_total_r$,
            prazo_execucao_dias,
            observacoes_tecnicas,
            aprovado_pelo_proprietario,
            prestador:prestador_id (nome)
          )
        `)
        .in("imovel_id", imoveisIds)
        .in("status", ["servico_concluido", "encerrado", "reprovado"])
        .order("criado_em", { ascending: false })

      if (historicoError) throw historicoError
      setChamadosHistorico((historicoData as unknown) as Chamado[] || [])

    } catch (err: any) {
      console.error(err)
      setErro("Falha ao carregar as informações patrimoniais.")
    } finally {
      setLoading(false)
      setRealtimeLoading(false)
    }
  }

  // Monitora mídias do chamado selecionado
  useEffect(() => {
    if (chamadoAtivo) {
      supabase
        .from("chamados_midias")
        .select("*")
        .eq("chamado_id", chamadoAtivo.id)
        .then(({ data, error }) => {
          if (error) {
            console.error("Erro ao buscar mídias do chamado:", error)
          } else {
            setMidias(data || [])
          }
        })
    } else {
      setMidias([])
    }
  }, [chamadoAtivo])

  // Setup do Realtime
  useEffect(() => {
    if (user && perfil) {
      loadProprietarioData()

      const channel = supabase
        .channel("realtime-chamados-proprietario")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chamados"
          },
          async (_payload) => {
            await loadProprietarioData(true)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, perfil])

  // Lógica de aprovação de orçamento
  const handleAprovar = async () => {
    if (!chamadoAtivo) return
    const orcamento = chamadoAtivo.orcamentos?.[0]
    if (!orcamento) {
      setErro("Nenhum orçamento encontrado para este chamado.")
      return
    }

    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      // 1. Atualiza o orçamento como aprovado pelo proprietário
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({ aprovado_pelo_proprietario: true })
        .eq("id", orcamento.id)

      if (orcamentoError) throw orcamentoError

      // 2. Atualiza o status do chamado para 'aguardando_autorizacao'
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "aguardando_autorizacao" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 3. Insere no histórico de auditoria
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "aguardando_autorizacao",
          observacao: `Orçamento de R$ ${(orcamento.valor_total_r$ || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} aprovado pelo Proprietário.`
        })

      if (historicoError) throw historicoError

      setSucesso("Orçamento aprovado com sucesso! A imobiliária foi notificada para autorizar o início.")
      setChamadoAtivo(null)
      await loadProprietarioData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao aprovar orçamento.")
    } finally {
      setSalvando(false)
    }
  }

  // Lógica de reprovação de orçamento
  const handleReprovar = async () => {
    if (!chamadoAtivo) return
    const orcamento = chamadoAtivo.orcamentos?.[0]
    if (!orcamento) {
      setErro("Nenhum orçamento encontrado para este chamado.")
      return
    }

    if (!confirm("Deseja mesmo reprovar este orçamento definitivamente?")) return

    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      // 1. Atualiza o status do chamado para 'reprovado'
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "reprovado" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 2. Insere no histórico de auditoria
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "reprovado",
          observacao: `Orçamento reprovado pelo Proprietário.`
        })

      if (historicoError) throw historicoError

      setSucesso("Orçamento reprovado. O chamado foi movido para o histórico como reprovado.")
      setChamadoAtivo(null)
      await loadProprietarioData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao reprovar orçamento.")
    } finally {
      setSalvando(false)
    }
  }

  // Lógica de solicitação de esclarecimentos
  const handleSolicitarEsclarecimento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoAtivo || !textoEsclarecimento.trim()) return

    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      // 1. Retorna o chamado para 'em_triagem'
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "em_triagem" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 2. Registra o pedido de esclarecimento no histórico
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "em_triagem",
          observacao: `Proprietário solicitou esclarecimentos: "${textoEsclarecimento}"`
        })

      if (historicoError) throw historicoError

      setSucesso("Dúvida registrada e encaminhada de volta para a imobiliária.")
      setChamadoAtivo(null)
      setTextoEsclarecimento("")
      setMostrarModalEsclarecimento(false)
      await loadProprietarioData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao enviar pedido de esclarecimento.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl min-h-screen pb-20">
      
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-occasio-navy flex items-center gap-2">
            <Building className="h-6 w-6 text-occasio-blue" /> Painel do Proprietário
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestão financeira e aprovações de orçamentos.</p>
        </div>
        {realtimeLoading && (
          <span className="text-xs text-occasio-blue flex items-center gap-1 font-semibold animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" /> Atualizando
          </span>
        )}
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="font-bold">Erro</AlertTitle>
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="font-semibold">Sucesso!</AlertTitle>
          <AlertDescription className="font-semibold">{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Abas PWA */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1.5 rounded-lg mb-6">
        <button
          onClick={() => { setActiveTab("aval"); setChamadoAtivo(null) }}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "aval" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Aguardando seu Aval ({chamadosAval.length})
        </button>
        <button
          onClick={() => { setActiveTab("historico"); setChamadoAtivo(null) }}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "historico" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Histórico de Manutenções ({chamadosHistorico.length})
        </button>
      </div>

      {/* Layout Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Lista de Chamados */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2 bg-white rounded-lg border border-slate-200">
              <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
              <span className="text-xs font-semibold">Carregando chamados...</span>
            </div>
          ) : activeTab === "aval" ? (
            chamadosAval.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 border-dashed flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-slate-300" />
                <div className="text-sm font-bold text-slate-500">Tudo em dia!</div>
                <p className="max-w-xs text-xs text-slate-400">
                  Nenhum chamado de manutenção de seus imóveis está aguardando aprovação no momento.
                </p>
              </div>
            ) : (
              chamadosAval.map(chamado => {
                const orcamento = chamado.orcamentos?.[0]
                const total = orcamento ? (orcamento.valor_total_r$ || (orcamento.valor_servico_r$ + orcamento.valor_materiais_r$)) : 0
                return (
                  <Card 
                    key={chamado.id} 
                    className={`border hover:shadow-md cursor-pointer transition-all ${chamadoAtivo?.id === chamado.id ? "ring-2 ring-occasio-blue border-occasio-blue" : "border-slate-200"}`}
                    onClick={() => setChamadoAtivo(chamado)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono uppercase">
                            Cód: {chamado.imovel.codigo_imovel}
                          </span>
                          <h3 className="text-sm font-bold text-slate-800 mt-1">{chamado.titulo}</h3>
                        </div>
                        <Badge className="bg-amber-50 border-amber-200 text-amber-700 border text-[10px] font-semibold px-2 py-0.5 rounded-full hover:bg-transparent">
                          Excede Alçada
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                        {chamado.descricao_problema}
                      </p>

                      {orcamento && (
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-200/50 flex justify-between items-center text-xs">
                          <div>
                            <span className="text-slate-400 block text-[9px] font-semibold uppercase">Prestador</span>
                            <span className="font-bold text-slate-700">{orcamento.prestador?.nome || "Técnico Parceiro"}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[9px] font-semibold uppercase">Orçamento Total</span>
                            <span className="font-extrabold text-occasio-blue text-sm">
                              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )
          ) : (
            chamadosHistorico.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 border-dashed flex flex-col items-center justify-center gap-3">
                <HelpCircle className="h-10 w-10 text-slate-300" />
                <div className="text-sm font-bold text-slate-500">Sem histórico</div>
                <p className="max-w-xs text-xs text-slate-400">
                  Nenhuma manutenção foi registrada ou concluída ainda para suas propriedades.
                </p>
              </div>
            ) : (
              chamadosHistorico.map(chamado => {
                const orcamento = chamado.orcamentos?.[0]
                const total = orcamento ? (orcamento.valor_total_r$ || (orcamento.valor_servico_r$ + orcamento.valor_materiais_r$)) : 0
                const statusInfo = STATUS_CONFIG[chamado.status] || { label: chamado.status, cor: "text-slate-700", bg: "bg-slate-50" }
                return (
                  <Card 
                    key={chamado.id} 
                    className="border border-slate-200 hover:shadow-sm"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono uppercase">
                            Cód: {chamado.imovel.codigo_imovel}
                          </span>
                          <h3 className="text-sm font-bold text-slate-800 mt-1">{chamado.titulo}</h3>
                        </div>
                        <Badge className={`${statusInfo.bg} ${statusInfo.cor} border text-[10px] font-semibold px-2 py-0.5 rounded-full hover:bg-transparent`}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-2.5 mt-2.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-300" />
                          <span>Finalizado em: <strong>{new Date(chamado.criado_em).toLocaleDateString('pt-BR')}</strong></span>
                        </div>
                        {orcamento && (
                          <div>
                            Custo Total: <strong className="text-occasio-navy">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )
          )}
        </div>

        {/* Detalhes e Ações de Decisão */}
        <div className="lg:col-span-1">
          {chamadoAtivo ? (
            <Card className="border-slate-200 shadow-md sticky top-24 bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm text-occasio-navy font-bold">Avaliação do Orçamento</CardTitle>
                  <button 
                    onClick={() => setChamadoAtivo(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    Fechar
                  </button>
                </div>
                <CardDescription className="text-[11px]">
                  Revise os valores e fotos antes de autorizar a execução.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                
                {/* Info do Imóvel */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Imóvel</label>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200/50 text-xs">
                    <strong className="text-slate-800 font-bold block">{chamadoAtivo.imovel.codigo_imovel}</strong>
                    <span className="text-slate-500 block leading-tight mt-0.5">{chamadoAtivo.imovel.endereco}</span>
                    <span className="text-slate-400 block text-[9px] mt-1.5">
                      Limite de Alçada Imobiliária: <strong>{chamadoAtivo.imovel.limite_alcada_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </span>
                  </div>
                </div>

                {/* Detalhes do Chamado */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Descrição do Problema</label>
                  <p className="text-xs text-slate-600 bg-slate-50/50 p-2 rounded leading-relaxed border border-slate-100">
                    {chamadoAtivo.descricao_problema}
                  </p>
                </div>

                {/* Detalhes Financeiros */}
                {chamadoAtivo.orcamentos?.[0] && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center gap-1 pb-1 border-b border-slate-200">
                      <Hammer className="h-3.5 w-3.5 text-occasio-blue" />
                      <span className="font-bold text-slate-700">Valores do Prestador</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mão de Obra:</span>
                      <span className="font-semibold text-slate-700">
                        {chamadoAtivo.orcamentos[0].valor_servico_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Materiais:</span>
                      <span className="font-semibold text-slate-700">
                        {chamadoAtivo.orcamentos[0].valor_materiais_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200">
                      <span className="font-bold text-slate-800">Custo Total:</span>
                      <strong className="text-occasio-blue text-sm font-extrabold">
                        {chamadoAtivo.orcamentos[0].valor_total_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-slate-500">Prazo de Execução:</span>
                      <span className="font-bold text-slate-700">{chamadoAtivo.orcamentos[0].prazo_execucao_dias} dias</span>
                    </div>
                    {chamadoAtivo.orcamentos[0].observacoes_tecnicas && (
                      <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed italic">
                        &ldquo;{chamadoAtivo.orcamentos[0].observacoes_tecnicas}&rdquo;
                      </div>
                    )}
                  </div>
                )}

                {/* Fotos da Vistoria */}
                {midias.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Camera className="h-3 w-3 text-slate-400" /> Fotos do Dano
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {midias.map(midia => (
                        <div 
                          key={midia.id} 
                          onClick={() => setUrlImagemZoom(midia.url_storage)}
                          className="relative aspect-video rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
                        >
                          <img 
                            src={midia.url_storage} 
                            alt={`Foto ${midia.tipo_midia}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-white py-0.5 px-1 font-semibold text-center capitalize">
                            {midia.tipo_midia}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleAprovar}
                      disabled={salvando}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-9 flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      onClick={handleReprovar}
                      disabled={salvando}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9 flex items-center gap-1"
                    >
                      <XCircle className="h-4 w-4" /> Reprovar
                    </Button>
                  </div>
                  <Button
                    onClick={() => setMostrarModalEsclarecimento(true)}
                    disabled={salvando}
                    variant="outline"
                    className="w-full border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs h-9 flex items-center gap-1.5 justify-center"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Solicitar Esclarecimentos
                  </Button>
                </div>

              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 border-dashed bg-slate-50/50 shadow-none py-12 px-6 text-center text-slate-400 sticky top-24">
              <div className="flex flex-col items-center justify-center gap-2">
                <Building className="h-10 w-10 text-slate-300" />
                <div className="text-sm font-semibold text-slate-500">Selecione um Chamado</div>
                <p className="max-w-xs mx-auto text-xs text-slate-400">
                  Clique em um chamado pendente da lista para analisar valores, prazos, fotos técnicas e tomar a decisão.
                </p>
              </div>
            </Card>
          )}
        </div>

      </div>

      {/* Modal de Esclarecimentos */}
      {mostrarModalEsclarecimento && chamadoAtivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm bg-white border border-slate-200 shadow-xl">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm text-occasio-navy font-bold">Solicitar Esclarecimentos</CardTitle>
              <CardDescription className="text-[11px]">
                Descreva sua dúvida técnica ou financeira. O chamado voltará para a imobiliária analisar.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSolicitarEsclarecimento}>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Qual a sua dúvida/observação?
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Ex: O custo de materiais está muito elevado para uma torneira padrão. Favor verificar se há alternativas de marca ou se é possível reutilizar a antiga."
                    value={textoEsclarecimento}
                    onChange={(e) => setTextoEsclarecimento(e.target.value)}
                    className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-occasio-blue focus:outline-none resize-none"
                  />
                </div>
              </CardContent>
              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setMostrarModalEsclarecimento(false)}
                  className="text-xs h-8 border-slate-200"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={salvando}
                  className="bg-occasio-blue hover:bg-occasio-navy text-white text-xs h-8"
                >
                  {salvando ? "Enviando..." : "Enviar Questionamento"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Visualizador de Zoom Reativo */}
      {urlImagemZoom && (
        <VisualizadorImagem 
          src={urlImagemZoom} 
          onClose={() => setUrlImagemZoom(null)} 
        />
      )}

    </div>
  )
}
