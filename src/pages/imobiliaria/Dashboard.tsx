import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { comprimirImagemChamado } from "@/lib/compressor"
import VisualizadorImagem from "@/components/VisualizadorImagem"
import LaudoTecnico from "@/components/LaudoTecnico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Wrench, ShieldAlert, Clock, CheckSquare, RefreshCw, Filter, 
  AlertCircle, FileText, User, HelpCircle, Loader2, Hammer, CheckCircle2, Plus,
  Calendar, UserCheck, MessageSquare, Printer, X
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
  data_conclusao?: string | null
  imagens_problema?: string[] | null
  imagens_solucao?: string[] | null
  imovel_id: string
  inquilino_id: string
  empresa_prestadora_id?: string | null
  tecnico_id?: string | null
  imovel: {
    codigo_imovel: string
    endereco: string
    bairro: string
    cidade: string
    estado: string
    cep: string
    limite_alcada_r$: number
    proprietario?: {
      nome: string
      telefone?: string | null
      aceita_painel_digital?: boolean
    } | null
  }
  inquilino: {
    nome: string
    telefone?: string | null
  }
  empresa_prestadora?: {
    id: string
    nome: string
    tipo_repasse?: 'mensal' | 'quinzenal' | 'semanal' | 'por_servico' | null
    prazo_repasse_dias?: number | null
  } | null
  tecnico?: {
    nome: string
  } | null
  orcamentos?: {
    id: string
    valor_servico_r$: number
    valor_materiais_r$: number
    valor_servico_tecnico_r$?: number | null
    valor_materiais_tecnico_r$?: number | null
    responsavel_material_tecnico?: 'tecnico' | 'empresa' | null
    responsavel_material_empresa?: 'empresa' | 'imobiliaria' | 'proprietario' | null
    prazo_execucao_dias: number
    observacoes_tecnicas: string
    homologado_pela_empresa: boolean
    prestador_id: string
    relatorio_conclusao?: string
    valor_total_r$?: number
    prestador?: {
      nome: string
    } | null
  }[]
  status_financeiro?: 'pendente' | 'pago' | null
  fechamento_id?: string | null
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

// Helper: calcula data prevista de repasse
function calcularDataRepasse(
  dataConclusaoStr: string | null | undefined,
  tipoRepasse: 'mensal' | 'quinzenal' | 'semanal' | 'por_servico' | null | undefined,
  prazoRepasseDias: number | null | undefined
): Date | null {
  if (!dataConclusaoStr) return null
  const dataConclusao = new Date(dataConclusaoStr)
  if (isNaN(dataConclusao.getTime())) return null

  const tipo = tipoRepasse || 'por_servico'
  const prazo = prazoRepasseDias || 0

  let dataRepasse = new Date(dataConclusao)

  if (tipo === 'por_servico') {
    dataRepasse.setDate(dataRepasse.getDate() + prazo)
  } else if (tipo === 'semanal') {
    const diaSemana = dataConclusao.getDay()
    const diasAteDomingo = (7 - diaSemana) % 7
    dataRepasse.setDate(dataRepasse.getDate() + diasAteDomingo + prazo)
  } else if (tipo === 'quinzenal') {
    const dia = dataConclusao.getDate()
    if (dia <= 15) {
      dataRepasse = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth(), 15 + prazo)
    } else {
      const ultimoDia = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth() + 1, 0).getDate()
      dataRepasse = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth(), ultimoDia + prazo)
    }
  } else if (tipo === 'mensal') {
    const ano = dataConclusao.getFullYear()
    const mes = dataConclusao.getMonth()
    let mesSeguinte = mes + 1
    let anoSeguinte = ano
    if (mesSeguinte > 11) {
      mesSeguinte = 0
      anoSeguinte += 1
    }
    const ultimoDiaMesSeguinte = new Date(anoSeguinte, mesSeguinte + 1, 0).getDate()
    const diaRepasse = Math.min(prazo, ultimoDiaMesSeguinte)
    dataRepasse = new Date(anoSeguinte, mesSeguinte, diaRepasse)
  }

  dataRepasse.setHours(0, 0, 0, 0)
  return dataRepasse
}

// Helper: formata termo de repasse
function formatarCondicaoRepasse(
  tipoRepasse: 'mensal' | 'quinzenal' | 'semanal' | 'por_servico' | null | undefined,
  prazoRepasseDias: number | null | undefined
): string {
  if (!tipoRepasse) return "Não configurado"
  const prazo = prazoRepasseDias || 0
  switch (tipoRepasse) {
    case 'mensal':
      return `Mensal (Dia ${prazo})`
    case 'quinzenal':
      return `Quinzenal (${prazo} dias pós-quinzena)`
    case 'semanal':
      return `Semanal (${prazo} dias pós-domingo)`
    case 'por_servico':
      return `Por Serviço (${prazo} ${prazo === 1 ? 'dia' : 'dias'})`
    default:
      return "Não configurado"
  }
}

// Helper: formata data
function formatarData(data: Date | null): string {
  if (!data) return "-"
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const ano = data.getFullYear()
  return `${dia}/${mes}/${ano}`
}

export default function Dashboard() {
  const { user, perfil } = useAuth()
  
  // Estados para dados de chamados
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Estados da Aba Financeira e seus filtros
  const [activeTab, setActiveTab] = useState<"chamados" | "financeiro">("chamados")
  const [filtroFinanceiroStatus, setFiltroFinanceiroStatus] = useState<"todos" | "pendente" | "pago">("todos")
  const [filtroFinanceiroPrestador, setFiltroFinanceiroPrestador] = useState<string>("todos")
  // Estados para Fechamento Financeiro Mensal e Conciliação Definitiva
  const [extratoProprietarioAtivo, setExtratoProprietarioAtivo] = useState<Chamado | null>(null)
  const [subAbaFinanceira, setSubAbaFinanceira] = useState<"pendentes" | "historico">("pendentes")
  const [fechamentos, setFechamentos] = useState<any[]>([])
  const [carregandoFechamentos, setCarregandoFechamentos] = useState(false)
  const [fechamentoSelecionado, setFechamentoSelecionado] = useState<any | null>(null)
  const [exibirModalNovoFechamento, setExibirModalNovoFechamento] = useState(false)
  const [exibirModalDetalhesFechamento, setExibirModalDetalhesFechamento] = useState(false)
  const [mesFechamento, setMesFechamento] = useState<number>(new Date().getMonth() + 1)
  const [anoFechamento, setAnoFechamento] = useState<number>(new Date().getFullYear())
  const [salvandoFechamento, setSalvandoFechamento] = useState(false)

  // Estados para abertura de chamado pela imobiliária
  const [formChamadoAberto, setFormChamadoAberto] = useState(false)
  const [imoveisDisponiveis, setImoveisDisponiveis] = useState<any[]>([])
  const [inquilinosDisponiveis, setInquilinosDisponiveis] = useState<any[]>([])
  const [novoChamadoImovelId, setNovoChamadoImovelId] = useState("")
  const [novoChamadoInquilinoId, setNovoChamadoInquilinoId] = useState("")
  const [novoChamadoInquilinoNome, setNovoChamadoInquilinoNome] = useState("")
  const [novoChamadoInquilinoBloqueado, setNovoChamadoInquilinoBloqueado] = useState(false)
  const [novoChamadoTitulo, setNovoChamadoTitulo] = useState("")
  const [novoChamadoCategoria, setNovoChamadoCategoria] = useState("")
  const [novoChamadoDescricao, setNovoChamadoDescricao] = useState("")
  const [novoChamadoDisponibilidade, setNovoChamadoDisponibilidade] = useState("")
  const [novoChamadoImagens, setNovoChamadoImagens] = useState<File[]>([])
  const [novoChamadoImagensPreview, setNovoChamadoImagensPreview] = useState<string[]>([])
  const [salvandoNovoChamado, setSalvandoNovoChamado] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Estados de filtros
  const [filtroStatus, setFiltroStatus] = useState<string>("todos")
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos")
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("mes_atual")
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState<string>("")
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState<string>("")
  
  // Estados para chamado em edição de ação rápida
  const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null)
  const [novoStatus, setNovoStatus] = useState<StatusChamado | "">("")
  const [novaResponsabilidade, setNovaResponsabilidade] = useState<Responsabilidade | "">("")
  const [observacaoHistorico, setObservacaoHistorico] = useState("")
  const [salvandoAcao, setSalvandoAcao] = useState(false)
  const [empresasVinculadas, setEmpresasVinculadas] = useState<any[]>([])
  const [empresaPrestadoraSelecionadaId, setEmpresaPrestadoraSelecionadaId] = useState("")

  // Estados para galeria de mídias, zoom de imagem e orçamento ativo
  const [midias, setMidias] = useState<{ id: string; url_storage: string; tipo_midia: string }[]>([])
  const [urlImagemZoom, setUrlImagemZoom] = useState<string | null>(null)
  const [orcamentoAtivo, setOrcamentoAtivo] = useState<any | null>(null)
  const [mostrarLaudo, setMostrarLaudo] = useState(false)

  // Sincroniza mídias e orçamento sempre que o chamado ativo mudar
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

      supabase
        .from("orcamentos")
        .select(`
          *,
          prestador:prestador_id (nome)
        `)
        .eq("chamado_id", chamadoAtivo.id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error("Erro ao buscar orçamento do chamado:", error)
          } else {
            setOrcamentoAtivo(data || null)
          }
        })
    } else {
      setMidias([])
      setOrcamentoAtivo(null)
    }
  }, [chamadoAtivo])

  // Carrega imóveis e inquilinos para o formulário de abertura de chamado
  const carregarDadosFormularioChamado = async () => {
    try {
      // 1. Carrega todos os imóveis da imobiliária
      let queryImoveis = supabase
        .from("imoveis")
        .select("id, codigo_imovel, endereco, inquilino_id, inquilino:inquilino_id (nome)")
        .order("codigo_imovel")

      if (perfil?.perfil === "imobiliaria") {
        queryImoveis = queryImoveis.eq("imobiliaria_id", user?.id)
      }

      const { data: imoveisData, error: imoveisError } = await queryImoveis
      if (imoveisError) throw imoveisError
      setImoveisDisponiveis(imoveisData || [])

      // 2. Carrega todos os inquilinos cadastrados (para os imóveis sem inquilino fixado)
      const { data: inquilinosData, error: inquilinosError } = await supabase
        .from("perfis")
        .select("id, nome")
        .eq("perfil", "inquilino")
        .order("nome")
      if (inquilinosError) throw inquilinosError
      setInquilinosDisponiveis(inquilinosData || [])

      // 3. Carrega as Empresas Prestadoras vinculadas
      if (perfil?.perfil === "super_admin") {
        const { data: empData, error: empError } = await supabase
          .from("perfis")
          .select("id, nome")
          .eq("perfil", "prestador")
          .is("empresa_mae_id", null)
          .order("nome")
        if (empError) throw empError
        setEmpresasVinculadas(empData || [])
      } else {
        const { data: vincData, error: vincError } = await supabase
          .from("vinculos_saas")
          .select(`
            empresa:empresa_prestadora_id (id, nome)
          `)
          .eq("imobiliaria_id", user?.id)
        if (vincError) throw vincError
        const list = vincData?.map((item: any) => item.empresa).filter(Boolean) || []
        setEmpresasVinculadas(list)
      }

    } catch (err) {
      console.error("Erro ao carregar dados do formulário de chamados:", err)
    }
  }

  useEffect(() => {
    if (user && perfil && (perfil.perfil === "imobiliaria" || perfil.perfil === "super_admin")) {
      carregarDadosFormularioChamado()
    }
  }, [user, perfil])

  const handleNovoChamadoImovelChange = (imovelId: string) => {
    setNovoChamadoImovelId(imovelId)
    const imovelSelecionado = imoveisDisponiveis.find(i => i.id === imovelId)
    
    if (imovelSelecionado && imovelSelecionado.inquilino_id) {
      // O imóvel já possui inquilino vinculado
      setNovoChamadoInquilinoId(imovelSelecionado.inquilino_id)
      setNovoChamadoInquilinoNome(imovelSelecionado.inquilino?.nome || "Inquilino Vinculado")
      setNovoChamadoInquilinoBloqueado(true)
    } else {
      // Imóvel sem inquilino vinculado: libera o dropdown de seleção
      setNovoChamadoInquilinoId("")
      setNovoChamadoInquilinoNome("")
      setNovoChamadoInquilinoBloqueado(false)
    }
  }

  const handleNovoChamadoImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = e.target.files
    if (!arquivos || arquivos.length === 0) return

    const arrayArquivos = Array.from(arquivos)

    if (novoChamadoImagens.length + arrayArquivos.length > 3) {
      setErro("Erro: Limite estrito de até 3 imagens por chamado.")
      return
    }

    const formatosValidos = ["image/png", "image/jpeg", "image/jpg"]
    for (const arq of arrayArquivos) {
      const extensao = arq.name.toLowerCase().split('.').pop() || ''
      const tipo = arq.type.toLowerCase()
      if (!formatosValidos.includes(tipo) && !["png", "jpg", "jpeg"].includes(extensao)) {
        setErro("Apenas formatos .png, .jpg e .jpeg são aceitos.")
        return
      }
    }

    try {
      const arquivosComprimidos: File[] = []
      const previews: string[] = []

      for (const arq of arrayArquivos) {
        // Roda compressor preventivo via Canvas se exceder o limite de 2MB
        const comprimido = await comprimirImagemChamado(arq)
        arquivosComprimidos.push(comprimido)
        previews.push(URL.createObjectURL(comprimido))
      }

      setNovoChamadoImagens(prev => [...prev, ...arquivosComprimidos])
      setNovoChamadoImagensPreview(prev => [...prev, ...previews])
    } catch (err) {
      console.error("Erro ao comprimir imagem:", err)
    }
  }

  const removerNovoChamadoImagem = (index: number) => {
    setNovoChamadoImagens(prev => prev.filter((_, i) => i !== index))
    setNovoChamadoImagensPreview(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSalvarNovoChamado = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!novoChamadoImovelId) {
      setErro("Selecione o imóvel do chamado.")
      return
    }
    if (!novoChamadoInquilinoId) {
      setErro("Selecione ou vincule um inquilino para este chamado.")
      return
    }
    if (!novoChamadoTitulo.trim()) {
      setErro("Insira um título para o chamado.")
      return
    }
    if (!novoChamadoCategoria) {
      setErro("Selecione a categoria do serviço.")
      return
    }
    if (!novoChamadoDescricao.trim()) {
      setErro("Descreva o problema detalhadamente.")
      return
    }

    try {
      setSalvandoNovoChamado(true)

      // 1. Insere o chamado na tabela public.chamados
      const { data: chamadoCriado, error: chamadoError } = await supabase
        .from("chamados")
        .insert({
          imovel_id: novoChamadoImovelId,
          inquilino_id: novoChamadoInquilinoId,
          titulo: novoChamadoTitulo.trim(),
          descricao_problema: novoChamadoDescricao.trim(),
          categoria: novoChamadoCategoria,
          disponibilidade_atendimento: novoChamadoDisponibilidade.trim() || "A combinar com a imobiliária",
          status: "em_triagem"
        })
        .select()
        .single()

      if (chamadoError) throw chamadoError

      // 2. Insere histórico
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoCriado.id,
        usuario_id: user?.id,
        novo_status: "em_triagem",
        observacao: "Chamado aberto administrativamente pela imobiliária."
      })

      // 3. Upload de mídias se selecionadas
      const urlsImagens: string[] = []
      if (novoChamadoImagens.length > 0) {
        for (let i = 0; i < novoChamadoImagens.length; i++) {
          const img = novoChamadoImagens[i]
          const extensao = img.type.split("/")[1] || "jpg"
          const caminho = `${chamadoCriado.id}/problema/img_${i}_${Date.now()}.${extensao}`

          const { error: uploadError } = await supabase.storage
            .from("chamados")
            .upload(caminho, img)

          if (uploadError) throw uploadError

          const { data: urlData } = supabase.storage
            .from("chamados")
            .getPublicUrl(caminho)

          urlsImagens.push(urlData.publicUrl)
        }

        // Salva o array de URLs na coluna imagens_problema
        const { error: updateError } = await supabase
          .from("chamados")
          .update({ imagens_problema: urlsImagens })
          .eq("id", chamadoCriado.id)

        if (updateError) throw updateError
      }

      setNovoChamadoImovelId("")
      setNovoChamadoInquilinoId("")
      setNovoChamadoInquilinoNome("")
      setNovoChamadoInquilinoBloqueado(false)
      setNovoChamadoTitulo("")
      setNovoChamadoCategoria("")
      setNovoChamadoDescricao("")
      setNovoChamadoDisponibilidade("")
      setNovoChamadoImagens([])
      setNovoChamadoImagensPreview([])
      setFormChamadoAberto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""

      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro inesperado ao criar o chamado.")
    } finally {
      setSalvandoNovoChamado(false)
    }
  }

  // Função para buscar os chamados no banco de dados
  const loadChamados = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    
    try {
      let query = supabase
        .from("chamados")
        .select(`
          *,
          imovel:imovel_id (
            codigo_imovel,
            endereco,
            bairro,
            cidade,
            estado,
            cep,
            limite_alcada_r$,
            proprietario:proprietario_id (nome, telefone, aceita_painel_digital)
          ),
          inquilino:inquilino_id (nome, telefone),
          empresa_prestadora:empresa_prestadora_id (id, nome, tipo_repasse, prazo_repasse_dias),
          tecnico:tecnico_id (nome),
          orcamentos (
            id,
            valor_servico_r$,
            valor_materiais_r$,
            valor_total_r$,
            valor_servico_tecnico_r$,
            valor_materiais_tecnico_r$,
            responsavel_material_tecnico,
            responsavel_material_empresa,
            prazo_execucao_dias,
            observacoes_tecnicas,
            relatorio_conclusao,
            homologado_pela_empresa,
            prestador_id,
            prestador:prestador_id (nome)
          )
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
      setErro(`Não foi possível carregar a lista de chamados: ${err.message || err.details || JSON.stringify(err)}`)
    } finally {
      setLoading(false)
      setRealtimeLoading(false)
    }
  }

  // Carrega a lista de fechamentos mensais persistidos
  const loadFechamentos = async () => {
    setCarregandoFechamentos(true)
    try {
      const { data, error } = await supabase
        .from("fechamentos_mensais")
        .select(`
          *,
          criado_por:criado_por ( nome )
        `)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })

      if (error) throw error
      setFechamentos(data || [])
    } catch (err: any) {
      console.error("Erro ao carregar fechamentos:", err)
    } finally {
      setCarregandoFechamentos(false)
    }
  }

  // Realiza o fechamento mensal da competência selecionada
  const handleExecutarFechamento = async () => {
    setSalvandoFechamento(true)
    setErro(null)

    // 1. Filtra chamados elegíveis
    const chamadosElegiveis = chamados.filter(c => {
      if (c.status !== 'servico_concluido' && c.status !== 'encerrado') return false
      const orc = c.orcamentos && c.orcamentos.find(o => o.homologado_pela_empresa)
      if (!orc) return false
      if (c.fechamento_id) return false // Já fechado
      
      const dataRef = c.data_conclusao ? new Date(c.data_conclusao) : new Date(c.criado_em)
      return dataRef.getMonth() + 1 === mesFechamento && dataRef.getFullYear() === anoFechamento
    })

    if (chamadosElegiveis.length === 0) {
      alert("Nenhum chamado elegível encontrado para esta competência (Mês/Ano).")
      setSalvandoFechamento(false)
      return
    }

    // 2. Calcula os totais
    let totalReceber = 0
    let totalPagar = 0

    chamadosElegiveis.forEach(c => {
      const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
      if (!orc) return

      // Proprietário
      if (orc.responsavel_material_empresa === 'proprietario') {
        totalReceber += Number(orc.valor_servico_r$) + Number(orc.valor_materiais_r$)
      } else if (c.responsabilidade === 'proprietario') {
        totalReceber += Number(orc.valor_servico_r$)
      }

      // Prestador
      const matPagar = orc.responsavel_material_empresa === 'empresa' ? Number(orc.valor_materiais_r$) : 0
      totalPagar += Number(orc.valor_servico_r$) + matPagar
    })

    try {
      // 3. Insere a competência fechada na tabela fechamentos_mensais
      const { data: novoFechamento, error: insertError } = await supabase
        .from("fechamentos_mensais")
        .insert({
          mes: mesFechamento,
          ano: anoFechamento,
          total_receber_proprietarios: totalReceber,
          total_pagar_prestadores: totalPagar,
          criado_por: user?.id
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(`A competência ${String(mesFechamento).padStart(2, '0')}/${anoFechamento} já foi fechada anteriormente!`)
        }
        throw insertError
      }

      // 4. Associa os chamados a esse fechamento e os marca como pagos
      const chamadosIds = chamadosElegiveis.map(c => c.id)
      const { error: updateError } = await supabase
        .from("chamados")
        .update({
          fechamento_id: novoFechamento.id,
          status_financeiro: 'pago'
        })
        .in("id", chamadosIds)

      if (updateError) throw updateError

      // 5. Registra cada um no histórico de chamados para auditoria
      const historicos = chamadosElegiveis.map(c => ({
        chamado_id: c.id,
        usuario_id: user?.id,
        status_anterior: c.status,
        novo_status: c.status,
        observacao: `Chamado conciliado no Fechamento Mensal definitivo da competência ${String(mesFechamento).padStart(2, '0')}/${anoFechamento}.`
      }))

      const { error: histError } = await supabase
        .from("historico_chamados")
        .insert(historicos)

      if (histError) throw histError

      setExibirModalNovoFechamento(false)
      await loadChamados()
      await loadFechamentos()
      alert("Fechamento mensal realizado com sucesso!")
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Erro ao executar fechamento financeiro.")
    } finally {
      setSalvandoFechamento(false)
    }
  }

  // Configura a assinatura Realtime com o Supabase
  useEffect(() => {
    if (user && perfil) {
      loadChamados()
      loadFechamentos()

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

  // Aprova o orçamento diretamente se estiver dentro do limite de alçada
  const handleAprovarOrcamentoDireto = async () => {
    if (!chamadoAtivo || !orcamentoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    try {
      // 1. Atualiza o orçamento como autorizado pela imobiliária
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({ autorizado_pela_imobiliaria: true })
        .eq("id", orcamentoAtivo.id)

      if (orcamentoError) throw orcamentoError

      // 2. Atualiza o chamado para aguardando_autorizacao
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "aguardando_autorizacao" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 3. Registra a ação no histórico
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "aguardando_autorizacao",
          observacao: `Orçamento de R$ ${Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} aprovado diretamente pela imobiliária (dentro do limite).`
        })

      if (historicoError) throw historicoError

      setChamadoAtivo(null)
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao aprovar orçamento diretamente.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Encaminha o orçamento para avaliação do proprietário (excede o limite)
  const handleEncaminharProprietario = async () => {
    if (!chamadoAtivo || !orcamentoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    try {
      // 1. Atualiza o chamado para analise_proprietario
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "analise_proprietario" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 2. Registra no histórico de auditoria
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "analise_proprietario",
          observacao: `Orçamento de R$ ${Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} excede alçada de R$ ${Number(chamadoAtivo.imovel.limite_alcada_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Encaminhado ao Proprietário.`
        })

      if (historicoError) throw historicoError

      setChamadoAtivo(null)
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao encaminhar ao proprietário.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Aprova o orçamento em nome do proprietário (Autorização Externa)
  const handleAprovarEmNomeDoProprietario = async () => {
    if (!chamadoAtivo || !orcamentoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    try {
      // 1. Atualiza o orçamento como aprovado pelo proprietário
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({ aprovado_pelo_proprietario: true })
        .eq("id", orcamentoAtivo.id)

      if (orcamentoError) throw orcamentoError

      // 2. Atualiza o chamado para aguardando_autorizacao
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "aguardando_autorizacao" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 3. Registra a ação no histórico
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "aguardando_autorizacao",
          observacao: `Orçamento de R$ ${Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} aprovado em nome do Proprietário (Autorização Externa via WhatsApp/Telefone).`
        })

      if (historicoError) throw historicoError

      setChamadoAtivo(null)
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao aprovar em nome do proprietário.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Gera e envia resumo do chamado/orçamento via WhatsApp
  const handleCompartilharWhatsApp = () => {
    if (!chamadoAtivo) return

    const proprietario = chamadoAtivo.imovel.proprietario
    const nomeProprietario = proprietario?.nome || "Proprietário"
    const telefoneProprietario = proprietario?.telefone ? proprietario.telefone.replace(/\D/g, "") : ""
    const codigoImovel = chamadoAtivo.imovel.codigo_imovel
    const tituloChamado = chamadoAtivo.titulo
    const descricao = chamadoAtivo.descricao_problema

    const printLink = `${window.location.origin}/chamado/print/${chamadoAtivo.id}`

    let mensagem = ""

    if (orcamentoAtivo && orcamentoAtivo.valor_total_r$) {
      // Pedido de aprovação de valores (orçamento homologado/recebido)
      const valorTotal = Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      const valorServico = Number(orcamentoAtivo.valor_servico_r$).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      const valorMateriais = Number(orcamentoAtivo.valor_materiais_r$).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

      mensagem = `Olá, *${nomeProprietario}*!\n\n` +
        `Temos um orçamento pronto para a solicitação de manutenção do seu imóvel (*${codigoImovel}*):\n\n` +
        `- *Chamado*: ${tituloChamado}\n` +
        `- *Descrição*: ${descricao}\n` +
        `- *Mão de Obra*: ${valorServico}\n` +
        `- *Materiais*: ${valorMateriais}\n` +
        `- *Valor Total*: ${valorTotal}\n\n` +
        `Para visualizar os detalhes completos ou aprovar o serviço, acesse o link:\n${printLink}\n\n` +
        `Ficamos no aguardo de sua resposta. Obrigado!`
    } else {
      // Notificação inicial (OS aberta)
      mensagem = `Olá, *${nomeProprietario}*!\n\n` +
        `Gostaríamos de informar que foi aberta uma solicitação de manutenção para o seu imóvel (*${codigoImovel}*):\n\n` +
        `- *Chamado*: ${tituloChamado}\n` +
        `- *Descrição*: ${descricao}\n\n` +
        `Você pode acompanhar os detalhes e o andamento por este link:\n${printLink}\n\n` +
        `Qualquer dúvida, estamos à disposição!`
    }

    const ddi = telefoneProprietario ? (telefoneProprietario.startsWith("55") ? "" : "55") : ""
    const foneCompleto = telefoneProprietario ? `${ddi}${telefoneProprietario}` : ""
    const url = `https://api.whatsapp.com/send?phone=${foneCompleto}&text=${encodeURIComponent(mensagem)}`
    
    window.open(url, "_blank")
  }

  // Autoriza a execução técnica final da OS (status aguardando_autorizacao)
  const handleAutorizarExecucao = async () => {
    if (!chamadoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    try {
      // 1. Atualiza o chamado para os_liberada
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "os_liberada" })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 2. Registra no histórico de auditoria
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "os_liberada",
          observacao: `Execução autorizada pela Imobiliária. Ordem de Serviço (O.S.) liberada para execução técnica.`
        })

      if (historicoError) throw historicoError

      setChamadoAtivo(null)
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao autorizar execução.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Encerra o chamado após a conclusão dos reparos
  const handleEncerrarChamado = async () => {
    if (!chamadoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    if (!novaResponsabilidade || novaResponsabilidade === "indefinido") {
      setErro("Você precisa definir a Responsabilidade Financeira (Proprietário ou Inquilino) para encerrar o chamado.")
      setSalvandoAcao(false)
      return
    }

    try {
      // 1. Atualiza o status do chamado para encerrado e salva a responsabilidade financeira
      const updates: any = { status: "encerrado", responsabilidade: novaResponsabilidade }

      const { error: chamadoError } = await supabase
        .from("chamados")
        .update(updates)
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 2. Registra a ação no histórico
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: chamadoAtivo.status,
          novo_status: "encerrado",
          observacao: "Serviço homologado e concluído. Chamado encerrado pela Imobiliária."
        })

      if (historicoError) throw historicoError

      setChamadoAtivo(null)
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao encerrar chamado.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Desfaz o encerramento de um chamado, voltando-o ao status anterior
  const handleDesfazerEncerramento = async () => {
    if (!chamadoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    if (chamadoAtivo.status_financeiro === "pago") {
      setErro("Não é possível desfazer o encerramento de um chamado que já foi pago/conciliado.")
      setSalvandoAcao(false)
      return
    }

    try {
      // 1. Busca o último registro de encerramento no histórico para saber o status anterior
      const { data: historicos, error: histQueryError } = await supabase
        .from("historico_chamados")
        .select("status_anterior")
        .eq("chamado_id", chamadoAtivo.id)
        .eq("novo_status", "encerrado")
        .order("criado_em", { ascending: false })
        .limit(1)

      if (histQueryError) throw histQueryError

      // Se encontrar, volta ao status anterior. Caso contrário, assume "servico_concluido" como fallback seguro
      const statusDestino = historicos && historicos.length > 0 ? historicos[0].status_anterior : "servico_concluido"

      // 2. Atualiza o status do chamado
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ 
          status: statusDestino,
          responsabilidade: "indefinido"
        })
        .eq("id", chamadoAtivo.id)

      if (chamadoError) throw chamadoError

      // 3. Registra a reabertura no histórico
      const { error: historicoError } = await supabase
        .from("historico_chamados")
        .insert({
          chamado_id: chamadoAtivo.id,
          usuario_id: user?.id,
          status_anterior: "encerrado",
          novo_status: statusDestino,
          observacao: `Encerramento desfeito pela Imobiliária. Retornado ao status: ${statusDestino}. Responsabilidade Financeira retornada para Indefinido.`
        })

      if (historicoError) throw historicoError

      setChamadoAtivo(null)
      await loadChamados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao desfazer encerramento.")
    } finally {
      setSalvandoAcao(false)
    }
  }

  // Processa as atualizações de status ou responsabilidade de um chamado
  const handleAplicarAcao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoAtivo) return
    setSalvandoAcao(true)
    setErro(null)

    if (novoStatus === "encerrado" && (!novaResponsabilidade || novaResponsabilidade === "indefinido")) {
      setErro("Você precisa definir a Responsabilidade Financeira (Proprietário ou Inquilino) para encerrar o chamado.")
      setSalvandoAcao(false)
      return
    }

    try {
      const updates: any = {}
      if (novoStatus) updates.status = novoStatus
      if (novaResponsabilidade) updates.responsabilidade = novaResponsabilidade

      if (novoStatus === "aguardando_orcamento") {
        if (!empresaPrestadoraSelecionadaId) {
          throw new Error("Você precisa selecionar uma Empresa Prestadora para cotação.")
        }
        updates.empresa_prestadora_id = empresaPrestadoraSelecionadaId
        updates.tecnico_id = null
      }

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
      setEmpresaPrestadoraSelecionadaId("")
      
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
    
    let atendePeriodo = true
    if (filtroPeriodo !== "todos") {
      const dataCriacao = new Date(item.criado_em)
      const agora = new Date()
      
      if (filtroPeriodo === "mes_atual") {
        atendePeriodo = dataCriacao.getMonth() === agora.getMonth() && 
                        dataCriacao.getFullYear() === agora.getFullYear()
      } else if (filtroPeriodo === "ultimos_15_dias") {
        const limite = new Date()
        limite.setDate(agora.getDate() - 15)
        limite.setHours(0, 0, 0, 0)
        atendePeriodo = dataCriacao >= limite
      } else if (filtroPeriodo === "ultimos_7_dias") {
        const limite = new Date()
        limite.setDate(agora.getDate() - 7)
        limite.setHours(0, 0, 0, 0)
        atendePeriodo = dataCriacao >= limite
      } else if (filtroPeriodo === "personalizado") {
        if (dataInicioPersonalizada) {
          const inicio = new Date(dataInicioPersonalizada)
          inicio.setHours(0, 0, 0, 0)
          atendePeriodo = atendePeriodo && dataCriacao >= inicio
        }
        if (dataFimPersonalizada) {
          const fim = new Date(dataFimPersonalizada)
          fim.setHours(23, 59, 59, 999)
          atendePeriodo = atendePeriodo && dataCriacao <= fim
        }
      }
    }
    
    return atendeStatus && atendeCategoria && atendePeriodo
  })

  // Obtém categorias únicas para o filtro dropdown
  const categoriasUnicas = Array.from(new Set(chamados.map(item => item.categoria)))

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          {perfil?.logo_url ? (
            <img 
              src={perfil.logo_url} 
              alt={perfil.nome} 
              className="h-12 max-h-12 w-auto object-contain rounded border border-slate-200 bg-white p-1" 
            />
          ) : (
            <div className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400">
              <User className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-occasio-navy">
              {perfil?.nome || "Minha Imobiliária"}
            </h1>
            <p className="text-slate-500 text-xs md:text-sm">
              Painel de O.S. &amp; Triagem Realtime
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {realtimeLoading && (
            <span className="text-xs text-occasio-blue flex items-center gap-1.5 font-semibold bg-occasio-blue/10 px-2.5 py-1 rounded-full animate-pulse border border-occasio-blue/20">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Atualizando...
            </span>
          )}
          <Button 
            onClick={() => setFormChamadoAberto(!formChamadoAberto)}
            className="bg-occasio-blue hover:bg-occasio-navy text-white text-xs flex gap-1 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Novo Chamado
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadChamados()} className="text-xs flex gap-1 bg-white border-slate-200">
            <RefreshCw className="h-3.5 w-3.5" /> Forçar Recarga
          </Button>
        </div>
      </div>

      {/* Abas de Navegação (Chamados vs Financeiro) */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1.5 rounded-lg mb-6 max-w-md">
        <button
          onClick={() => setActiveTab("chamados")}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "chamados"
              ? "bg-white text-occasio-navy shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Chamados Ativos ({chamados.filter(c => c.status !== 'servico_concluido' && c.status !== 'encerrado' && c.status !== 'reprovado').length})
        </button>
        <button
          onClick={() => setActiveTab("financeiro")}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "financeiro"
              ? "bg-white text-occasio-navy shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Financeiro / Repasses
        </button>
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {activeTab === "chamados" && (
        <>
          {/* Formulário de Abertura de Chamado pela Imobiliária */}
          {formChamadoAberto && (
        <Card className="mb-8 border-slate-200 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-occasio-navy text-lg flex items-center gap-2">
              <Plus className="h-5 w-5 text-occasio-blue" />
              Abrir Novo Chamado de Manutenção
            </CardTitle>
            <CardDescription>
              Abra um chamado em nome do inquilino ou para um imóvel sob gestão.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSalvarNovoChamado} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Imóvel Afetado *</label>
                  <select
                    value={novoChamadoImovelId}
                    onChange={(e) => handleNovoChamadoImovelChange(e.target.value)}
                    className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-occasio-blue"
                    required
                  >
                    <option value="">Selecione um Imóvel...</option>
                    {imoveisDisponiveis.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.codigo_imovel} - {i.endereco}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Inquilino Relacionado *</label>
                  {novoChamadoInquilinoBloqueado ? (
                    <div className="flex items-center h-10 px-3 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-600 font-semibold">
                      {novoChamadoInquilinoNome}
                    </div>
                  ) : (
                    <select
                      value={novoChamadoInquilinoId}
                      onChange={(e) => setNovoChamadoInquilinoId(e.target.value)}
                      className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-occasio-blue"
                      required
                    >
                      <option value="">Selecione um Inquilino...</option>
                      {inquilinosDisponiveis.map(inq => (
                        <option key={inq.id} value={inq.id}>
                          {inq.nome}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {novoChamadoInquilinoBloqueado 
                      ? "Inquilino fixado conforme o cadastro oficial do imóvel." 
                      : "Selecione o perfil do inquilino para vincular a este chamado."}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Título do Chamado *</label>
                  <Input
                    placeholder="Ex: Vazamento sob a pia da cozinha, Disjuntor caindo"
                    value={novoChamadoTitulo}
                    onChange={(e) => setNovoChamadoTitulo(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Categoria do Serviço *</label>
                  <select
                    value={novoChamadoCategoria}
                    onChange={(e) => setNovoChamadoCategoria(e.target.value)}
                    className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-occasio-blue"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Elétrica">Elétrica</option>
                    <option value="Hidráulica">Hidráulica</option>
                    <option value="Pintura">Pintura</option>
                    <option value="Reparos">Reparos e Alvenaria</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Descrição Detalhada do Problema *</label>
                <textarea
                  placeholder="Descreva o que está ocorrendo, local, severidade do problema..."
                  value={novoChamadoDescricao}
                  onChange={(e) => setNovoChamadoDescricao(e.target.value)}
                  className="w-full border border-slate-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-occasio-blue h-24 bg-white"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Disponibilidade para Atendimento</label>
                  <Input
                    placeholder="Ex: Qualquer dia à tarde, Apenas sábados pela manhã"
                    value={novoChamadoDisponibilidade}
                    onChange={(e) => setNovoChamadoDisponibilidade(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Fotos do Problema (Upload de até 3 fotos)</label>
                  <div className="border border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    {novoChamadoImagensPreview.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 w-full mb-3">
                        {novoChamadoImagensPreview.map((preview, index) => (
                          <div key={index} className="relative border rounded-md overflow-hidden aspect-square bg-slate-100">
                            <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removerNovoChamadoImagem(index)}
                              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {novoChamadoImagensPreview.length < 3 && (
                      <div className="space-y-1 text-center flex flex-col items-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-semibold text-occasio-blue hover:text-occasio-navy text-xs">
                          <span>Adicionar Foto ({novoChamadoImagensPreview.length}/3)</span>
                          <input 
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleNovoChamadoImageChange}
                            className="sr-only"
                            multiple
                          />
                        </label>
                        <p className="text-[10px] text-slate-400">Formatos aceitos: .png, .jpg, .jpeg. Se exceder 2MB, será comprimido.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setFormChamadoAberto(false)}>
                  Cancelar
                </Button>
                <Button disabled={salvandoNovoChamado} type="submit" className="bg-occasio-blue hover:bg-occasio-navy text-white font-semibold">
                  {salvandoNovoChamado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Abrir Chamado
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
                {chamados.filter(c => c.status === 'aguardando_orcamento' || c.status === 'orcamento_recebido' || c.status === 'analise_proprietario' || c.status === 'aguardando_autorizacao').length}
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
                {chamados.filter(c => c.status === 'servico_concluido' || c.status === 'encerrado' || c.status === 'reprovado').length}
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

            <div>
              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value)}
                className="border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
              >
                <option value="todos">Qualquer Período</option>
                <option value="mes_atual">Mês Atual</option>
                <option value="ultimos_15_dias">Últimos 15 Dias</option>
                <option value="ultimos_7_dias">Últimos 7 Dias</option>
                <option value="personalizado">Período Personalizado...</option>
              </select>
            </div>

            {filtroPeriodo === "personalizado" && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md h-9 px-2">
                <input
                  type="date"
                  value={dataInicioPersonalizada}
                  onChange={(e) => setDataInicioPersonalizada(e.target.value)}
                  className="bg-transparent text-[11px] focus:outline-none max-w-[110px]"
                  title="Data de início"
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="date"
                  value={dataFimPersonalizada}
                  onChange={(e) => setDataFimPersonalizada(e.target.value)}
                  className="bg-transparent text-[11px] focus:outline-none max-w-[110px]"
                  title="Data de fim"
                />
              </div>
            )}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span 
                            className="relative group bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono cursor-help"
                            title={`${chamado.imovel.endereco}, ${chamado.imovel.bairro} - ${chamado.imovel.cidade}/${chamado.imovel.estado} - CEP ${chamado.imovel.cep}`}
                          >
                            Imóvel: {chamado.imovel.codigo_imovel}
                            {/* Tooltip customizado */}
                            <span className="absolute left-0 top-full mt-1.5 hidden group-hover:block w-72 bg-slate-900 text-white text-[11px] font-normal normal-case rounded p-3 shadow-xl z-50 border border-slate-700 leading-relaxed pointer-events-none">
                              <span className="block font-bold text-slate-300 mb-1">Endereço Completo:</span>
                              <p className="text-slate-200">
                                {chamado.imovel.endereco}
                                {chamado.imovel.bairro ? `, ${chamado.imovel.bairro}` : ""}
                              </p>
                              <p className="text-slate-400 mt-1">
                                {chamado.imovel.cidade} - {chamado.imovel.estado}
                                {chamado.imovel.cep ? ` | CEP: ${chamado.imovel.cep}` : ""}
                              </p>
                            </span>
                          </span>
                        </div>
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

                    <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 space-y-2">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-300" />
                            <span>
                              Inquilino: <strong className="text-slate-600 font-semibold">{chamado.inquilino.nome}</strong>
                              {chamado.inquilino.telefone && <span className="text-slate-400 font-normal"> ({chamado.inquilino.telefone})</span>}
                            </span>
                          </div>
                          {chamado.imovel.proprietario?.nome && (
                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                              <UserCheck className="h-3.5 w-3.5 text-slate-300" />
                              <span>
                                Proprietário: <strong className="text-slate-600 font-semibold">{chamado.imovel.proprietario.nome}</strong>
                                {chamado.imovel.proprietario.telefone && <span className="text-slate-400 font-normal"> ({chamado.imovel.proprietario.telefone})</span>}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          Criado em: <strong>{new Date(chamado.criado_em).toLocaleDateString('pt-BR')}</strong>
                        </div>
                      </div>

                      {chamado.disponibilidade_atendimento && (
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            Preferência de atendimento: <strong className="text-slate-700 font-semibold">{chamado.disponibilidade_atendimento}</strong>
                          </span>
                        </div>
                      )}

                      {chamado.empresa_prestadora?.nome && (
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 mt-1">
                          <Hammer className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            Prestador PJ: <strong className="text-slate-700 font-semibold">{chamado.empresa_prestadora.nome}</strong>
                          </span>
                        </div>
                      )}
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
                {/* Se for orcamento_recebido e tiver orçamento ativo, exibe inteligência de alçada */}
                {chamadoAtivo.status === "orcamento_recebido" && orcamentoAtivo ? (
                  <div className="space-y-4 pt-1">
                    <div className="bg-slate-50 p-3 rounded border border-slate-200/50 text-xs space-y-1">
                      <div className="font-bold text-slate-700 flex items-center gap-1">
                        <Hammer className="h-3.5 w-3.5 text-occasio-blue" />
                        Dados da Cotação
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Prestador: <strong className="text-slate-700">{orcamentoAtivo.prestador?.nome || "Técnico"}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Mão de Obra: <strong className="text-slate-700">R$ {Number(orcamentoAtivo.valor_servico_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Materiais: <strong className="text-slate-700">R$ {Number(orcamentoAtivo.valor_materiais_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-dashed border-slate-200">
                        <span className="font-bold text-slate-800">Custo Total:</span>
                        <strong className="text-occasio-blue text-sm font-extrabold">
                          R$ {Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-500 pt-0.5">
                        Prazo: <strong className="text-slate-700">{orcamentoAtivo.prazo_execucao_dias} dias</strong>
                      </div>
                      {orcamentoAtivo.observacoes_tecnicas && (
                        <div className="text-[10px] text-slate-400 italic pt-1 mt-1 border-t border-slate-100">
                          &ldquo;{orcamentoAtivo.observacoes_tecnicas}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Alerta de Alçada comparando custo com limite do imóvel */}
                    {Number(orcamentoAtivo.valor_total_r$) <= chamadoAtivo.imovel.limite_alcada_r$ ? (
                      <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Orçamento dentro da Alçada
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          O valor total de R$ {Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está dentro da alçada máxima de aprovação direta da imobiliária (R$ {Number(chamadoAtivo.imovel.limite_alcada_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).
                        </p>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          Excede Limite de Alçada
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          O valor total de R$ {Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} excede o limite máximo para aprovação direta pela imobiliária (R$ {Number(chamadoAtivo.imovel.limite_alcada_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).
                        </p>
                      </div>
                    )}

                    <div className="pt-2">
                      {Number(orcamentoAtivo.valor_total_r$) <= chamadoAtivo.imovel.limite_alcada_r$ ? (
                        <Button
                          type="button"
                          disabled={salvandoAcao}
                          onClick={handleAprovarOrcamentoDireto}
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-9 flex items-center gap-1 justify-center"
                        >
                          {salvandoAcao ? "Processando..." : <><CheckCircle2 className="h-4 w-4" /> Aprovar Orçamento (Direto)</>}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled={salvandoAcao}
                          onClick={handleEncaminharProprietario}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 flex items-center gap-1 justify-center"
                        >
                          {salvandoAcao ? "Processando..." : <><User className="h-4 w-4" /> Encaminhar ao Proprietário</>}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : chamadoAtivo.status === "analise_proprietario" && orcamentoAtivo ? (
                  <div className="space-y-4 pt-1">
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-3 rounded text-xs space-y-1.5 animate-fade-in">
                      <div className="font-bold flex items-center gap-1">
                        <Clock className="h-4 w-4 text-indigo-600" />
                        Em Análise pelo Proprietário
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        O orçamento de <strong>R$ {Number(orcamentoAtivo.valor_total_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> está sob análise do proprietário <strong>{chamadoAtivo.imovel.proprietario?.nome}</strong>.
                      </p>
                      {chamadoAtivo.imovel.proprietario?.aceita_painel_digital === false && (
                        <div className="bg-rose-100/80 border border-rose-200 text-rose-800 p-2.5 rounded text-[11px] font-semibold mt-2">
                          ⚠️ Proprietário Analógico: A aprovação deve ser realizada de forma externa (via telefone/WhatsApp).
                        </div>
                      )}
                    </div>

                    {/* Exibe o botão de aprovação externa se o proprietário for analógico */}
                    {chamadoAtivo.imovel.proprietario?.aceita_painel_digital === false && (
                      <Button
                        type="button"
                        disabled={salvandoAcao}
                        onClick={handleAprovarEmNomeDoProprietario}
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-10 flex items-center gap-1.5 justify-center shadow"
                      >
                        {salvandoAcao ? "Aprovando..." : <>Aprovar em nome do Proprietário (Autorização Externa)</>}
                      </Button>
                    )}
                  </div>
                ) : chamadoAtivo.status === "aguardando_autorizacao" ? (
                  <div className="space-y-4 pt-1">
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-xs space-y-1.5">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-amber-600" />
                        Orçamento Aprovado
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        O orçamento foi autorizado e está aguardando liberação de início. Clique no botão abaixo para gerar a Ordem de Serviço (O.S.) e notificar o técnico parceiro.
                      </p>
                    </div>

                    <Button
                      type="button"
                      disabled={salvandoAcao}
                      onClick={handleAutorizarExecucao}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-10 flex items-center gap-1.5 justify-center shadow"
                    >
                      {salvandoAcao ? "Autorizando..." : <>✅ Autorizar Execução do Serviço</>}
                    </Button>
                  </div>
                ) : chamadoAtivo.status === "servico_concluido" ? (
                  <div className="space-y-4 pt-1">
                    <div className="bg-slate-50 p-3 rounded border border-slate-200/50 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700">Relatório de Conclusão</div>
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded leading-relaxed italic border border-slate-100">
                        &ldquo;{orcamentoAtivo?.relatorio_conclusao || "Nenhum relatório técnico cadastrado."}&rdquo;
                      </p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Reparos Finalizados
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        O prestador técnico concluiu a execução e submeteu as fotos comprobatórias do "Depois". Revise as fotos na galeria abaixo e homologue o encerramento.
                      </p>
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

                    <Button
                      type="button"
                      disabled={salvandoAcao}
                      onClick={handleEncerrarChamado}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-10 flex items-center gap-1.5 justify-center shadow"
                    >
                      {salvandoAcao ? "Homologando..." : <>Aprovar Conclusão &amp; Encerrar</>}
                    </Button>
                  </div>
                ) : chamadoAtivo.status === "encerrado" ? (
                  <div className="space-y-4 pt-1">
                    <div className="bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded text-xs space-y-2">
                      <div className="font-bold flex items-center gap-1 text-occasio-navy">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Histórico Arquivado
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Este chamado foi concluído e encerrado definitivamente. O laudo técnico com o comparativo de fotos do Antes e Depois está gerado e disponível para consulta.
                      </p>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-500 uppercase tracking-wider">Responsabilidade Financeira</span>
                        <Badge className={`${RESP_CONFIG[chamadoAtivo.responsabilidade]?.cor || "bg-slate-300"} text-[10px] font-bold px-2 py-0.5 rounded`}>
                          {RESP_CONFIG[chamadoAtivo.responsabilidade]?.label}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setMostrarLaudo(true)}
                      className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold h-10 flex items-center gap-1.5 justify-center shadow"
                    >
                      <FileText className="h-4 w-4" /> Visualizar Laudo Técnico
                    </Button>

                    <Button
                      type="button"
                      disabled={salvandoAcao || chamadoAtivo.status_financeiro === "pago"}
                      variant="outline"
                      onClick={handleDesfazerEncerramento}
                      className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-[11px] font-bold h-9 flex items-center gap-1.5 justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
                    >
                      {salvandoAcao ? "Reabrindo..." : (chamadoAtivo.status_financeiro === "pago" ? "Bloqueado: OS Paga" : "Desfazer Encerramento")}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleAplicarAcao} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Chamado Selecionado
                      </label>
                      <div className="p-3 bg-slate-50 rounded border border-slate-200/50 space-y-1">
                        <div className="text-xs font-bold text-occasio-navy font-mono">ID: {chamadoAtivo.id.slice(0,8)}...</div>
                        <div className="text-sm font-extrabold text-slate-800 line-clamp-1 mt-0.5">{chamadoAtivo.titulo}</div>
                        <div className="text-xs text-slate-400 mt-1 flex justify-between border-t border-slate-200/50 pt-1">
                          <span>Alçada Imóvel:</span>
                          <strong className="text-slate-600">
                            {chamadoAtivo.imovel.limite_alcada_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </strong>
                        </div>
                        {chamadoAtivo.empresa_prestadora && (
                          <div className="text-xs text-slate-400 flex justify-between border-t border-slate-200/50 pt-1">
                            <span>Empresa designada:</span>
                            <strong className="text-slate-700 font-bold">
                              {chamadoAtivo.empresa_prestadora.nome}
                            </strong>
                          </div>
                        )}
                        {chamadoAtivo.tecnico && (
                          <div className="text-xs text-slate-400 flex justify-between border-t border-slate-200/50 pt-1">
                            <span>Técnico responsável:</span>
                            <strong className="text-slate-700 font-bold">
                              {chamadoAtivo.tecnico.nome}
                            </strong>
                          </div>
                        )}
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

                    {novoStatus === "aguardando_orcamento" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Empresa Prestadora (PJ) *
                        </label>
                        {empresasVinculadas.length === 0 ? (
                          <div className="text-[11px] text-red-500 font-semibold p-2 bg-red-50 border border-red-100 rounded">
                            Nenhuma Empresa Prestadora PJ vinculada à sua imobiliária!
                          </div>
                        ) : (
                          <select
                            value={empresaPrestadoraSelecionadaId}
                            onChange={(e) => setEmpresaPrestadoraSelecionadaId(e.target.value)}
                            required
                            className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                          >
                            <option value="">Selecione uma empresa...</option>
                            {empresasVinculadas.map((emp) => (
                              <option key={emp.id} value={emp.id}>{emp.nome}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

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
                )}

                {/* Compartilhamento com Proprietário */}
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Comunicação com o Proprietário
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={handleCompartilharWhatsApp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold h-9 flex items-center gap-1.5 justify-center shadow"
                    >
                      <MessageSquare className="h-4 w-4" /> Enviar via WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(`/chamado/print/${chamadoAtivo.id}`, '_blank')}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold h-9 flex items-center gap-1.5 justify-center"
                    >
                      <Printer className="h-4 w-4" /> Ver Impressão / PDF
                    </Button>
                  </div>
                </div>

                {/* Exibição de Fotos Vistoria Técnica com Zoom (Galeria Antes e Depois) */}
                {((chamadoAtivo.imagens_problema && chamadoAtivo.imagens_problema.length > 0) || 
                  (chamadoAtivo.imagens_solucao && chamadoAtivo.imagens_solucao.length > 0) || 
                  midias.length > 0) && (
                  <div className="pt-4 border-t border-slate-100 mt-4 space-y-4">
                    {/* Fotos do Problema */}
                    {((chamadoAtivo.imagens_problema && chamadoAtivo.imagens_problema.length > 0) || midias.some(m => m.tipo_midia === 'antes')) && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Fotos do Problema (Antes)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {chamadoAtivo.imagens_problema?.map((url, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setUrlImagemZoom(url)}
                              className="relative aspect-video rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
                            >
                              <img 
                                src={url} 
                                alt={`Problema ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          ))}
                          {/* Legacy "antes" midias */}
                          {midias.filter(m => m.tipo_midia === 'antes' && (!chamadoAtivo.imagens_problema || !chamadoAtivo.imagens_problema.includes(m.url_storage))).map((midia) => (
                            <div 
                              key={midia.id} 
                              onClick={() => setUrlImagemZoom(midia.url_storage)}
                              className="relative aspect-video rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
                            >
                              <img 
                                src={midia.url_storage} 
                                alt="Problema legado"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fotos da Solução */}
                    {((chamadoAtivo.imagens_solucao && chamadoAtivo.imagens_solucao.length > 0) || midias.some(m => m.tipo_midia === 'depois')) && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Fotos da Solução (Depois)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {chamadoAtivo.imagens_solucao?.map((url, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setUrlImagemZoom(url)}
                              className="relative aspect-video rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
                            >
                              <img 
                                src={url} 
                                alt={`Solução ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          ))}
                          {/* Legacy "depois" midias */}
                          {midias.filter(m => m.tipo_midia === 'depois' && (!chamadoAtivo.imagens_solucao || !chamadoAtivo.imagens_solucao.includes(m.url_storage))).map((midia) => (
                            <div 
                              key={midia.id} 
                              onClick={() => setUrlImagemZoom(midia.url_storage)}
                              className="relative aspect-video rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
                            >
                              <img 
                                src={midia.url_storage} 
                                alt="Solução legada"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
        </>
      )}

      {/* ======================== ABA FINANCEIRA DA IMOBILIÁRIA ======================== */}
      {activeTab === "financeiro" && (() => {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        // Filtra chamados concluídos ou encerrados que possuem orçamento homologado
        const chamadosFinalizados = chamados.filter(c => {
          if (c.status !== 'servico_concluido' && c.status !== 'encerrado') return false
          return c.orcamentos && c.orcamentos.some(o => o.homologado_pela_empresa)
        })

        // Métricas de cabeçalho
        const totalReceberProprietarios = chamadosFinalizados.reduce((acc, chamado) => {
          const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return acc
          if (orc.responsavel_material_empresa === 'proprietario') {
            return acc + orc.valor_servico_r$ + orc.valor_materiais_r$
          }
          if (chamado.responsabilidade === 'proprietario') {
            return acc + orc.valor_servico_r$
          }
          return acc
        }, 0)

        const totalPagarPrestadores = chamadosFinalizados.reduce((acc, chamado) => {
          const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return acc
          const matPagar = orc.responsavel_material_empresa === 'empresa' ? orc.valor_materiais_r$ : 0
          return acc + orc.valor_servico_r$ + matPagar
        }, 0)

        const margemIntermediacao = totalReceberProprietarios - totalPagarPrestadores

        // Filtra a lista de conciliação
        const chamadosConciliacaoFiltrados = chamadosFinalizados.filter((chamado) => {
          const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return false

          const inPago = chamado.status_financeiro === "pago"
          const atendeStatus = 
            filtroFinanceiroStatus === "todos" ||
            (filtroFinanceiroStatus === "pago" && inPago) ||
            (filtroFinanceiroStatus === "pendente" && !inPago)

          const atendePrestador =
            filtroFinanceiroPrestador === "todos" ||
            chamado.empresa_prestadora?.id === filtroFinanceiroPrestador

          return atendeStatus && atendePrestador
        })

        // Lista de prestadoras únicas para o filtro
        const prestadorasUnicas = Array.from(new Set(
          chamadosFinalizados
            .map(c => c.empresa_prestadora)
            .filter((p): p is NonNullable<typeof p> => !!p)
            .map(p => JSON.stringify({ id: p.id, nome: p.nome }))
        )).map(str => JSON.parse(str as string))

        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Métricas de Cabeçalho */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A Receber (Proprietários)</p>
                    <h3 className="text-xl font-black text-indigo-600 mt-1">
                      R$ {totalReceberProprietarios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[9px] text-slate-400 mt-1">Custos debitados do aluguel</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <User className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-white">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A Pagar (Prestadores PJ)</p>
                    <h3 className="text-xl font-black text-red-600 mt-1">
                      R$ {totalPagarPrestadores.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[9px] text-slate-400 mt-1">Repasses homologados pendentes</p>
                  </div>
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                    <Hammer className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-white">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo de Intermediação</p>
                    <h3 className={`text-xl font-black mt-1 ${margemIntermediacao >= 0 ? "text-green-600" : "text-amber-600"}`}>
                      R$ {margemIntermediacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[9px] text-slate-400 mt-1">Balanço intermediado</p>
                  </div>
                  <div className={`p-3 rounded-lg ${margemIntermediacao >= 0 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sub-navegação Financeira */}
            <div className="flex gap-2 border-b border-slate-200 pb-1.5">
              <button
                type="button"
                onClick={() => setSubAbaFinanceira("pendentes")}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                  subAbaFinanceira === "pendentes"
                    ? "bg-occasio-blue text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                Lotes de Acerto / Conciliação
              </button>
              <button
                type="button"
                onClick={() => setSubAbaFinanceira("historico")}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                  subAbaFinanceira === "historico"
                    ? "bg-occasio-blue text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                Histórico de Fechamentos Mensais
              </button>
            </div>

            {subAbaFinanceira === "pendentes" ? (
              <>
                {/* Filtros Financeiros */}
                <Card className="border-slate-200 shadow-sm bg-slate-50/50">
                  <CardContent className="py-4 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700">Filtrar Lotes de Acerto:</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center flex-grow justify-end">
                      <div>
                        <select
                          value={filtroFinanceiroStatus}
                          onChange={(e) => setFiltroFinanceiroStatus(e.target.value as any)}
                          className="border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                        >
                          <option value="todos">Todos os Status</option>
                          <option value="pendente">Pendentes (Não Pagos)</option>
                          <option value="pago">Conciliados (Pagos)</option>
                        </select>
                      </div>

                      <div>
                        <select
                          value={filtroFinanceiroPrestador}
                          onChange={(e) => setFiltroFinanceiroPrestador(e.target.value)}
                          className="border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                        >
                          <option value="todos">Todas as Prestadoras</option>
                          {prestadorasUnicas.map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                          ))}
                        </select>
                      </div>

                      <Button
                        type="button"
                        onClick={() => setExibirModalNovoFechamento(true)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-9 px-4 flex items-center gap-1.5 justify-center shadow-sm"
                      >
                        <Plus className="h-4 w-4" /> Novo Fechamento Mensal
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabela de Conciliação */}
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-4">Imóvel/OS</th>
                          <th className="py-3 px-4">Proprietário (Devedor)</th>
                          <th className="py-3 px-4">Prestadora PJ (Credor)</th>
                          <th className="py-3 px-4">Regra / Previsão</th>
                          <th className="py-3 px-4 text-right">A Receber (Prop)</th>
                          <th className="py-3 px-4 text-right">A Pagar (PJ)</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {chamadosConciliacaoFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-10 text-slate-400">
                              Nenhum chamado conciliável encontrado.
                            </td>
                          </tr>
                        ) : (
                          chamadosConciliacaoFiltrados.map((chamado) => {
                            const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
                            if (!orc) return null

                            const isPago = chamado.status_financeiro === "pago"
                            const isFechado = !!chamado.fechamento_id

                            // Valores
                            const valReceber = orc.responsavel_material_empresa === 'proprietario' 
                              ? orc.valor_servico_r$ + orc.valor_materiais_r$ 
                              : (chamado.responsabilidade === 'proprietario' ? orc.valor_servico_r$ : 0)

                            const valPagar = orc.valor_servico_r$ + (orc.responsavel_material_empresa === 'empresa' ? orc.valor_materiais_r$ : 0)

                            // Prazos
                            const dataConcl = chamado.data_conclusao || chamado.criado_em
                            const dtRepasse = calcularDataRepasse(dataConcl, chamado.empresa_prestadora?.tipo_repasse, chamado.empresa_prestadora?.prazo_repasse_dias)
                            const condRepasse = formatarCondicaoRepasse(chamado.empresa_prestadora?.tipo_repasse, chamado.empresa_prestadora?.prazo_repasse_dias)

                            const isVencido = dtRepasse && dtRepasse < hoje && !isPago

                            return (
                              <tr key={chamado.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3.5 px-4">
                                  <span className="bg-slate-100 text-slate-500 border px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
                                    {chamado.imovel?.codigo_imovel}
                                  </span>
                                  <div className="font-extrabold text-occasio-navy mt-1 max-w-[150px] truncate" title={chamado.titulo}>
                                    {chamado.titulo}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-slate-700">Proprietário do Imóvel</div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{chamado.imovel?.endereco}</div>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-700">
                                  {chamado.empresa_prestadora?.nome || "Não atribuído"}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="text-[10px] text-slate-500">{condRepasse}</div>
                                  <div className={`font-bold mt-0.5 ${isVencido ? "text-red-500" : "text-slate-700"}`}>
                                    {formatarData(dtRepasse)} {isVencido && <span className="text-[9px] font-extrabold">(VENCIDO)</span>}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                                  R$ {valReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                                  R$ {valPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <Badge className={`border text-[9px] font-extrabold uppercase ${
                                    isPago 
                                      ? "bg-green-50 text-green-700 border-green-200" 
                                      : (isVencido ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")
                                  }`}>
                                    {isPago ? "Pago" : (isVencido ? "Atrasado" : "Pendente")}
                                  </Badge>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => setExtratoProprietarioAtivo(chamado)}
                                      className="h-7 text-[10px] px-2 font-semibold bg-white text-occasio-blue border-slate-200 hover:bg-slate-50 hover:text-occasio-navy flex gap-1 items-center"
                                    >
                                      <FileText className="h-3 w-3" /> Extrato
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={salvandoAcao || isFechado}
                                      onClick={async () => {
                                        setSalvandoAcao(true)
                                        try {
                                          const novoStatusFin = isPago ? "pendente" : "pago"
                                          const { error } = await supabase
                                            .from("chamados")
                                            .update({ status_financeiro: novoStatusFin })
                                            .eq("id", chamado.id)
                                          if (error) throw error
                                          await loadChamados()
                                        } catch (err: any) {
                                          console.error(err)
                                          alert(err.message || "Erro ao atualizar pagamento.")
                                        } finally {
                                          setSalvandoAcao(false)
                                        }
                                      }}
                                      className={`h-7 text-[10px] px-2 font-semibold text-white ${
                                        isFechado 
                                          ? "bg-slate-300 border-slate-300 text-slate-500 cursor-not-allowed" 
                                          : (isPago ? "bg-amber-500 hover:bg-amber-600" : "bg-green-600 hover:bg-green-700")
                                      }`}
                                    >
                                      {isFechado ? "Fechado" : (isPago ? "Pendente" : "Pagar")}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              /* Histórico de Fechamentos */
              <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Competência</th>
                        <th className="py-3 px-4">Data do Fechamento</th>
                        <th className="py-3 px-4">Operador</th>
                        <th className="py-3 px-4 text-right">Desconto Proprietários</th>
                        <th className="py-3 px-4 text-right">Repasse Prestadoras</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {carregandoFechamentos ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400">
                            Carregando histórico...
                          </td>
                        </tr>
                      ) : fechamentos.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400">
                            Nenhum fechamento mensal registrado ainda.
                          </td>
                        </tr>
                      ) : (
                        fechamentos.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-occasio-navy">
                              {String(f.mes).padStart(2, '0')}/{f.ano}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {new Date(f.criado_em).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {f.criado_por?.nome || "Sistema"}
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                              R$ {Number(f.total_receber_proprietarios).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                              R$ {Number(f.total_pagar_prestadores).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setFechamentoSelecionado(f)
                                  setExibirModalDetalhesFechamento(true)
                                }}
                                className="h-7 text-[10px] px-2.5 font-bold bg-occasio-blue hover:bg-occasio-navy text-white"
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" /> Detalhes / Extrato
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )
      })()}

      {/* Modal de Prestação de Contas (Extrato Proprietário) */}
      {extratoProprietarioAtivo && (() => {
        const chamado = extratoProprietarioAtivo
        const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
        if (!orc) return null

        const valorServico = orc.valor_servico_r$
        const valorMateriais = orc.responsavel_material_empresa === 'proprietario' ? orc.valor_materiais_r$ : 0
        const valorTotal = valorServico + valorMateriais

        const textoExtrato = `================================================
EXTRATO DE PRESTAÇÃO DE CONTAS - MANUTENÇÃO IMOBILIÁRIA
================================================
Código do Imóvel: ${chamado.imovel?.codigo_imovel || "N/A"}
Endereço: ${chamado.imovel?.endereco || "N/A"}
Chamado: ${chamado.titulo}
Data de Conclusão: ${formatarData(chamado.data_conclusao ? new Date(chamado.data_conclusao) : new Date(chamado.criado_em))}
------------------------------------------------
DETALHAMENTO DOS CUSTOS:
Mão de Obra / Serviço: R$ ${valorServico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Materiais (Proprietário): R$ ${valorMateriais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
------------------------------------------------
VALOR TOTAL A DESCONTAR NO ALUGUEL: R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
================================================
Extrato gerado eletronicamente para fins de conciliação.
`

        return (
          <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-slate-200 shadow-2xl bg-white animate-in zoom-in-95 duration-200">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-occasio-navy text-sm font-extrabold uppercase flex justify-between items-center">
                  <span>Prestação de Contas</span>
                  <button onClick={() => setExtratoProprietarioAtivo(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">
                    Fechar
                  </button>
                </CardTitle>
                <CardDescription className="text-xs">
                  Resumo pronto para lançar desconto no extrato de aluguel do proprietário.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="bg-slate-900 text-green-400 p-4 rounded font-mono text-[10px] whitespace-pre-wrap select-all leading-relaxed shadow-inner border border-slate-800">
                  {textoExtrato}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(textoExtrato)
                      alert("Extrato copiado para a área de transferência!")
                    }}
                    className="flex-1 bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-semibold"
                  >
                    Copiar Texto
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setExtratoProprietarioAtivo(null)}
                    className="flex-1 border-slate-200 text-xs text-slate-600 hover:bg-slate-50 bg-white"
                  >
                    Fechar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })()}

      {/* Modal de Inspeção com Zoom Reativo */}
      {urlImagemZoom && (
        <VisualizadorImagem 
          src={urlImagemZoom} 
          onClose={() => setUrlImagemZoom(null)} 
        />
      )}

      {/* Modal de Laudo Técnico */}
      {mostrarLaudo && chamadoAtivo && (
        <LaudoTecnico 
          chamado={chamadoAtivo as any}
          midias={midias}
          onClose={() => setMostrarLaudo(false)}
          imobiliaria={perfil ? { nome: perfil.nome, logo_url: perfil.logo_url || null } : null}
        />
      )}

      {/* Modal de Realizar Fechamento Mensal */}
      {exibirModalNovoFechamento && (() => {
        const chamadosCompetencia = chamados.filter(c => {
          if (c.status !== 'servico_concluido' && c.status !== 'encerrado') return false
          const orc = c.orcamentos && c.orcamentos.find(o => o.homologado_pela_empresa)
          if (!orc) return false
          if (c.fechamento_id) return false
          
          const dataRef = c.data_conclusao ? new Date(c.data_conclusao) : new Date(c.criado_em)
          return dataRef.getMonth() + 1 === mesFechamento && dataRef.getFullYear() === anoFechamento
        })

        let prevReceber = 0
        let prevPagar = 0
        chamadosCompetencia.forEach(c => {
          const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return
          if (orc.responsavel_material_empresa === 'proprietario') {
            prevReceber += Number(orc.valor_servico_r$) + Number(orc.valor_materiais_r$)
          } else if (c.responsabilidade === 'proprietario') {
            prevReceber += Number(orc.valor_servico_r$)
          }
          const matPagar = orc.responsavel_material_empresa === 'empresa' ? Number(orc.valor_materiais_r$) : 0
          prevPagar += Number(orc.valor_servico_r$) + matPagar
        })

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md border-slate-200 shadow-2xl bg-white animate-in zoom-in-95 duration-150">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-1.5 justify-between">
                  <span>Realizar Fechamento Mensal</span>
                  <button onClick={() => setExibirModalNovoFechamento(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                </CardTitle>
                <CardDescription className="text-xs">
                  Selecione a competência para faturar e conciliar todas as OS's concluídas de forma definitiva.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mês *</label>
                    <select
                      value={mesFechamento}
                      onChange={(e) => setMesFechamento(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')} - {new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'long' })}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ano *</label>
                    <select
                      value={anoFechamento}
                      onChange={(e) => setAnoFechamento(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs"
                    >
                      {[2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">OS's Elegíveis:</span>
                    <strong className="text-slate-700">{chamadosCompetencia.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total a Receber (Proprietários):</span>
                    <strong className="text-green-600">R$ {prevReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total a Pagar (Prestadoras):</span>
                    <strong className="text-amber-600">R$ {prevPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-bold">
                    <span className="text-slate-700">Saldo Intermediado:</span>
                    <span className={prevReceber - prevPagar >= 0 ? "text-green-600" : "text-amber-600"}>
                      R$ {(prevReceber - prevPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {chamadosCompetencia.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto border border-slate-100 rounded p-2 bg-white text-[10px] space-y-1.5">
                    {chamadosCompetencia.map(c => (
                      <div key={c.id} className="flex justify-between text-slate-500 hover:text-slate-800 border-b pb-1 last:border-0 last:pb-0">
                        <span className="truncate max-w-[200px]" title={c.titulo}>
                          [{c.imovel?.codigo_imovel}] {c.titulo}
                        </span>
                        <span className="font-semibold text-slate-700 font-mono">
                          {c.orcamentos?.find(o => o.homologado_pela_empresa)?.valor_total_r$?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-red-500 font-medium text-center">
                    Nenhuma OS pronta/concluída encontrada para esta competência.
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    disabled={salvandoFechamento || chamadosCompetencia.length === 0}
                    onClick={handleExecutarFechamento}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                  >
                    {salvandoFechamento ? "Processando..." : "Confirmar Fechamento"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setExibirModalNovoFechamento(false)}
                    className="flex-1 border-slate-200 text-xs text-slate-600 hover:bg-slate-50 bg-white"
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })()}

      {/* Modal de Detalhes / Extrato do Fechamento */}
      {exibirModalDetalhesFechamento && fechamentoSelecionado && (() => {
        const f = fechamentoSelecionado
        const chamadosFechados = chamados.filter(c => c.fechamento_id === f.id)

        const proprietariosMap: { [nome: string]: number } = {}
        const prestadorasMap: { [nome: string]: number } = {}
        const inquilinosMap: { [nome: string]: number } = {}

        chamadosFechados.forEach(c => {
          const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return

          let valProp = 0
          if (orc.responsavel_material_empresa === 'proprietario') {
            valProp = Number(orc.valor_servico_r$) + Number(orc.valor_materiais_r$)
          } else if (c.responsabilidade === 'proprietario') {
            valProp = Number(orc.valor_servico_r$)
          }
          if (valProp > 0) {
            const nomeProp = c.imovel?.proprietario?.nome || "Proprietário Sem Nome"
            proprietariosMap[nomeProp] = (proprietariosMap[nomeProp] || 0) + valProp
          }

          const matPagar = orc.responsavel_material_empresa === 'empresa' ? Number(orc.valor_materiais_r$) : 0
          const valPrest = Number(orc.valor_servico_r$) + matPagar
          if (valPrest > 0) {
            const nomePrest = c.empresa_prestadora?.nome || "Prestadora PJ Sem Nome"
            prestadorasMap[nomePrest] = (prestadorasMap[nomePrest] || 0) + valPrest
          }

          let valInq = 0
          if (c.responsabilidade === 'proprietario' && c.descricao_problema.toLowerCase().includes('reembolso')) {
            valInq = Number(orc.valor_materiais_r$)
          }
          if (valInq > 0) {
            const nomeInq = c.inquilino?.nome || "Inquilino Sem Nome"
            inquilinosMap[nomeInq] = (inquilinosMap[nomeInq] || 0) + valInq
          }
        })

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg border-slate-200 shadow-2xl bg-white animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex-shrink-0">
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-1.5 justify-between">
                  <span>Fechamento Mensal Competência: {String(f.mes).padStart(2, '0')}/{f.ano}</span>
                  <button onClick={() => setExibirModalDetalhesFechamento(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                </CardTitle>
                <CardDescription className="text-xs">
                  Relatório consolidado e definitivo de contas fechadas em {new Date(f.criado_em).toLocaleDateString('pt-BR')} por {f.criado_por?.nome || "Sistema"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 overflow-y-auto flex-grow">
                <div className="grid grid-cols-3 gap-3 text-center border-b pb-4">
                  <div className="bg-green-50/50 p-2.5 rounded border border-green-100">
                    <div className="text-[9px] font-bold text-green-700 uppercase">Recebido (Proprietários)</div>
                    <div className="text-sm font-black text-green-800 mt-0.5 font-mono">R$ {Number(f.total_receber_proprietarios).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-amber-50/50 p-2.5 rounded border border-amber-100">
                    <div className="text-[9px] font-bold text-amber-700 uppercase">Pago (Prestadores)</div>
                    <div className="text-sm font-black text-amber-800 mt-0.5 font-mono">R$ {Number(f.total_pagar_prestadores).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200/60">
                    <div className="text-[9px] font-bold text-slate-600 uppercase">Margem Retida</div>
                    <div className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                      R$ {(Number(f.total_receber_proprietarios) - Number(f.total_pagar_prestadores)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                    👤 Deduções de Aluguel (Proprietários)
                  </h4>
                  {Object.keys(proprietariosMap).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Nenhum desconto lançado para proprietários nesta competência.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {Object.entries(proprietariosMap).map(([nome, valor]) => (
                        <div key={nome} className="flex justify-between text-xs border-b border-dashed pb-1">
                          <span className="text-slate-600 font-medium">{nome}</span>
                          <strong className="text-slate-800 font-mono">R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                    🔑 Reembolsos Devidos (Inquilinos)
                  </h4>
                  {Object.keys(inquilinosMap).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Nenhum reembolso de material lançado para inquilinos nesta competência.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {Object.entries(inquilinosMap).map(([nome, valor]) => (
                        <div key={nome} className="flex justify-between text-xs border-b border-dashed pb-1">
                          <span className="text-slate-600 font-medium">{nome}</span>
                          <strong className="text-green-600 font-mono">R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                    🏢 Repasses Faturados (Prestadoras PJ)
                  </h4>
                  {Object.keys(prestadorasMap).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Nenhum faturamento de prestadora lançado nesta competência.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {Object.entries(prestadorasMap).map(([nome, valor]) => (
                        <div key={nome} className="flex justify-between text-xs border-b border-dashed pb-1">
                          <span className="text-slate-600 font-medium">{nome}</span>
                          <strong className="text-slate-800 font-mono">R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                    📁 OS's Vinculadas ({chamadosFechados.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto border rounded p-2 bg-slate-50/50 space-y-1.5 text-[10px]">
                    {chamadosFechados.map(c => (
                      <div key={c.id} className="flex justify-between text-slate-500 border-b pb-1 last:border-0 last:pb-0">
                        <span>[{c.imovel?.codigo_imovel}] {c.titulo}</span>
                        <span className="font-semibold text-slate-700 font-mono">
                          {c.orcamentos?.find(o => o.homologado_pela_empresa)?.valor_total_r$?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <div className="border-t border-slate-100 bg-slate-50/50 p-4 flex gap-2 flex-shrink-0">
                <Button
                  onClick={() => setExibirModalDetalhesFechamento(false)}
                  className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-bold"
                >
                  Fechar Extrato
                </Button>
              </div>
            </Card>
          </div>
        )
      })()}
    </div>
  )
}
