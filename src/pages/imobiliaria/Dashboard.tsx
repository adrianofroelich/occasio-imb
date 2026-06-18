import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Wrench, ShieldAlert, Clock, CheckSquare, RefreshCw, Filter, 
  AlertCircle, FileText, User, HelpCircle, Loader2 
} from "lucide-react"

// Interfaces de tipos mapeados
type StatusChamado = 
  | 'aberto' | 'em_triagem' | 'aguardando_orcamento' | 'orcamento_recebido' 
  | 'analise_proprietario' | 'aguardando_autorizacao' | 'os_liberada' 
  | 'em_execucao' | 'servico_concluido' | 'encerrado' | 'reprovado'

type Responsabilidade = 'proprietario' | 'inquilino' | 'indefinido'

interface Chamado {
  id: string
  titulo: string
  descricao_problema: string
  categoria: string
  disponibilidade_atendimento: string
  status: StatusChamado
  responsabilidade: Responsabilidade
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
}

// Configurações visuais dos badges de status
const STATUS_CONFIG: Record<StatusChamado, { label: string; cor: string; bg: string }> = {
  aberto: { label: "Aberto", cor: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  em_triagem: { label: "Em Triagem", cor: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  aguardando_orcamento: { label: "Aguardando Orçamento", cor: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  orcamento_recebido: { label: "Orçamento Recebido", cor: "text-pink-700", bg: "bg-pink-50 border-pink-200" },
  analise_proprietario: { label: "Análise do Proprietário", cor: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  aguardando_autorizacao: { label: "Aguardando Autorização", cor: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  os_liberada: { label: "O.S. Liberada", cor: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
  em_execucao: { label: "Em Execução", cor: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  servico_concluido: { label: "Serviço Concluído", cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  encerrado: { label: "Encerrado", cor: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
  reprovado: { label: "Reprovado", cor: "text-red-700", bg: "bg-red-50 border-red-200" }
}

// Configurações de cores de responsabilidade financeira
const RESP_CONFIG: Record<Responsabilidade, { label: string; cor: string }> = {
  proprietario: { label: "Proprietário", cor: "bg-indigo-500 text-white" },
  inquilino: { label: "Inquilino", cor: "bg-green-500 text-white" },
  indefinido: { label: "Indefinido", cor: "bg-slate-300 text-slate-700" }
}

export default function Dashboard() {
  const { user, perfil } = useAuth()
  
  // Estados para dados de chamados
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  
  // Estados de filtros
  const [filtroStatus, setFiltroStatus] = useState<string>("todos")
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos")
  
  // Estados para chamado em edição de ação rápida
  const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null)
  const [novoStatus, setNovoStatus] = useState<StatusChamado | "">("")
  const [novaResponsabilidade, setNovaResponsabilidade] = useState<Responsabilidade | "">("")
  const [observacaoHistorico, setObservacaoHistorico] = useState("")
  const [salvandoAcao, setSalvandoAcao] = useState(false)

  // Função para buscar os chamados no banco de dados
  const loadChamados = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    
    try {
      let query = supabase
        .from("chamados")
        .select(`
          *,
          imovel:imovel_id (codigo_imovel, endereco, limite_alcada_r$),
          inquilino:inquilino_id (nome)
        `)
        .order("criado_em", { ascending: false })

      // Se o perfil for imobiliaria, filtra apenas chamados dos imóveis sob sua gestão
      if (perfil?.perfil === "imobiliaria") {
        const { data: imoveisIds } = await supabase
          .from("imoveis")
          .select("id")
          .eq("imobiliaria_id", user?.id)

        const ids = imoveisIds?.map(item => item.id) || []
        if (ids.length > 0) {
          query = query.in("imovel_id", ids)
        } else {
          setChamados([])
          setLoading(false)
          setRealtimeLoading(false)
          return
        }
      }

      const { data, error } = await query
      if (error) throw error
      setChamados((data as unknown) as Chamado[] || [])
    } catch (err: any) {
      console.error(err)
      setErro("Não foi possível carregar a lista de chamados. Verifique se possui permissões adequadas.")
    } finally {
      setLoading(false)
      setRealtimeLoading(false)
    }
  }

  // Configura a assinatura Realtime com o Supabase
  useEffect(() => {
    if (user && perfil) {
      loadChamados()

      // Assina alterações em tempo real na tabela chamados
      const channel = supabase
        .channel("realtime-chamados-imobiliaria")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chamados"
          },
          async (_payload) => {
            // Recarrega de forma silenciosa para trazer os JOINS das relações atualizados do banco
            await loadChamados(true)
          }
        )
        .subscribe()

      // Desinscreve ao desmontar o componente
      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, perfil])

  // Processa as atualizações de status ou responsabilidade de um chamado
  const handleAplicarAcao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    try {
      const updates: any = {}
      if (novoStatus) updates.status = novoStatus
      if (novaResponsabilidade) updates.responsabilidade = novaResponsabilidade

      // 1. Atualiza o chamado
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update(updates)
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 2. Insere registro no histórico para auditoria
      if (novoStatus && novoStatus !== chamadoAtivo.status) {
        const { error: historicoError } = await supabase
          .from("historico_chamados")
          .insert({
            chamado_id: chamadoAtivo.id,
            usuario_id: user?.id,
            status_anterior: chamadoAtivo.status,
            novo_status: novoStatus,
            observacao: observacaoHistorico || `Status alterado por ${perfil?.nome}.`
          })

        if (historicoError) throw historicoError
      }

      setChamadoAtivo(null)
      setNovoStatus("")
      setNovaResponsabilidade("")
      setObservacaoHistorico("")
      
      // Recarrega
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao atualizar chamado.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Filtragem local baseada nos estados
  const chamadosFiltrados = chamados.filter((item) => {
    const atendeStatus = filtroStatus === "todos" || item.status === filtroStatus
    const atendeCategoria = filtroCategoria === "todos" || item.categoria === filtroCategoria
    return atendeStatus && atendeCategoria
  })

  // Obtém categorias únicas para o filtro dropdown
  const categoriasUnicas = Array.from(new Set(chamados.map(item => item.categoria)))

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-occasio-navy flex items-center gap-2">
            <Wrench className="h-7 w-7 text-occasio-blue" /> Chamados e O.S. Realtime
          </h1>
          <p className="text-slate-500 text-sm md:text-base">
            Visualize chamados abertos por inquilinos em tempo real. Efetue triagens, aprove propostas e dispare ordens de serviço.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {realtimeLoading && (
            <span className="text-xs text-occasio-blue flex items-center gap-1.5 font-semibold bg-occasio-blue/10 px-2.5 py-1 rounded-full animate-pulse border border-occasio-blue/20">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Atualizando...
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => loadChamados()} className="text-xs flex gap-1 bg-white border-slate-200">
            <RefreshCw className="h-3.5 w-3.5" /> Forçar Recarga
          </Button>
        </div>
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {/* Painel de Filtros e Resumos Rápidos */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Abertos / Triagem</p>
              <h3 className="text-2xl font-bold text-occasio-navy">
                {chamados.filter(c => c.status === 'aberto' || c.status === 'em_triagem').length}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cotações / Propostas</p>
              <h3 className="text-2xl font-bold text-occasio-navy">
                {chamados.filter(c => c.status === 'aguardando_orcamento' || c.status === 'orcamento_recebido').length}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Em Execução</p>
              <h3 className="text-2xl font-bold text-occasio-navy">
                {chamados.filter(c => c.status === 'em_execucao' || c.status === 'os_liberada').length}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concluídos</p>
              <h3 className="text-2xl font-bold text-occasio-navy">
                {chamados.filter(c => c.status === 'servico_concluido' || c.status === 'encerrado').length}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros da Lista */}
      <Card className="mb-6 border-slate-200 shadow-sm bg-slate-50/50">
        <CardContent className="py-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Filtros Rápidos:</span>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center flex-grow justify-end">
            <div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
              >
                <option value="todos">Todos os Status</option>
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
              >
                <option value="todos">Todas as Categorias</option>
                {categoriasUnicas.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Lista de chamados e Área de Ações Rápidas */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Coluna 1 e 2: Listagem de Chamados */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
              <span>Buscando chamados ativos...</span>
            </div>
          ) : chamadosFiltrados.length === 0 ? (
            <div className="text-center py-20 text-slate-400 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
              <HelpCircle className="h-12 w-12 text-slate-300" />
              <div className="font-semibold text-slate-500 text-lg">Nenhum chamado encontrado</div>
              <p className="max-w-xs mx-auto text-xs text-slate-400">
                Não há chamados que correspondam aos filtros selecionados.
              </p>
            </div>
          ) : (
            chamadosFiltrados.map((chamado) => {
              const statusInfo = STATUS_CONFIG[chamado.status] || { label: chamado.status, cor: "text-slate-700", bg: "bg-slate-50 border-slate-200" }
              
              return (
                <Card 
                  key={chamado.id} 
                  className={`border transition-all duration-300 hover:shadow-md cursor-pointer ${chamadoAtivo?.id === chamado.id ? "ring-2 ring-occasio-blue border-occasio-blue" : "border-slate-200"}`}
                  onClick={() => {
                    setChamadoAtivo(chamado)
                    setNovoStatus(chamado.status)
                    setNovaResponsabilidade(chamado.responsabilidade)
                  }}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                      <div>
                        <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono">
                          Imóvel: {chamado.imovel.codigo_imovel}
                        </span>
                        <h3 className="text-base font-extrabold text-occasio-navy mt-1.5">{chamado.titulo}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge className={`${statusInfo.bg} ${statusInfo.cor} border text-xs font-semibold px-2.5 py-0.5 rounded-full hover:bg-transparent`}>
                          {statusInfo.label}
                        </Badge>
                        <Badge className={`${RESP_CONFIG[chamado.responsabilidade]?.cor || "bg-slate-300"} text-[10px] font-semibold px-2 py-0.5 rounded`}>
                          Finc: {RESP_CONFIG[chamado.responsabilidade]?.label}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed mb-4">
                      {chamado.descricao_problema}
                    </p>

                    <div className="flex flex-wrap justify-between items-center border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-300" />
                        <span>Inquilino: <strong className="text-slate-600 font-semibold">{chamado.inquilino.nome}</strong></span>
                      </div>
                      <div>
                        Criado em: <strong>{new Date(chamado.criado_em).toLocaleDateString('pt-BR')}</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Coluna 3: Caixa de Ação Rápida */}
        <div className="lg:col-span-1">
          {chamadoAtivo ? (
            <Card className="border-slate-200 shadow-md sticky top-24 bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-5">
                <CardTitle className="text-base text-occasio-navy flex items-center justify-between">
                  <span>Ações de Triagem</span>
                  <button onClick={() => setChamadoAtivo(null)} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">
                    Fechar
                  </button>
                </CardTitle>
                <CardDescription className="text-xs">
                  Atualize o status ou a responsabilidade do chamado selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleAplicarAcao} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Chamado Selecionado
                    </label>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200/50">
                      <div className="text-xs font-bold text-occasio-navy font-mono">ID: {chamadoAtivo.id.slice(0,8)}...</div>
                      <div className="text-sm font-extrabold text-slate-800 line-clamp-1 mt-0.5">{chamadoAtivo.titulo}</div>
                      <div className="text-xs text-slate-400 mt-1 flex justify-between">
                        <span>Alçada Imóvel:</span>
                        <strong className="text-slate-600">
                          {chamadoAtivo.imovel.limite_alcada_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Novo Status *
                    </label>
                    <select
                      value={novoStatus}
                      onChange={(e) => setNovoStatus(e.target.value as StatusChamado)}
                      required
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Responsabilidade Financeira *
                    </label>
                    <select
                      value={novaResponsabilidade}
                      onChange={(e) => setNovaResponsabilidade(e.target.value as Responsabilidade)}
                      required
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                    >
                      <option value="indefinido">Indefinido (Em Análise)</option>
                      <option value="proprietario">Proprietário (Depreciação Estrutural)</option>
                      <option value="inquilino">Inquilino (Uso Inadequado/Mau Uso)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Observação de Histórico (Auditoria)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Chamado verificado. Enviando ao prestador para cotar serviço hidráulico."
                      value={observacaoHistorico}
                      onChange={(e) => setObservacaoHistorico(e.target.value)}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue resize-none"
                    />
                  </div>

                  <Button 
                    disabled={salvandoAcao} 
                    type="submit" 
                    className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-semibold h-9"
                  >
                    {salvandoAcao ? "Salvando..." : "Salvar e Atualizar Chamado"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 border-dashed bg-slate-50/50 shadow-none py-12 px-6 text-center text-slate-400 sticky top-24">
              <div className="flex flex-col items-center justify-center gap-3">
                <ShieldAlert className="h-10 w-10 text-slate-300" />
                <div className="text-sm font-semibold text-slate-500">Selecione um Chamado</div>
                <p className="max-w-xs mx-auto text-xs text-slate-400">
                  Clique em qualquer chamado da lista à esquerda para abrir a caixa de ações rápidas, triar responsabilidades e mover status.
                </p>
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  )
}
