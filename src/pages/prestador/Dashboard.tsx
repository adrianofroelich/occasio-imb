import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { comprimirImagemChamado } from "@/lib/compressor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Camera, Wrench, CheckCircle2, Loader2, RefreshCw, HelpCircle, Hammer, AlertCircle,
  User, UserCheck, FileText, Coins, TrendingUp, Calendar, Plus, Printer, MapPin, X
} from "lucide-react"

// Tipagens locais
type StatusChamado = 
  | 'aberto' | 'em_triagem' | 'aguardando_orcamento' | 'orcamento_recebido' 
  | 'analise_proprietario' | 'aguardando_autorizacao' | 'os_liberada' 
  | 'em_execucao' | 'servico_concluido' | 'encerrado' | 'reprovado'

interface Chamado {
  id: string
  titulo: string
  descricao_problema: string
  categoria: string
  disponibilidade_atendimento: string
  status: StatusChamado
  criado_em: string
  data_conclusao?: string | null
  imovel_id: string
  inquilino_id: string
  empresa_prestadora_id?: string | null
  tecnico_id?: string | null
  imovel: {
    codigo_imovel: string
    endereco: string
    bairro: string
    imobiliaria?: {
      id: string
      nome: string
      tipo_repasse?: 'mensal' | 'quinzenal' | 'semanal' | 'por_servico' | null
      prazo_repasse_dias?: number | null
    } | null
  }
  inquilino: {
    nome: string
  }
  tecnico?: {
    id: string
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
  }[]
  chamados_midias?: {
    id: string
    url_storage: string
    tipo_midia: 'antes' | 'depois'
  }[]
  status_financeiro_tecnico?: 'pendente' | 'pago' | null
  fechamento_tecnico_id?: string | null
  devolvido_anteriormente?: boolean
  ultima_devolucao_justificativa?: string | null
  imagens_problema?: string[] | null
  imagens_solucao?: string[] | null
}

// Funções auxiliares para formatação de moeda brasileira (pt-BR)
function formatarMoedaInput(valorStr: string): string {
  const apenasDigitos = valorStr.replace(/\D/g, "")
  if (!apenasDigitos) return ""
  const centavos = parseInt(apenasDigitos, 10)
  const valorDecimal = centavos / 100
  return valorDecimal.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function desformatarMoeda(valorStr: string): number {
  if (!valorStr) return 0
  const limpo = valorStr.replace(/\./g, "").replace(",", ".")
  return parseFloat(limpo) || 0
}

// Calcula a data de repasse com base no tipo de repasse e prazos
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
    // Fechamento da semana é o domingo
    const diaSemana = dataConclusao.getDay()
    const diasAteDomingo = (7 - diaSemana) % 7
    dataRepasse.setDate(dataRepasse.getDate() + diasAteDomingo + prazo)
  } else if (tipo === 'quinzenal') {
    // Fechamento da quinzena: dia 15 ou último dia do mês
    const dia = dataConclusao.getDate()
    if (dia <= 15) {
      dataRepasse = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth(), 15 + prazo)
    } else {
      const ultimoDia = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth() + 1, 0).getDate()
      dataRepasse = new Date(dataConclusao.getFullYear(), dataConclusao.getMonth(), ultimoDia + prazo)
    }
  } else if (tipo === 'mensal') {
    // Dia X do mês seguinte
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

  // Zera as horas para comparação correta
  dataRepasse.setHours(0, 0, 0, 0)
  return dataRepasse
}

// Formata a condição de repasse de forma legível (pt-BR)
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

// Formata uma data no padrão DD/MM/AAAA
function formatarData(data: Date | null): string {
  if (!data) return "-"
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const ano = data.getFullYear()
  return `${dia}/${mes}/${ano}`
}


export default function PrestadorDashboard() {
  const { user, perfil } = useAuth()
  
  // Abas do PWA (orcamentos, os, concluidas, financeiro)
  const [activeTab, setActiveTab] = useState<string>("orcamentos")
  
  // Dados das listas
  const [chamadosPendentes, setChamadosPendentes] = useState<Chamado[]>([])
  const [osAtivas, setOsAtivas] = useState<Chamado[]>([])
  const [osConcluidas, setOsConcluidas] = useState<Chamado[]>([])
  const [financeiroChamados, setFinanceiroChamados] = useState<Chamado[]>([])
  const [empresaMae, setEmpresaMae] = useState<any | null>(null)

  // Estados para Fechamento de Técnicos e Conciliação
  const [subAbaFinanceira, setSubAbaFinanceira] = useState<"pendentes" | "historico">("pendentes")
  const [fechamentosTecnicos, setFechamentosTecnicos] = useState<any[]>([])
  const [carregandoFechamentos, setCarregandoFechamentos] = useState(false)
  const [fechamentoSelecionado, setFechamentoSelecionado] = useState<any | null>(null)
  const [exibirModalNovoFechamento, setExibirModalNovoFechamento] = useState(false)
  const [exibirModalDetalhesFechamento, setExibirModalDetalhesFechamento] = useState(false)
  const [mesFechamento, setMesFechamento] = useState<number>(new Date().getMonth() + 1)
  const [anoFechamento, setAnoFechamento] = useState<number>(new Date().getFullYear())
  const [salvandoFechamento, setSalvandoFechamento] = useState(false)

  // Filtros para OS's Concluídas
  const [filtroMes, setFiltroMes] = useState<string>("")
  const [filtroCategoria, setFiltroCategoria] = useState<string>("")
  
  // Estados para Devolução de OS
  const [chamadoDevolvendo, setChamadoDevolvendo] = useState<Chamado | null>(null)
  const [justificativaDevolucao, setJustificativaDevolucao] = useState("")
  const [devolvendoLoading, setDevolvendoLoading] = useState(false)
  
  // Lista de técnicos da equipe (Empresa PJ)
  const [tecnicosDisponiveis, setTecnicosDisponiveis] = useState<{ id: string; nome: string }[]>([])
  
  // Loading e alertas
  const [loading, setLoading] = useState(true)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Técnico: Formulário de Cotação de Campo
  const [chamadoCotando, setChamadoCotando] = useState<Chamado | null>(null)
  const [valorServico, setValorServico] = useState("")
  const [valorMateriais, setValorMateriais] = useState("")
  const [prazo, setPrazo] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [responsavelMaterialTecnico, setResponsavelMaterialTecnico] = useState<'tecnico' | 'empresa'>("empresa")

  // Empresa PJ: Estados para Delegação
  const [chamadoDelegando, setChamadoDelegando] = useState<Chamado | null>(null)
  const [tecnicoSelecionadoId, setTecnicoSelecionadoId] = useState("")

  // Empresa PJ: Estados para Homologação
  const [chamadoHomologando, setChamadoHomologando] = useState<Chamado | null>(null)
  const [orcamentoHomologando, setOrcamentoHomologando] = useState<any>(null)
  const [homologarValorServico, setHomologarValorServico] = useState("")
  const [homologarValorMateriais, setHomologarValorMateriais] = useState("")
  const [homologarPrazo, setHomologarPrazo] = useState("")
  const [homologarObservacoes, setHomologarObservacoes] = useState("")
  const [homologarResponsavelMaterialEmpresa, setHomologarResponsavelMaterialEmpresa] = useState<'empresa' | 'imobiliaria' | 'proprietario'>("empresa")

  // Técnico: Formulário de Conclusão de OS
  const [chamadoConcluindo, setChamadoConcluindo] = useState<Chamado | null>(null)
  const [relatorio, setRelatorio] = useState("")
  const [imagensDepois, setImagensDepois] = useState<File[]>([])
  const [imagensPreview, setImagensPreview] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para ampliar foto do problema / visualização de mídia
  const [imagemZoom, setImagemZoom] = useState<string | null>(null)

  // Helper para renderizar evidências do chamado de forma consolidada e categorizada
  const renderFotosChamado = (c: Chamado) => {
    const temProblema = (c.imagens_problema && c.imagens_problema.length > 0) || (c.chamados_midias && c.chamados_midias.some(m => m.tipo_midia === 'antes'));
    const temSolucao = (c.imagens_solucao && c.imagens_solucao.length > 0) || (c.chamados_midias && c.chamados_midias.some(m => m.tipo_midia === 'depois'));

    if (!temProblema && !temSolucao) return null;

    return (
      <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-left">
        {temProblema && (
          <div>
            <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Evidências do Problema:</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {c.imagens_problema?.map((url, idx) => (
                <img 
                  key={`prob-${idx}`} 
                  src={url} 
                  alt="Foto do Problema" 
                  onClick={() => setImagemZoom(url)}
                  className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                />
              ))}
              {c.chamados_midias?.filter(m => m.tipo_midia === 'antes' && (!c.imagens_problema || !c.imagens_problema.includes(m.url_storage))).map(midia => (
                <img 
                  key={midia.id} 
                  src={midia.url_storage} 
                  alt="Foto do Problema" 
                  onClick={() => setImagemZoom(midia.url_storage)}
                  className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                />
              ))}
            </div>
          </div>
        )}
        {temSolucao && (
          <div>
            <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Evidências da Solução:</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {c.imagens_solucao?.map((url, idx) => (
                <img 
                  key={`sol-${idx}`} 
                  src={url} 
                  alt="Foto da Solução" 
                  onClick={() => setImagemZoom(url)}
                  className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                />
              ))}
              {c.chamados_midias?.filter(m => m.tipo_midia === 'depois' && (!c.imagens_solucao || !c.imagens_solucao.includes(m.url_storage))).map(midia => (
                <img 
                  key={midia.id} 
                  src={midia.url_storage} 
                  alt="Foto da Solução" 
                  onClick={() => setImagemZoom(midia.url_storage)}
                  className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Verifica se é perfil de Técnico (pertence a uma Empresa Mãe) ou Empresa PJ (é conta-mãe)
  const ehTecnico = !!perfil?.empresa_mae_id

  // Carrega listagens do prestador/empresa
  const loadPrestadorData = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    setErro(null)

    try {
      // 0. Busca as categorias de chamados para mapeamento dinâmico
      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categorias")
        .select("*")
      if (categoriasError) throw categoriasError
      const cats = categoriasData || []

      const mapCategoria = (c: any) => ({
        ...c,
        categoria: cats.find((cat: any) => cat.id === c.categoria)?.nome || c.categoria
      })

      if (ehTecnico) {
        // ================= FLUXO TÉCNICO VINCULADO =================
        // 1. Busca chamados delegados ao técnico específico em status 'aguardando_orcamento'
        // Excluindo os chamados para os quais ele já tenha cadastrado um orçamento preliminar
        const { data: orcamentosJaEnviados } = await supabase
          .from("orcamentos")
          .select("chamado_id")
          .eq("prestador_id", user?.id)

        const idsJaCotados = orcamentosJaEnviados?.map(item => item.chamado_id) || []

        let queryPendentes = supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro, imobiliaria:imobiliaria_id (nome)),
            inquilino:inquilino_id (nome),
            chamados_midias:chamados_midias (*)
          `)
          .eq("tecnico_id", user?.id)
          .eq("status", "aguardando_orcamento")
          .order("criado_em", { ascending: false })

        if (idsJaCotados.length > 0) {
          queryPendentes = queryPendentes.not("id", "in", `(${idsJaCotados.join(",")})`)
        }

        const { data: pendentesData, error: pendentesError } = await queryPendentes
        if (pendentesError) throw pendentesError
        setChamadosPendentes(((pendentesData || []) as any[]).map(mapCategoria) as unknown as Chamado[])

        // 2. Busca OS Ativas delegadas ao técnico ('os_liberada' ou 'em_execucao')
        // 2. Busca OS Ativas delegadas ao técnico ('os_liberada' ou 'em_execucao')
        const { data: osData, error: osError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro, imobiliaria:imobiliaria_id (nome)),
            inquilino:inquilino_id (nome),
            orcamentos (
              id,
              valor_servico_r$,
              valor_materiais_r$,
              valor_servico_tecnico_r$,
              valor_materiais_tecnico_r$,
              responsavel_material_tecnico,
              responsavel_material_empresa,
              prazo_execucao_dias,
              observacoes_tecnicas,
              homologado_pela_empresa,
              prestador_id
            ),
            chamados_midias:chamados_midias (*)
          `)
          .eq("tecnico_id", user?.id)
          .in("status", ["os_liberada", "em_execucao"])
          .order("criado_em", { ascending: false })

        if (osError) throw osError
        setOsAtivas(((osData || []) as any[]).map(mapCategoria) as unknown as Chamado[])

        // 3. Busca dados para o painel financeiro (Técnico PF)
        const { data: finData, error: finError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro, imobiliaria:imobiliaria_id (id, nome, tipo_repasse, prazo_repasse_dias)),
            inquilino:inquilino_id (nome),
            orcamentos (
              id,
              valor_servico_r$,
              valor_materiais_r$,
              valor_servico_tecnico_r$,
              valor_materiais_tecnico_r$,
              responsavel_material_tecnico,
              responsavel_material_empresa,
              homologado_pela_empresa,
              prestador_id
            ),
            chamados_midias:chamados_midias (*)
          `)
          .eq("tecnico_id", user?.id)
          .in("status", ["servico_concluido", "encerrado"])
          .order("criado_em", { ascending: false })

        if (finError) throw finError

        // Filtra para ter apenas chamados que possuem orçamento homologado
        const chamadosComOrcamento = (finData || []).filter((c: any) => 
          c.orcamentos && c.orcamentos.some((o: any) => o.homologado_pela_empresa)
        )
        setFinanceiroChamados(((chamadosComOrcamento || []) as any[]).map(mapCategoria) as unknown as Chamado[])

        // 4. Busca os dados da Empresa Mãe
        if (perfil?.empresa_mae_id) {
          const { data: maeData, error: maeError } = await supabase
            .from("perfis")
            .select("*")
            .eq("id", perfil.empresa_mae_id)
            .single()
          
          if (!maeError && maeData) {
            setEmpresaMae(maeData)
          }
        }

      } else {
        // ================= FLUXO EMPRESA PRESTADORA PJ =================
        // 1. Busca todos os chamados enviados à empresa prestadora PJ em status 'aguardando_orcamento'
        // Trazendo técnicos e orçamentos associados para saber se necessita delegar ou homologar
        const { data: pendentesData, error: pendentesError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro, imobiliaria:imobiliaria_id (nome)),
            inquilino:inquilino_id (nome),
            tecnico:tecnico_id (id, nome),
            orcamentos (
              id,
              valor_servico_r$,
              valor_materiais_r$,
              valor_servico_tecnico_r$,
              valor_materiais_tecnico_r$,
              responsavel_material_tecnico,
              responsavel_material_empresa,
              prazo_execucao_dias,
              observacoes_tecnicas,
              homologado_pela_empresa,
              prestador_id
            ),
            chamados_midias:chamados_midias (*)
          `)
          .eq("empresa_prestadora_id", user?.id)
          .eq("status", "aguardando_orcamento")
          .order("criado_em", { ascending: false })

        if (pendentesError) throw pendentesError
        setChamadosPendentes(((pendentesData || []) as any[]).map(mapCategoria) as unknown as Chamado[])

        // 2. Busca todas as OS ativas de toda a sua equipe técnica
        const { data: osData, error: osError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro, imobiliaria:imobiliaria_id (nome)),
            inquilino:inquilino_id (nome),
            tecnico:tecnico_id (id, nome),
            orcamentos (
              id,
              valor_servico_r$,
              valor_materiais_r$,
              valor_servico_tecnico_r$,
              valor_materiais_tecnico_r$,
              responsavel_material_tecnico,
              responsavel_material_empresa,
              prazo_execucao_dias,
              observacoes_tecnicas,
              homologado_pela_empresa,
              prestador_id
            ),
            chamados_midias:chamados_midias (*)
          `)
          .eq("empresa_prestadora_id", user?.id)
          .in("status", ["os_liberada", "em_execucao"])
          .order("criado_em", { ascending: false })

        if (osError) throw osError
        setOsAtivas(((osData || []) as any[]).map(mapCategoria) as unknown as Chamado[])

        // 3. Busca lista de técnicos vinculados à empresa
        const { data: tecData, error: tecError } = await supabase
          .from("perfis")
          .select("id, nome")
          .eq("empresa_mae_id", user?.id)
          .order("nome")

        if (tecError) throw tecError
        setTecnicosDisponiveis(tecData || [])

        // 4. Busca dados para o painel financeiro (Empresa PJ)
        const { data: finData, error: finError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro, imobiliaria:imobiliaria_id (id, nome, tipo_repasse, prazo_repasse_dias)),
            inquilino:inquilino_id (nome),
            tecnico:tecnico_id (id, nome),
            orcamentos (
              id,
              valor_servico_r$,
              valor_materiais_r$,
              valor_servico_tecnico_r$,
              valor_materiais_tecnico_r$,
              responsavel_material_tecnico,
              responsavel_material_empresa,
              homologado_pela_empresa,
              prestador_id
            ),
            chamados_midias:chamados_midias (*)
          `)
          .eq("empresa_prestadora_id", user?.id)
          .order("criado_em", { ascending: false })

        if (finError) throw finError
        
        // Filtra para ter apenas chamados que possuem orçamento homologado
        const chamadosComOrcamento = (finData || []).filter((c: any) => 
          c.orcamentos && c.orcamentos.some((o: any) => o.homologado_pela_empresa)
        )
        setFinanceiroChamados(((chamadosComOrcamento || []) as any[]).map(mapCategoria) as unknown as Chamado[])

        // Filtra concluídos (servico_concluido ou encerrado) para Empresa PJ
        const concluidos = (finData || []).filter((c: any) => 
          c.status === 'servico_concluido' || c.status === 'encerrado'
        )
        setOsConcluidas(((concluidos || []) as any[]).map(mapCategoria) as unknown as Chamado[])
      }

    } catch (err: any) {
      console.error(err)
      setErro("Falha ao sincronizar dados com o servidor.")
    } finally {
      setLoading(false)
      setRealtimeLoading(false)
    }
  }

  // Carrega os fechamentos de técnicos da prestadora
  const loadFechamentosTecnicos = async () => {
    if (!user) return
    setCarregandoFechamentos(true)
    try {
      const { data, error } = await supabase
        .from("fechamentos_tecnicos")
        .select(`
          *,
          criado_por:criado_por ( nome )
        `)
        .eq("empresa_prestadora_id", user.id)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })

      if (error) throw error
      setFechamentosTecnicos(data || [])
    } catch (err: any) {
      console.error("Erro ao carregar fechamentos de técnicos:", err)
    } finally {
      setCarregandoFechamentos(false)
    }
  }

  // Executa o fechamento mensal da equipe de técnicos
  const handleExecutarFechamentoTecnicos = async () => {
    setSalvandoFechamento(true)
    setErro(null)

    // 1. Filtra chamados elegíveis da equipe de técnicos para a competência
    const chamadosElegiveis = financeiroChamados.filter(c => {
      if (c.status !== 'servico_concluido' && c.status !== 'encerrado') return false
      if (!c.tecnico_id) return false // Sem técnico designado
      if (c.fechamento_tecnico_id) return false // Já fechado
      
      const dataRef = c.data_conclusao ? new Date(c.data_conclusao) : new Date(c.criado_em)
      return dataRef.getMonth() + 1 === mesFechamento && dataRef.getFullYear() === anoFechamento
    })

    if (chamadosElegiveis.length === 0) {
      alert("Nenhum chamado elegível com técnico designado encontrado para esta competência (Mês/Ano).")
      setSalvandoFechamento(false)
      return
    }

    // 2. Calcula os totais devidos aos técnicos
    let totalPago = 0
    chamadosElegiveis.forEach(c => {
      const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
      if (!orc) return
      
      const maoDeObra = Number(orc.valor_servico_tecnico_r$ || 0)
      const reembolso = orc.responsavel_material_tecnico === 'tecnico' ? Number(orc.valor_materiais_tecnico_r$ || 0) : 0
      totalPago += maoDeObra + reembolso
    })

    try {
      // 3. Insere a competência na tabela fechamentos_tecnicos
      const { data: novoFechamento, error: insertError } = await supabase
        .from("fechamentos_tecnicos")
        .insert({
          mes: mesFechamento,
          ano: anoFechamento,
          total_pago_tecnicos: totalPago,
          empresa_prestadora_id: user?.id,
          criado_por: user?.id
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(`A competência ${String(mesFechamento).padStart(2, '0')}/${anoFechamento} já foi fechada anteriormente por esta prestadora!`)
        }
        throw insertError
      }

      // 4. Associa os chamados a esse fechamento e os marca como pagos
      const chamadosIds = chamadosElegiveis.map(c => c.id)
      const { error: updateError } = await supabase
        .from("chamados")
        .update({
          fechamento_tecnico_id: novoFechamento.id,
          status_financeiro_tecnico: 'pago'
        })
        .in("id", chamadosIds)

      if (updateError) throw updateError

      // 5. Registra o histórico para fins de auditoria
      const historicos = chamadosElegiveis.map(c => ({
        chamado_id: c.id,
        usuario_id: user?.id,
        status_anterior: c.status,
        novo_status: c.status,
        observacao: `Fechamento de equipe realizado. Pagamento e reembolso ao técnico conciliado na competência ${String(mesFechamento).padStart(2, '0')}/${anoFechamento}.`
      }))

      const { error: histError } = await supabase
        .from("historico_chamados")
        .insert(historicos)

      if (histError) throw histError

      setExibirModalNovoFechamento(false)
      await loadPrestadorData()
      await loadFechamentosTecnicos()
      alert("Fechamento de técnicos realizado com sucesso!")
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Erro ao executar fechamento financeiro de técnicos.")
    } finally {
      setSalvandoFechamento(false)
    }
  }

  // Configura a assinatura Realtime com o Supabase
  useEffect(() => {
    if (user && perfil) {
      loadPrestadorData()
      loadFechamentosTecnicos()

      // Inicia a escuta em tempo real dos chamados
      const channel = supabase
        .channel("realtime-chamados-prestador")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chamados"
          },
          async (_payload) => {
            await loadPrestadorData(true)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, perfil, ehTecnico])

  // Técnico: Envia orçamento preliminar para a Empresa homologar
  const handleEnviarOrcamentoTecnico = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoCotando) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    const valServico = desformatarMoeda(valorServico)
    const valMateriais = desformatarMoeda(valorMateriais)

    if (valServico <= 0 || !prazo) {
      setErro("Preencha o valor de serviço e o prazo de execução.")
      setSalvando(false)
      return
    }

    try {
      // 1. Cria o registro na tabela orcamentos com homologado_pela_empresa = false
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .insert({
          chamado_id: chamadoCotando.id,
          prestador_id: user?.id,
          valor_servico_tecnico_r$: valServico,
          valor_materiais_tecnico_r$: valMateriais,
          responsavel_material_tecnico: responsavelMaterialTecnico,
          // Valores iniciais iguais aos do técnico para manter coerência
          valor_servico_r$: valServico,
          valor_materiais_r$: valMateriais,
          prazo_execucao_dias: parseInt(prazo),
          observacoes_tecnicas: observacoes,
          homologado_pela_empresa: false
        })

      if (orcamentoError) throw orcamentoError

      // 2. Insere histórico de cotação realizada sem mudar o status do chamado
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoCotando.id,
        usuario_id: user?.id,
        status_anterior: "aguardando_orcamento" as StatusChamado,
        novo_status: "aguardando_orcamento" as StatusChamado,
        observacao: `Orçamento preliminar de R$ ${(valServico + valMateriais).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} inserido pelo técnico de campo ${perfil?.nome}. Aguardando homologação interna.`
      })

      setSucesso("Orçamento enviado para a homologação da sua Empresa Prestadora com sucesso!")
      setChamadoCotando(null)
      setValorServico("")
      setValorMateriais("")
      setResponsavelMaterialTecnico("empresa")
      setPrazo("")
      setObservacoes("")

      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar enviar proposta técnica.")
    } finally {
      setSalvando(false)
    }
  }

  // Empresa PJ: Delega o chamado para um técnico vinculado
  const handleDelegarChamado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoDelegando || !tecnicoSelecionadoId) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      // 1. Atualiza o tecnico_id no chamado
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ tecnico_id: tecnicoSelecionadoId })
        .eq("id", chamadoDelegando.id)

      if (chamadoError) throw chamadoError

      const tecNome = tecnicosDisponiveis.find(t => t.id === tecnicoSelecionadoId)?.nome || "Técnico"

      // 2. Insere histórico de delegação
      const isExecucao = chamadoDelegando.status === 'os_liberada' || chamadoDelegando.status === 'em_execucao'
      const obsTexto = isExecucao 
        ? `Chamado designado ao técnico ${tecNome} para execução do serviço.`
        : `Chamado designado ao técnico ${tecNome} para realização de vistoria e cotação.`

      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoDelegando.id,
        usuario_id: user?.id,
        status_anterior: chamadoDelegando.status,
        novo_status: chamadoDelegando.status,
        observacao: obsTexto
      })

      setSucesso(`Chamado delegado com sucesso para o técnico ${tecNome}!`)
      setChamadoDelegando(null)
      setTecnicoSelecionadoId("")

      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar delegar chamado.")
    } finally {
      setSalvando(false)
    }
  }

  // Técnico PF: Devolve a OS designada a ele por algum imprevisto
  const handleDevolverOS = async () => {
    if (!chamadoDevolvendo) return
    if (justificativaDevolucao.trim().length < 10) {
      setErro("A justificativa deve conter no mínimo 10 caracteres.")
      return
    }

    setDevolvendoLoading(true)
    setErro(null)
    setSucesso(null)

    try {
      const { error } = await supabase.rpc("devolver_chamado", {
        p_chamado_id: chamadoDevolvendo.id,
        p_justificativa: justificativaDevolucao.trim()
      })

      if (error) throw error

      setSucesso("Ordem de Serviço devolvida com sucesso!")
      setChamadoDevolvendo(null)
      setJustificativaDevolucao("")
      
      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar devolver a O.S.")
    } finally {
      setDevolvendoLoading(false)
    }
  }

  // Empresa PJ: Abre painel para homologar e editar o orçamento do técnico
  const iniciarHomologacao = (chamado: Chamado, orcamento: any) => {
    setChamadoHomologando(chamado)
    setOrcamentoHomologando(orcamento)
    setHomologarValorServico(orcamento.valor_servico_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 }))
    setHomologarValorMateriais(orcamento.valor_materiais_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 }))
    setHomologarPrazo(String(orcamento.prazo_execucao_dias))
    setHomologarObservacoes(orcamento.observacoes_tecnicas || "")
    setHomologarResponsavelMaterialEmpresa(orcamento.responsavel_material_empresa || "empresa")
  }

  // Empresa PJ: Homologa proposta e envia definitivamente para a Imobiliária
  const handleHomologarOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoHomologando || !orcamentoHomologando) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    const valServico = desformatarMoeda(homologarValorServico)
    const valMateriais = desformatarMoeda(homologarValorMateriais)

    if (valServico <= 0 || !homologarPrazo) {
      setErro("Preencha o valor de serviço e o prazo de execução para homologar.")
      setSalvando(false)
      return
    }

    try {
      // 1. Atualiza o orçamento com valores homologados e marca homologado_pela_empresa = true
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({
          valor_servico_r$: valServico,
          valor_materiais_r$: valMateriais,
          responsavel_material_empresa: homologarResponsavelMaterialEmpresa,
          prazo_execucao_dias: parseInt(homologarPrazo),
          observacoes_tecnicas: homologarObservacoes,
          homologado_pela_empresa: true
        })
        .eq("id", orcamentoHomologando.id)

      if (orcamentoError) throw orcamentoError

      // 2. Atualiza status do chamado correspondente para 'orcamento_recebido' (visível para imobiliária)
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "orcamento_recebido" })
        .eq("id", chamadoHomologando.id)

      if (chamadoError) throw chamadoError

      const totalHomologado = valServico + valMateriais

      // 3. Insere registro de alteração de status no histórico
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoHomologando.id,
        usuario_id: user?.id,
        status_anterior: "aguardando_orcamento" as StatusChamado,
        novo_status: "orcamento_recebido" as StatusChamado,
        observacao: `Proposta técnica homologada pela Empresa PJ. Valor Total: R$ ${totalHomologado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Enviado para a Imobiliária.`
      })

      setSucesso("Orçamento homologado e submetido para a Imobiliária!")
      setChamadoHomologando(null)
      setOrcamentoHomologando(null)
      setHomologarValorServico("")
      setHomologarValorMateriais("")
      setHomologarResponsavelMaterialEmpresa("empresa")
      setHomologarPrazo("")
      setHomologarObservacoes("")

      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar homologar orçamento.")
    } finally {
      setSalvando(false)
    }
  }

  // Técnico: Altera status da OS de os_liberada para em_execucao
  const handleIniciarServico = async (chamado: Chamado) => {
    setErro(null)
    setSucesso(null)

    try {
      const { error } = await supabase
        .from("chamados")
        .update({ status: "em_execucao" })
        .eq("id", chamado.id)

      if (error) throw error

      await supabase.from("historico_chamados").insert({
        chamado_id: chamado.id,
        usuario_id: user?.id,
        status_anterior: "os_liberada" as StatusChamado,
        novo_status: "em_execucao" as StatusChamado,
        observacao: `Execução do serviço iniciada no local pelo técnico ${perfil?.nome}.`
      })

      setSucesso("Ordem de serviço iniciada! Bom trabalho.")
      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro("Falha ao atualizar status da O.S.")
    }
  }

  // Técnico: Trata seleção de imagem da conclusão e roda o compressor Canvas com limite de 3
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = e.target.files
    if (!arquivos || arquivos.length === 0) return

    const arrayArquivos = Array.from(arquivos)

    if (imagensDepois.length + arrayArquivos.length > 3) {
      setErro("Erro: Limite estrito de até 3 imagens por conclusão.")
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
        // Compressor preventivo via Canvas se passar de 2MB (max 1200px)
        const comprimido = await comprimirImagemChamado(arq)
        arquivosComprimidos.push(comprimido)
        previews.push(URL.createObjectURL(comprimido))
      }

      setImagensDepois(prev => [...prev, ...arquivosComprimidos])
      setImagensPreview(prev => [...prev, ...previews])
    } catch (err: any) {
      console.error(err)
      setErro("Erro ao processar imagem final do serviço.")
    }
  }

  const removerImagemDepois = (index: number) => {
    setImagensDepois(prev => prev.filter((_, i) => i !== index))
    setImagensPreview(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  // Técnico: Envia a conclusão de serviço (em_execucao -> servico_concluido)
  const handleConcluirServico = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoConcluindo) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    if (!relatorio || imagensDepois.length === 0) {
      setErro("É necessário preencher o relatório final e anexar pelo menos 1 foto da conclusão do serviço (máx 3).")
      setSalvando(false)
      return
    }

    try {
      // 1. Upload das imagens comprimidas "depois" para o Storage
      const urlsImagens: string[] = []
      for (let i = 0; i < imagensDepois.length; i++) {
        const img = imagensDepois[i]
        const extensao = img.type.split("/")[1] || "jpg"
        const caminho = `${chamadoConcluindo.id}/solucao/img_${i}_${Date.now()}.${extensao}`

        const { error: uploadError } = await supabase.storage
          .from("chamados")
          .upload(caminho, img)

        if (uploadError) throw uploadError

        // Busca URL pública do arquivo enviado
        const { data: urlData } = supabase.storage
          .from("chamados")
          .getPublicUrl(caminho)

        urlsImagens.push(urlData.publicUrl)
      }

      // Salva o array de URLs na coluna imagens_solucao
      const { error: updateChamadoImgError } = await supabase
        .from("chamados")
        .update({ imagens_solucao: urlsImagens })
        .eq("id", chamadoConcluindo.id)

      if (updateChamadoImgError) throw updateChamadoImgError

      // 2. Atualiza o orçamento correspondente com o relatório técnico de conclusão
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({
          relatorio_conclusao: relatorio,
          data_agendamento_servico: new Date().toISOString()
        })
        .eq("chamado_id", chamadoConcluindo.id)

      if (orcamentoError) throw orcamentoError

      // 3. Atualiza status do chamado para 'servico_concluido'
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "servico_concluido" })
        .eq("id", chamadoConcluindo.id)

      if (chamadoError) throw chamadoError

      // 4. Histórico
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoConcluindo.id,
        usuario_id: user?.id,
        status_anterior: "em_execucao" as StatusChamado,
        novo_status: "servico_concluido" as StatusChamado,
        observacao: `Execução finalizada pelo técnico ${perfil?.nome}. Relatório e fotos comprobatórias enviados.`
      })

      setSucesso("Serviço concluído com sucesso! Aguardando homologação da imobiliária.")
      setChamadoConcluindo(null)
      setRelatorio("")
      setImagensDepois([])
      setImagensPreview([])
      if (fileInputRef.current) fileInputRef.current.value = ""

      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar concluir ordem de serviço.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md md:max-w-xl bg-slate-50 min-h-screen pb-20">
      
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {!ehTecnico && (
            perfil?.logo_url ? (
              <img 
                src={perfil.logo_url} 
                alt={perfil.nome} 
                className="h-12 max-h-12 w-auto object-contain rounded border border-slate-200 bg-white p-1" 
              />
            ) : (
              <div className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400">
                <Hammer className="h-6 w-6" />
              </div>
            )
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-occasio-navy flex items-center gap-2">
              {ehTecnico && <Hammer className="h-5 w-5 text-occasio-blue" />}
              {ehTecnico ? "PWA do Técnico" : (perfil?.nome || "Painel do Prestador (PJ)")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {ehTecnico 
                ? "Orçamentos de campo e ordens de serviço delegadas." 
                : "Gestão comercial, delegação técnica e homologação."}
            </p>
          </div>
        </div>
        {realtimeLoading && (
          <span className="text-xs text-occasio-blue flex items-center gap-1 font-semibold animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" /> Sinc.
          </span>
        )}
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="font-bold text-red-800">Erro</AlertTitle>
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="font-semibold text-green-800">Sucesso!</AlertTitle>
          <AlertDescription className="font-semibold">{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Abas PWA */}
      <div className={`grid ${ehTecnico ? "grid-cols-3" : "grid-cols-4"} gap-2 bg-slate-200/60 p-1.5 rounded-lg mb-6`}>
        <button
          onClick={() => { 
            setActiveTab("orcamentos")
            setChamadoCotando(null)
            setChamadoConcluindo(null)
            setChamadoDelegando(null)
            setChamadoHomologando(null)
          }}
          className={`py-2 text-[11px] md:text-xs font-bold rounded-md transition-all ${
            activeTab === "orcamentos" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Orçamentos ({chamadosPendentes.length})
        </button>
        <button
          onClick={() => { 
            setActiveTab("os")
            setChamadoCotando(null)
            setChamadoConcluindo(null)
            setChamadoDelegando(null)
            setChamadoHomologando(null)
          }}
          className={`py-2 text-[11px] md:text-xs font-bold rounded-md transition-all ${
            activeTab === "os" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          OS Ativas ({osAtivas.length})
        </button>
        {!ehTecnico && (
          <button
            onClick={() => { 
              setActiveTab("concluidas")
              setChamadoCotando(null)
              setChamadoConcluindo(null)
              setChamadoDelegando(null)
              setChamadoHomologando(null)
            }}
            className={`py-2 text-[11px] md:text-xs font-bold rounded-md transition-all ${
              activeTab === "concluidas" 
                ? "bg-white text-occasio-navy shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            OS's Concluídas ({osConcluidas.length})
          </button>
        )}
        <button
          onClick={() => { 
            setActiveTab("financeiro")
            setChamadoCotando(null)
            setChamadoConcluindo(null)
            setChamadoDelegando(null)
            setChamadoHomologando(null)
          }}
          className={`py-2 text-[11px] md:text-xs font-bold rounded-md transition-all ${
            activeTab === "financeiro" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Financeiro
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
          <span>Buscando dados no servidor...</span>
        </div>
      ) : (
        <>
          {/* ======================== ABA 1: ORÇAMENTOS PENDENTES ======================== */}
          {activeTab === "orcamentos" && !chamadoCotando && !chamadoDelegando && !chamadoHomologando && (
            <div className="space-y-4">
              {chamadosPendentes.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-3">
                  <HelpCircle className="h-10 w-10 text-slate-300" />
                  <div className="font-semibold text-slate-500">Nenhum chamado pendente</div>
                  <p className="max-w-xs mx-auto text-[11px] text-slate-400">
                    {ehTecnico 
                      ? "Você não possui vistorias ou cotações delegadas no momento."
                      : "Aguarde a imobiliária disparar novos chamados comerciais para a sua empresa."}
                  </p>
                </div>
              ) : (
                chamadosPendentes.map((chamado) => {
                  const orcPendente = chamado.orcamentos?.find(o => !o.homologado_pela_empresa)
                  const jaEnviouProposta = !!orcPendente

                  return (
                    <Card key={chamado.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all bg-white">
                      <CardContent className="p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                {chamado.imovel?.codigo_imovel || "Sem Código"}
                              </span>
                              {chamado.imovel?.imobiliaria?.nome && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                  {chamado.imovel.imobiliaria.nome}
                                </span>
                              )}
                            </div>
                            <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                          </div>
                          
                          {/* Badge de status interno no marketplace */}
                          {ehTecnico ? (
                            <Badge className="bg-yellow-50 text-yellow-800 border-yellow-200 border text-[9px] font-bold">
                              Cotar Serviço
                            </Badge>
                          ) : !chamado.tecnico_id ? (
                            <Badge className="bg-red-50 text-red-800 border-red-200 border text-[9px] font-bold uppercase animate-pulse">
                              Aguardando Técnico
                            </Badge>
                          ) : jaEnviouProposta ? (
                            <Badge className="bg-orange-50 text-orange-800 border-orange-200 border text-[9px] font-bold uppercase animate-pulse">
                              Homologar
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-50 text-slate-600 border-slate-200 border text-[9px] font-bold uppercase">
                              Aguardando Cotação
                            </Badge>
                          )}
                        </div>

                        {/* Bloco de Agendamento e Endereço destacado para programação */}
                        <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg space-y-2 text-xs">
                          <div className="flex items-start gap-2 text-amber-950">
                            <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="block font-bold text-[10px] uppercase tracking-wider text-amber-800">Dia/Horário para Atendimento (Inquilino)</span>
                              <strong className="text-xs font-black text-amber-950 block mt-0.5">
                                {chamado.disponibilidade_atendimento || "Não informado"}
                              </strong>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-slate-700 pt-1.5 border-t border-amber-200/50">
                            <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="block font-bold text-[10px] uppercase tracking-wider text-slate-500">Endereço de Visita</span>
                              <strong className="text-xs text-slate-800 block mt-0.5">
                                {chamado.imovel?.endereco || "Não disponível"} {chamado.imovel?.bairro ? `(${chamado.imovel.bairro})` : ""}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Alerta de OS Devolvida Anteriormente */}
                        {chamado.devolvido_anteriormente && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-950 text-[11px] p-2.5 rounded-lg flex items-start gap-2 shadow-sm">
                            <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-amber-800 block text-[10px] uppercase tracking-wider">OS Devolvida Anteriormente</span>
                              {chamado.ultima_devolucao_justificativa && (
                                <p className="text-[11px] text-amber-700 mt-1 italic leading-snug font-medium">
                                  "{chamado.ultima_devolucao_justificativa}"
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="text-slate-500 line-clamp-2 leading-relaxed">{chamado.descricao_problema}</p>
                        
                        {renderFotosChamado(chamado)}
                        
                        {((!ehTecnico && chamado.tecnico) || (!ehTecnico && jaEnviouProposta)) && (
                          <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] text-slate-600">
                            {!ehTecnico && chamado.tecnico && (
                              <div><strong>Técnico designado:</strong> <strong className="text-slate-800">{chamado.tecnico.nome}</strong></div>
                            )}
                            {!ehTecnico && jaEnviouProposta && (
                              <div className="bg-orange-50/50 border border-orange-100 p-2 rounded mt-1 text-orange-950">
                                <span className="block font-bold text-[10px] uppercase text-orange-800 mb-0.5">Valores inseridos pelo técnico:</span>
                                Mão de Obra: R$ {orcPendente.valor_servico_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<br/>
                                Materiais: R$ {orcPendente.valor_materiais_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<br/>
                                Prazo: {orcPendente.prazo_execucao_dias} dias
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                          {ehTecnico ? (
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => {
                                  setChamadoDevolvendo(chamado)
                                  setJustificativaDevolucao("")
                                  setErro(null)
                                }} 
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold h-7 text-[10px] px-3"
                              >
                                Devolver OS
                              </Button>
                              <Button 
                                onClick={() => setChamadoCotando(chamado)} 
                                size="sm" 
                                className="bg-occasio-blue hover:bg-occasio-navy text-white text-[10px] px-3 h-7 font-bold"
                              >
                                Enviar Orçamento
                              </Button>
                            </div>
                          ) : !chamado.tecnico_id ? (
                            <Button 
                              onClick={() => {
                                setChamadoDelegando(chamado)
                                setTecnicoSelecionadoId("")
                              }} 
                              size="sm" 
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-3 h-7 font-bold flex items-center gap-1"
                            >
                              <UserCheck className="h-3.5 w-3.5" /> Designar Técnico
                            </Button>
                          ) : jaEnviouProposta ? (
                            <Button 
                              onClick={() => iniciarHomologacao(chamado, orcPendente)} 
                              size="sm" 
                              className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] px-3 h-7 font-bold flex items-center gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" /> Revisar &amp; Homologar
                            </Button>
                          ) : (
                            <Button 
                              onClick={() => {
                                setChamadoDelegando(chamado)
                                setTecnicoSelecionadoId(chamado.tecnico?.id || "")
                              }}
                              variant="outline"
                              size="sm" 
                              className="text-slate-600 hover:bg-slate-50 text-[10px] px-3 h-7 font-bold border-slate-200"
                            >
                              Re-designar Técnico
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* ======================== TÉCNICO: FORMULÁRIO DE ENVIO DE ORÇAMENTO ======================== */}
          {activeTab === "orcamentos" && chamadoCotando && (
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy">Cotação de Campo (Técnico)</CardTitle>
                <CardDescription className="text-xs">Para: {chamadoCotando.titulo}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleEnviarOrcamentoTecnico} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded border text-xs text-slate-600 mb-2">
                    <strong>Descrição do Problema:</strong>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed bg-white border p-2 rounded">{chamadoCotando.descricao_problema}</p>
                    
                    {renderFotosChamado(chamadoCotando)}
                    
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-900">
                      <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-0.5">
                        Horário de Visitação Preferencial:
                      </span>
                      <strong className="text-sm font-extrabold text-amber-950 block">
                        {chamadoCotando.disponibilidade_atendimento}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Mão de Obra *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold select-none">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                          value={valorServico}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorServico(formatarMoedaInput(e.target.value))}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Materiais
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold select-none">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                          value={valorMateriais}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorMateriais(formatarMoedaInput(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Quem pagará/providenciará os materiais? *
                    </label>
                    <select
                      value={responsavelMaterialTecnico}
                      onChange={(e) => setResponsavelMaterialTecnico(e.target.value as 'tecnico' | 'empresa')}
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue mb-1"
                    >
                      <option value="empresa">Prestador (Empresa PJ paga/fornece os materiais)</option>
                      <option value="tecnico">Técnico (Eu pago/providencio os materiais)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Prazo de Execução (em dias) *
                    </label>
                    <Input
                      type="number"
                      placeholder="Ex: 3"
                      value={prazo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrazo(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Observações Técnicas de Campo
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Descreva as particularidades e as necessidades constatadas na vistoria local."
                      value={observacoes}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservacoes(e.target.value)}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setChamadoCotando(null)}>
                      Voltar
                    </Button>
                    <Button disabled={salvando} size="sm" type="submit" className="bg-occasio-blue hover:bg-occasio-navy text-white font-semibold">
                      {salvando ? "Enviando..." : "Enviar Orçamento"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ======================== EMPRESA PJ: FORMULÁRIO DE DELEGAÇÃO ======================== */}
          {chamadoDelegando && (
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-occasio-blue" />
                  Designar Técnico de Campo
                </CardTitle>
                <CardDescription className="text-xs">Para: {chamadoDelegando.titulo}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleDelegarChamado} className="space-y-4">
                  {/* Bloco de Destaque do Horário para Atendimento */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900 shadow-sm">
                    <Calendar className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-bold text-[10px] uppercase tracking-wider text-amber-800">Dia/Horário para Atendimento (Inquilino)</span>
                      <strong className="text-xs font-black leading-tight block mt-1">
                        {chamadoDelegando.disponibilidade_atendimento || "Não informado"}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border text-xs text-slate-600 mb-2 space-y-2">
                    <div>
                      <strong>Descrição do Problema:</strong>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed bg-white border p-2 rounded">{chamadoDelegando.descricao_problema}</p>
                    </div>

                    {renderFotosChamado(chamadoDelegando)}

                    <div>
                      <strong>Localização &amp; Horário:</strong>
                      <p className="mt-1 leading-relaxed">
                        Endereço: <strong>{chamadoDelegando.imovel.endereco}</strong><br/>
                        Preferência: <strong className="text-amber-700 font-extrabold">{chamadoDelegando.disponibilidade_atendimento}</strong>
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Selecione um Técnico do Time *
                    </label>
                    {tecnicosDisponiveis.length === 0 ? (
                      <div className="text-[11px] text-red-500 font-semibold p-2 bg-red-50 border border-red-100 rounded">
                        Você não possui técnicos cadastrados em sua equipe! Cadastre-os na tela de equipe.
                      </div>
                    ) : (
                      <select
                        value={tecnicoSelecionadoId}
                        onChange={(e) => setTecnicoSelecionadoId(e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                      >
                        <option value="">Selecione um técnico...</option>
                        {tecnicosDisponiveis.map((tec) => (
                          <option key={tec.id} value={tec.id}>{tec.nome}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setChamadoDelegando(null)}>
                      Cancelar
                    </Button>
                    <Button 
                      disabled={salvando || !tecnicoSelecionadoId} 
                      size="sm" 
                      type="submit" 
                      className="bg-occasio-blue hover:bg-occasio-navy text-white font-semibold"
                    >
                      {salvando ? "Deleganado..." : "Delegar OS"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ======================== EMPRESA PJ: FORMULÁRIO DE HOMOLOGAÇÃO ======================== */}
          {activeTab === "orcamentos" && chamadoHomologando && (
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-orange-600" />
                  Revisar Orçamento &amp; Definir Valores para a Imobiliária
                </CardTitle>
                <CardDescription className="text-xs">Para: {chamadoHomologando.titulo}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleHomologarOrcamento} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded border text-xs text-slate-600 mb-2 space-y-2">
                    <div>
                      <strong>Descrição do Problema:</strong>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed bg-white border p-2 rounded">{chamadoHomologando.descricao_problema}</p>
                    </div>

                    {renderFotosChamado(chamadoHomologando)}

                    <div className="text-[11px] leading-relaxed pt-2 border-t border-slate-200">
                      <strong>Dados Originais do Técnico:</strong><br/>
                      Mão de Obra Original: R$ {(orcamentoHomologando.valor_servico_tecnico_r$ || orcamentoHomologando.valor_servico_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<br/>
                      Materiais Original: R$ {(orcamentoHomologando.valor_materiais_tecnico_r$ || orcamentoHomologando.valor_materiais_r$).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<br/>
                      Responsável Material: <span className="font-semibold text-slate-800">{orcamentoHomologando.responsavel_material_tecnico === 'tecnico' ? "Técnico (PF)" : "Empresa (PJ)"}</span><br/>
                      Observações de Campo: <span className="italic">&ldquo;{orcamentoHomologando.observacoes_tecnicas || "Nenhuma"}&rdquo;</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Mão de Obra para a Imobiliária *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold select-none">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                          value={homologarValorServico}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHomologarValorServico(formatarMoedaInput(e.target.value))}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Materiais para a Imobiliária
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold select-none">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          className="pl-9 pr-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                          value={homologarValorMateriais}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHomologarValorMateriais(formatarMoedaInput(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Material indicado pelo Técnico
                      </label>
                      <div className="h-9 px-3 border border-slate-100 rounded-md bg-slate-50 flex items-center text-xs font-bold text-slate-700 select-none">
                        {orcamentoHomologando.responsavel_material_tecnico === 'tecnico' ? "Técnico paga" : "Empresa PJ paga"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Faturar Materiais para *
                      </label>
                      <select
                        value={homologarResponsavelMaterialEmpresa}
                        onChange={(e) => setHomologarResponsavelMaterialEmpresa(e.target.value as 'empresa' | 'imobiliaria' | 'proprietario')}
                        className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                      >
                        <option value="empresa">Empresa PJ (Nós assumimos/pagamos)</option>
                        <option value="imobiliaria">Imobiliária</option>
                        <option value="proprietario">Proprietário do Imóvel</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Prazo de Execução para a Imobiliária (em dias) *
                    </label>
                    <Input
                      type="number"
                      placeholder="Ex: 3"
                      value={homologarPrazo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHomologarPrazo(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Observações Finais para a Imobiliária
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Valores revisados pela gerência. Adicionada garantia estendida de 90 dias."
                      value={homologarObservacoes}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHomologarObservacoes(e.target.value)}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setChamadoHomologando(null)}>
                      Voltar
                    </Button>
                    <Button disabled={salvando} size="sm" type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold flex items-center gap-1">
                      Homologar &amp; Enviar Proposta
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ======================== ABA 2: OS ATIVAS ======================== */}
          {activeTab === "os" && !chamadoConcluindo && !chamadoDelegando && (
            <div className="space-y-4">
              {osAtivas.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-3">
                  <Wrench className="h-10 w-10 text-slate-300" />
                  <div className="font-semibold text-slate-500">Nenhuma OS em andamento</div>
                  <p className="max-w-xs mx-auto text-[11px] text-slate-400">
                    {ehTecnico 
                      ? "Você não possui ordens de serviço ativas sob sua execução."
                      : "Sua equipe não possui ordens de serviço ativas no momento."}
                  </p>
                </div>
              ) : (
                (() => {
                  // Se for técnico, exibe listagem simples com as ações
                  if (ehTecnico) {
                    return (
                      <div className="space-y-4">
                        {osAtivas.map((chamado) => (
                          <Card key={chamado.id} className="border-slate-200 shadow-sm bg-white">
                            <CardContent className="p-4 space-y-3 text-xs">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                      {chamado.imovel?.codigo_imovel || "Sem Código"}
                                    </span>
                                    {chamado.imovel?.imobiliaria?.nome && (
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                        {chamado.imovel.imobiliaria.nome}
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                                </div>
                                <Badge className={`${
                                  chamado.status === 'os_liberada' 
                                    ? "bg-teal-50 text-teal-800 border-teal-200" 
                                    : "bg-orange-50 text-orange-800 border-orange-200"
                                } border text-[9px] font-bold uppercase`}>
                                  {chamado.status === 'os_liberada' ? "Liberada" : "Em Execução"}
                                </Badge>
                              </div>

                              {/* Bloco de Agendamento e Endereço destacado para programação */}
                              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg space-y-2 text-xs">
                                <div className="flex items-start gap-2 text-amber-950">
                                  <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="block font-bold text-[10px] uppercase tracking-wider text-amber-800">Dia/Horário para Atendimento (Inquilino)</span>
                                    <strong className="text-xs font-black text-amber-950 block mt-0.5">
                                      {chamado.disponibilidade_atendimento || "Não informado"}
                                    </strong>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2 text-slate-700 pt-1.5 border-t border-amber-200/50">
                                  <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="block font-bold text-[10px] uppercase tracking-wider text-slate-500">Endereço de Visita</span>
                                    <strong className="text-xs text-slate-800 block mt-0.5">
                                      {chamado.imovel?.endereco || "Não disponível"} {chamado.imovel?.bairro ? `(${chamado.imovel.bairro})` : ""}
                                    </strong>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                                <div><strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}</div>
                              </div>

                              {renderFotosChamado(chamado)}

                              <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                                <Button 
                                  onClick={() => {
                                    setChamadoDevolvendo(chamado)
                                    setJustificativaDevolucao("")
                                    setErro(null)
                                  }} 
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold h-8 text-[11px]"
                                >
                                  Devolver OS
                                </Button>
                                {chamado.status === 'os_liberada' ? (
                                  <Button 
                                    onClick={() => handleIniciarServico(chamado)} 
                                    size="sm" 
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold h-8 text-[11px]"
                                  >
                                    Iniciar Execução
                                  </Button>
                                ) : (
                                  <Button 
                                    onClick={() => setChamadoConcluindo(chamado)} 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold h-8 text-[11px]"
                                  >
                                    Concluir Conserto
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )
                  }

                  // Se for gestor/dono PJ, exibe em sub-seções estruturadas para rastreamento
                  const osLiberadas = osAtivas.filter(c => c.status === 'os_liberada')
                  const osEmExecucao = osAtivas.filter(c => c.status === 'em_execucao')

                  return (
                    <div className="space-y-6">
                      {/* 1. OS Designadas (Aguardando Início do Técnico) */}
                      {osLiberadas.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pl-1">
                            <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
                            Aguardando Início do Técnico ({osLiberadas.length})
                          </h4>
                          <div className="space-y-4">
                            {osLiberadas.map((chamado) => (
                              <Card key={chamado.id} className="border-slate-200 shadow-sm bg-white border-l-4 border-l-teal-500">
                                <CardContent className="p-4 space-y-3 text-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                          {chamado.imovel?.codigo_imovel || "Sem Código"}
                                        </span>
                                        {chamado.imovel?.imobiliaria?.nome && (
                                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                            {chamado.imovel.imobiliaria.nome}
                                          </span>
                                        )}
                                      </div>
                                      <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                                    </div>
                                    <Badge className="bg-teal-50 text-teal-800 border-teal-200 border text-[9px] font-bold uppercase">
                                      Liberada
                                    </Badge>
                                  </div>

                                  {/* Bloco de Agendamento e Endereço destacado para programação */}
                                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg space-y-2 text-xs">
                                    <div className="flex items-start gap-2 text-amber-950">
                                      <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="block font-bold text-[10px] uppercase tracking-wider text-amber-800">Dia/Horário para Atendimento (Inquilino)</span>
                                        <strong className="text-xs font-black text-amber-950 block mt-0.5">
                                          {chamado.disponibilidade_atendimento || "Não informado"}
                                        </strong>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2 text-slate-700 pt-1.5 border-t border-amber-200/50">
                                      <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="block font-bold text-[10px] uppercase tracking-wider text-slate-500">Endereço de Visita</span>
                                        <strong className="text-xs text-slate-800 block mt-0.5">
                                          {chamado.imovel?.endereco || "Não disponível"} {chamado.imovel?.bairro ? `(${chamado.imovel.bairro})` : ""}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Alerta de OS Devolvida Anteriormente */}
                                  {chamado.devolvido_anteriormente && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-950 text-[11px] p-2.5 rounded-lg flex items-start gap-2 shadow-sm mb-2">
                                      <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold text-amber-800 block text-[10px] uppercase tracking-wider">OS Devolvida Anteriormente</span>
                                        {chamado.ultima_devolucao_justificativa && (
                                          <p className="text-[11px] text-amber-700 mt-1 italic leading-snug font-medium">
                                            "{chamado.ultima_devolucao_justificativa}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                                    <div><strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}</div>
                                    {chamado.tecnico && (
                                      <div className="pt-1 border-t border-slate-200 mt-1 flex items-center gap-1 text-slate-700">
                                        <User className="h-3 w-3 text-slate-400" />
                                        Técnico Responsável: <strong className="text-slate-800">{chamado.tecnico.nome}</strong>
                                      </div>
                                    )}
                                  </div>

                                  {!chamado.tecnico_id && (
                                    <div className="bg-red-50 border border-red-200 text-red-955 text-[11px] p-2.5 rounded-lg flex items-start gap-2 mt-2 shadow-sm">
                                      <AlertCircle className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
                                      <div>
                                        <strong className="text-red-800 block text-[10px] uppercase tracking-wider">Atenção: OS Sem Técnico Responsável!</strong>
                                        <p className="text-[10px] text-red-700 mt-0.5">Esta OS precisa ser designada a um técnico para ser iniciada no campo.</p>
                                      </div>
                                    </div>
                                  )}

                                  {renderFotosChamado(chamado)}

                                  {!chamado.tecnico_id ? (
                                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5 mt-2">
                                      <Button 
                                        onClick={() => {
                                          setChamadoDelegando(chamado)
                                          setTecnicoSelecionadoId("")
                                        }} 
                                        size="sm" 
                                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-3 h-7 font-bold flex items-center gap-1"
                                      >
                                        <UserCheck className="h-3.5 w-3.5" /> Designar Técnico
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="bg-teal-50/50 border border-teal-100 text-teal-800 text-[10px] p-2 rounded font-semibold mt-1">
                                      A OS foi enviada e recebida no PWA do Técnico {chamado.tecnico?.nome || "designado"}. Aguardando o início do serviço no local.
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. OS Em Execução */}
                      {osEmExecucao.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pl-1">
                            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                            Em Execução no Local ({osEmExecucao.length})
                          </h4>
                          <div className="space-y-4">
                            {osEmExecucao.map((chamado) => (
                              <Card key={chamado.id} className="border-slate-200 shadow-sm bg-white border-l-4 border-l-orange-500">
                                <CardContent className="p-4 space-y-3 text-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                          {chamado.imovel?.codigo_imovel || "Sem Código"}
                                        </span>
                                        {chamado.imovel?.imobiliaria?.nome && (
                                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                            {chamado.imovel.imobiliaria.nome}
                                          </span>
                                        )}
                                      </div>
                                      <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                                    </div>
                                    <Badge className="bg-orange-50 text-orange-800 border-orange-200 border text-[9px] font-bold uppercase">
                                      Em Execução
                                    </Badge>
                                  </div>

                                  {/* Bloco de Agendamento e Endereço destacado para programação */}
                                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg space-y-2 text-xs">
                                    <div className="flex items-start gap-2 text-amber-950">
                                      <Calendar className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="block font-bold text-[10px] uppercase tracking-wider text-amber-800">Dia/Horário para Atendimento (Inquilino)</span>
                                        <strong className="text-xs font-black text-amber-950 block mt-0.5">
                                          {chamado.disponibilidade_atendimento || "Não informado"}
                                        </strong>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2 text-slate-700 pt-1.5 border-t border-amber-200/50">
                                      <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="block font-bold text-[10px] uppercase tracking-wider text-slate-500">Endereço de Visita</span>
                                        <strong className="text-xs text-slate-800 block mt-0.5">
                                          {chamado.imovel?.endereco || "Não disponível"} {chamado.imovel?.bairro ? `(${chamado.imovel.bairro})` : ""}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Alerta de OS Devolvida Anteriormente */}
                                  {chamado.devolvido_anteriormente && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-955 text-[11px] p-2.5 rounded-lg flex items-start gap-2 shadow-sm mb-2">
                                      <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold text-amber-800 block text-[10px] uppercase tracking-wider">OS Devolvida Anteriormente</span>
                                        {chamado.ultima_devolucao_justificativa && (
                                          <p className="text-[11px] text-amber-700 mt-1 italic leading-snug font-medium">
                                            "{chamado.ultima_devolucao_justificativa}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                                    <div><strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}</div>
                                    {chamado.tecnico && (
                                      <div className="pt-1 border-t border-slate-200 mt-1 flex items-center gap-1 text-slate-700">
                                        <User className="h-3 w-3 text-slate-400" />
                                        Técnico Responsável: <strong className="text-slate-800">{chamado.tecnico.nome}</strong>
                                      </div>
                                    )}
                                  </div>

                                  {renderFotosChamado(chamado)}

                                  <div className="bg-orange-50/50 border border-orange-100 text-orange-800 text-[10px] p-2 rounded font-semibold mt-1">
                                    O Técnico {chamado.tecnico?.nome || "designado"} iniciou a execução do serviço no local neste momento.
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </div>
          )}

          {/* ======================== TÉCNICO: FORMULÁRIO DE ENTREGA DE SERVIÇO (CONCLUSÃO) ======================== */}
          {activeTab === "os" && chamadoConcluindo && (
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy">Concluir Ordem de Serviço</CardTitle>
                <CardDescription className="text-xs">Para: {chamadoConcluindo.titulo}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleConcluirServico} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded border text-xs text-slate-600 space-y-2">
                    <div>
                      <strong>Descrição do Problema:</strong>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed bg-white border p-2 rounded">{chamadoConcluindo.descricao_problema}</p>
                    </div>
                    
                    {renderFotosChamado(chamadoConcluindo)}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Relatório Técnico de Conclusão *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Descreva detalhadamente o conserto realizado para resolver o problema estrutural ou de depreciação."
                      value={relatorio}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRelatorio(e.target.value)}
                      required
                      className="w-full border border-slate-200 rounded-md p-2 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Fotos do Serviço Concluído ('Depois') * (Upload de até 3 fotos)
                    </label>
                    <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      {imagensPreview.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 w-full mb-3">
                          {imagensPreview.map((preview, index) => (
                            <div key={index} className="relative border rounded-md overflow-hidden aspect-square bg-slate-100">
                              <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removerImagemDepois(index)}
                                className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {imagensPreview.length < 3 && (
                        <div className="space-y-2 text-center flex flex-col items-center">
                          <Camera className="h-7 w-7 text-slate-400" />
                          <div className="flex text-xs text-slate-500">
                            <label className="relative cursor-pointer bg-white rounded-md font-semibold text-occasio-blue hover:text-occasio-navy">
                              <span>Enviar foto do 'Depois' ({imagensPreview.length}/3)</span>
                              <input 
                                ref={fileInputRef} 
                                type="file" 
                                accept="image/png, image/jpeg, image/jpg" 
                                onChange={handleImageChange} 
                                className="sr-only" 
                                multiple
                              />
                            </label>
                          </div>
                          <p className="text-[10px] text-slate-400">Formatos aceitos: .png, .jpg, .jpeg. Se exceder 2MB, será comprimido.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setChamadoConcluindo(null)}>
                      Voltar
                    </Button>
                    <Button disabled={salvando} size="sm" type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold">
                      {salvando ? "Salvando..." : "Concluir OS"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ======================== ABA: OS CONCLUÍDAS (PJ) ======================== */}
      {activeTab === "concluidas" && !ehTecnico && (() => {
        // Gera as opções de meses dinamicamente
        const mesesDisponiveis = Array.from(new Set(osConcluidas.map(c => {
          const d = new Date(c.criado_em)
          const ano = d.getFullYear()
          const mes = String(d.getMonth() + 1).padStart(2, '0')
          return `${ano}-${mes}`
        }))).sort().reverse()

        // Gera as opções de categorias dinamicamente
        const categoriasDisponiveis = Array.from(new Set(osConcluidas.map(c => c.categoria))).filter(Boolean)

        // Formata mes/ano
        const formatarMesAno = (mesAnoStr: string) => {
          const [ano, mes] = mesAnoStr.split("-")
          const meses = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
          ]
          const idx = parseInt(mes) - 1
          return `${meses[idx]}/${ano}`
        }

        // Filtra chamados concluídos
        const chamadosFiltrados = osConcluidas.filter(c => {
          if (filtroCategoria && c.categoria !== filtroCategoria) return false
          if (filtroMes) {
            const d = new Date(c.criado_em)
            const ano = d.getFullYear()
            const mes = String(d.getMonth() + 1).padStart(2, '0')
            const mesAno = `${ano}-${mes}`
            if (mesAno !== filtroMes) return false
          }
          return true
        })

        return (
          <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-3 text-xs">
              <div className="flex flex-col gap-1 min-w-[120px]">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Filtrar por Categoria</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 bg-white text-xs focus:outline-none"
                >
                  <option value="">Todas as categorias</option>
                  {categoriasDisponiveis.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 min-w-[120px]">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Filtrar por Mês</label>
                <select
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 bg-white text-xs focus:outline-none"
                >
                  <option value="">Todos os meses</option>
                  {mesesDisponiveis.map(m => (
                    <option key={m} value={m}>{formatarMesAno(m)}</option>
                  ))}
                </select>
              </div>

              {(filtroCategoria || filtroMes) && (
                <Button 
                  onClick={() => {
                    setFiltroCategoria("")
                    setFiltroMes("")
                  }}
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 mt-4 h-7"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>

            {/* Listagem */}
            {chamadosFiltrados.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-3">
                <HelpCircle className="h-10 w-10 text-slate-300" />
                <div className="font-semibold text-slate-500">Nenhum chamado concluído</div>
                <p className="max-w-xs mx-auto text-[11px] text-slate-400">
                  Não encontramos OS's concluídas com os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {chamadosFiltrados.map((chamado) => (
                  <Card key={chamado.id} className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-all">
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                              {chamado.imovel?.codigo_imovel || "Sem Código"}
                            </span>
                            {chamado.imovel?.imobiliaria?.nome && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                {chamado.imovel.imobiliaria.nome}
                              </span>
                            )}
                          </div>
                          <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                        </div>
                        
                        <Badge className={`${
                          chamado.status === 'servico_concluido' 
                            ? "bg-green-50 text-green-800 border-green-200" 
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        } border text-[9px] font-bold uppercase`}>
                          {chamado.status === 'servico_concluido' ? "Serviço Concluído" : "OS Encerrada"}
                        </Badge>
                      </div>

                      <p className="text-slate-500 line-clamp-2 leading-relaxed">{chamado.descricao_problema}</p>

                      <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                        <div><strong>Endereço:</strong> {chamado.imovel?.endereco || "Não disponível"} ({chamado.imovel?.bairro || ""})</div>
                        <div><strong>Técnico Responsável:</strong> <strong className="text-slate-800">{chamado.tecnico?.nome || "Não informado"}</strong></div>
                        {chamado.data_conclusao && (
                          <div><strong>Concluído em:</strong> {new Date(chamado.data_conclusao).toLocaleDateString('pt-BR')}</div>
                        )}
                      </div>

                      {/* Detalhes Financeiros Homologados */}
                      {(() => {
                        const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
                        if (!orc) return null
                        const total = orc.valor_servico_r$ + orc.valor_materiais_r$
                        return (
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
                            <span>Mão de Obra: <strong>R$ {orc.valor_servico_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                            <span>Materiais: <strong>R$ {orc.valor_materiais_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                            <span className="text-occasio-blue font-bold">Total: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ======================== ABA 3: PAINEL FINANCEIRO (PJ) ======================== */}
      {activeTab === "financeiro" && !ehTecnico && (() => {
        // Cálculos financeiros gerais otimizados com regras de repasse
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        let aReceberVencido = 0
        let aReceberAVencer = 0
        let aPagarVencido = 0
        let aPagarAVencer = 0

        financeiroChamados.forEach((chamado) => {
          const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return

          // 1. A Receber (da Imobiliária)
          const matReceber = orc.responsavel_material_empresa === 'empresa' ? orc.valor_materiais_r$ : 0
          const recTotal = orc.valor_servico_r$ + matReceber

          const dataConcl = chamado.data_conclusao || chamado.criado_em
          const dtReceber = calcularDataRepasse(dataConcl, chamado.imovel?.imobiliaria?.tipo_repasse, chamado.imovel?.imobiliaria?.prazo_repasse_dias)

          if (dtReceber && dtReceber < hoje) {
            aReceberVencido += recTotal
          } else {
            aReceberAVencer += recTotal
          }

          // 2. A Pagar (ao Técnico)
          const matPagar = orc.responsavel_material_tecnico === 'tecnico' ? (orc.valor_materiais_tecnico_r$ || 0) : 0
          const pagTotal = (orc.valor_servico_tecnico_r$ || 0) + matPagar

          const dtPagar = calcularDataRepasse(dataConcl, perfil?.tipo_repasse, perfil?.prazo_repasse_dias)

          if (dtPagar && dtPagar < hoje) {
            aPagarVencido += pagTotal
          } else {
            aPagarAVencer += pagTotal
          }
        })

        const totalReceber = aReceberVencido + aReceberAVencer
        const totalPagar = aPagarVencido + aPagarAVencer
        const margemLucro = totalReceber - totalPagar

        return (
          <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">A Receber</span>
                  <Coins className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    R$ {totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex flex-col text-[8px] text-slate-400">
                    <span className={aReceberVencido > 0 ? "text-red-500 font-bold" : ""}>
                      Vencido: R$ {aReceberVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span>
                      A Vencer: R$ {aReceberAVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">A Pagar</span>
                  <User className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    R$ {totalPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex flex-col text-[8px] text-slate-400">
                    <span className={aPagarVencido > 0 ? "text-red-500 font-bold" : ""}>
                      Vencido: R$ {aPagarVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span>
                      A Vencer: R$ {aPagarAVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">Lucro Est.</span>
                  <TrendingUp className="h-3.5 w-3.5 text-occasio-blue" />
                </div>
                <div className="mt-2 space-y-1">
                  <div className={`text-xs font-extrabold ${margemLucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                    R$ {margemLucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[8px] text-slate-400 italic">
                    Margem Líquida
                  </div>
                </div>
              </div>
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
                Lotes de Técnicos / Conciliação
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
                Histórico de Fechamentos Técnicos
              </button>
            </div>

            {subAbaFinanceira === "pendentes" ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setExibirModalNovoFechamento(true)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-9 px-4 flex items-center gap-1.5 justify-center shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> Realizar Fechamento de Técnicos
                  </Button>
                </div>

                {financeiroChamados.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-3">
                    <Coins className="h-10 w-10 text-slate-300" />
                    <div className="font-semibold text-slate-500">Nenhum registro financeiro</div>
                    <p className="max-w-xs mx-auto text-[11px] text-slate-400">
                      Os chamados homologados aparecerão aqui para controle de custos e faturamento.
                    </p>
                  </div>
                ) : (
                  financeiroChamados.map((chamado) => {
                    const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
                    if (!orc) return null

                    const matReceber = orc.responsavel_material_empresa === 'empresa' ? orc.valor_materiais_r$ : 0
                    const recTotal = orc.valor_servico_r$ + matReceber

                    const matPagar = orc.responsavel_material_tecnico === 'tecnico' ? (orc.valor_materiais_tecnico_r$ || 0) : 0
                    const pagTotal = (orc.valor_servico_tecnico_r$ || 0) + matPagar

                    const lucroItem = recTotal - pagTotal

                    const dataConcl = chamado.data_conclusao || chamado.criado_em
                    const dtReceber = calcularDataRepasse(dataConcl, chamado.imovel?.imobiliaria?.tipo_repasse, chamado.imovel?.imobiliaria?.prazo_repasse_dias)
                    const dtPagar = calcularDataRepasse(dataConcl, perfil?.tipo_repasse, perfil?.prazo_repasse_dias)

                    const strReceber = formatarData(dtReceber)
                    const strPagar = formatarData(dtPagar)

                    const condReceber = formatarCondicaoRepasse(chamado.imovel?.imobiliaria?.tipo_repasse, chamado.imovel?.imobiliaria?.prazo_repasse_dias)
                    const condPagar = formatarCondicaoRepasse(perfil?.tipo_repasse, perfil?.prazo_repasse_dias)

                    const isReceberVencido = dtReceber && dtReceber < hoje
                    const isPagarVencido = dtPagar && dtPagar < hoje

                    const isPagoTecnico = chamado.status_financeiro_tecnico === "pago"
                    const isFechadoTecnico = !!chamado.fechamento_tecnico_id

                    // Status amigável
                    let statusColor = "bg-slate-100 text-slate-700"
                    let statusTexto = chamado.status as string
                    if (chamado.status === "orcamento_recebido") {
                      statusColor = "bg-yellow-50 text-yellow-800 border-yellow-200"
                      statusTexto = "Em Análise"
                    } else if (chamado.status === "os_liberada" || chamado.status === "em_execucao") {
                      statusColor = "bg-teal-50 text-teal-800 border-teal-200"
                      statusTexto = "Em Execução"
                    } else if (chamado.status === "servico_concluido" || chamado.status === "encerrado") {
                      statusColor = "bg-green-50 text-green-800 border-green-200"
                      statusTexto = "Finalizado"
                    }

                    return (
                      <Card key={chamado.id} className="border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 space-y-3 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                  {chamado.imovel?.codigo_imovel || "Sem Código"}
                                </span>
                                {chamado.imovel?.imobiliaria?.nome && (
                                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                    {chamado.imovel.imobiliaria.nome}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                            </div>
                            <Badge className={`${statusColor} border text-[9px] font-bold uppercase`}>
                              {statusTexto}
                            </Badge>
                          </div>

                          <div className="text-[10px] text-slate-500 flex justify-between items-center bg-slate-50 p-2 rounded">
                            <span>Técnico Responsável: <strong>{chamado.tecnico?.nome || "Não atribuído"}</strong></span>
                            <span>Prazo: <strong>{orc.prazo_execucao_dias} dias</strong></span>
                          </div>

                          {/* Detalhamento Financeiro */}
                          <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
                            {/* Bloco Cliente */}
                            <div className="bg-slate-50/50 p-2.5 rounded border border-slate-100 space-y-1">
                              <span className="block font-bold text-[9px] text-slate-500 uppercase">Imobiliária (A Receber)</span>
                              <div className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-100 flex flex-col space-y-0.5 mb-1.5">
                                <span>Acerto: <strong>{condReceber}</strong></span>
                                <span className={isReceberVencido ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                                  Previsão: <strong>{strReceber} {isReceberVencido && "(Vencido)"}</strong>
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Mão de Obra:</span>
                                <span className="font-semibold">R$ {orc.valor_servico_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Materiais:</span>
                                <span className="font-semibold text-slate-600">
                                  R$ {orc.valor_materiais_r$.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-400 italic">
                                Pago por: {orc.responsavel_material_empresa === 'empresa' ? "Empresa (Nós)" : orc.responsavel_material_empresa === 'imobiliaria' ? "Imobiliária" : "Proprietário"}
                              </div>
                              <div className="flex justify-between border-t border-dashed pt-1 font-bold text-slate-800">
                                <span>Total:</span>
                                <span>R$ {recTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                            {/* Bloco Técnico */}
                            <div className="bg-slate-50/50 p-2.5 rounded border border-slate-100 space-y-1">
                              <span className="block font-bold text-[9px] text-slate-500 uppercase">Técnico (A Pagar)</span>
                              <div className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-100 flex flex-col space-y-0.5 mb-1.5">
                                <span>Acerto: <strong>{condPagar}</strong></span>
                                <span className={isPagarVencido ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                                  Previsão: <strong>{strPagar} {isPagarVencido && "(Vencido)"}</strong>
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Mão de Obra:</span>
                                <span className="font-semibold">R$ {(orc.valor_servico_tecnico_r$ || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Materiais:</span>
                                <span className="font-semibold text-slate-600">
                                  R$ {(orc.valor_materiais_tecnico_r$ || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-400 italic">
                                Comprado por: {orc.responsavel_material_tecnico === 'tecnico' ? "Técnico" : "Empresa (Nós)"}
                              </div>
                              <div className="flex justify-between border-t border-dashed pt-1 font-bold text-slate-800">
                                <span>Total:</span>
                                <span>R$ {pagTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Lucro Item */}
                          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-xs">
                            <span className="font-semibold text-slate-500">Resultado Líquido / Margem:</span>
                            <span className={`font-extrabold ${lucroItem >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {lucroItem >= 0 ? "+" : ""} R$ {lucroItem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Status de Pagamento ao Técnico */}
                          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500 font-semibold">Pagamento Técnico:</span>
                              <Badge className={`border text-[9px] font-extrabold uppercase ${
                                isPagoTecnico
                                  ? "bg-green-50 text-green-700 border-green-200" 
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }`}>
                                {isPagoTecnico ? "Pago" : "Pendente"}
                              </Badge>
                            </div>
                            
                            <Button
                              size="sm"
                              disabled={salvando || isFechadoTecnico}
                              onClick={async () => {
                                setSalvando(true)
                                try {
                                  const novoStatusFin = isPagoTecnico ? "pendente" : "pago"
                                  const { error } = await supabase
                                    .from("chamados")
                                    .update({ status_financeiro_tecnico: novoStatusFin })
                                    .eq("id", chamado.id)
                                  if (error) throw error
                                  await loadPrestadorData()
                                } catch (err: any) {
                                  console.error(err)
                                  alert(err.message || "Erro ao atualizar pagamento do técnico.")
                                } finally {
                                  setSalvando(false)
                                }
                              }}
                              className={`h-6 text-[9px] px-2 font-semibold text-white ${
                                isFechadoTecnico 
                                  ? "bg-slate-300 border-slate-300 text-slate-500 cursor-not-allowed" 
                                  : (isPagoTecnico ? "bg-amber-500 hover:bg-amber-600" : "bg-green-600 hover:bg-green-700")
                              }`}
                            >
                              {isFechadoTecnico ? "Fechado" : (isPagoTecnico ? "Pendente" : "Pagar")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            ) : (
              /* Histórico de Fechamentos Técnicos */
              <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Competência</th>
                        <th className="py-3 px-4">Data do Fechamento</th>
                        <th className="py-3 px-4">Operador</th>
                        <th className="py-3 px-4 text-right">Total Pago</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {carregandoFechamentos ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400">
                            Carregando histórico...
                          </td>
                        </tr>
                      ) : fechamentosTecnicos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400">
                            Nenhum fechamento registrado ainda.
                          </td>
                        </tr>
                      ) : (
                        fechamentosTecnicos.map((f) => (
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
                              R$ {Number(f.total_pago_tecnicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

      {/* ======================== ABA 3: PAINEL FINANCEIRO (PF - TÉCNICO) ======================== */}
      {activeTab === "financeiro" && ehTecnico && (() => {
        // Ganhos do técnico PF (repasses da Empresa Mãe)
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        let aReceberVencido = 0
        let aReceberAVencer = 0

        financeiroChamados.forEach((chamado) => {
          const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return

          // Ganhos do técnico: Mão de Obra + Reembolso de materiais (se comprou do próprio bolso)
          const matPagar = orc.responsavel_material_tecnico === 'tecnico' ? (orc.valor_materiais_tecnico_r$ || 0) : 0
          const recTotal = (orc.valor_servico_tecnico_r$ || 0) + matPagar

          const dataConcl = chamado.data_conclusao || chamado.criado_em
          const dtReceber = calcularDataRepasse(dataConcl, empresaMae?.tipo_repasse, empresaMae?.prazo_repasse_dias)

          if (dtReceber && dtReceber < hoje) {
            aReceberVencido += recTotal
          } else {
            aReceberAVencer += recTotal
          }
        })

        const totalReceber = aReceberVencido + aReceberAVencer
        const condEmpresaMae = formatarCondicaoRepasse(empresaMae?.tipo_repasse, empresaMae?.prazo_repasse_dias)

        return (
          <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">A Receber</span>
                  <Coins className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-slate-800">R$ {totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">Vencido</span>
                  <AlertCircle className={`h-3.5 w-3.5 ${aReceberVencido > 0 ? "text-red-500" : "text-slate-300"}`} />
                </div>
                <div className="mt-2">
                  <span className={`text-xs font-bold ${aReceberVencido > 0 ? "text-red-500" : "text-slate-800"}`}>
                    R$ {aReceberVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">A Vencer</span>
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-slate-800">R$ {aReceberAVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Condição de Acerto com a Empresa Mãe */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="block font-bold text-[9px] text-slate-400 uppercase">Empresa Contratante</span>
                  <span className="font-extrabold text-occasio-navy">{empresaMae?.nome || "Não configurada"}</span>
                </div>
                <div className="text-right">
                  <span className="block font-bold text-[9px] text-slate-400 uppercase">Regra de Acerto</span>
                  <Badge className="bg-blue-50 text-blue-800 border-blue-200 border text-[10px] font-bold mt-0.5">
                    {condEmpresaMae}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Lista de OS Concluídas */}
            <div className="space-y-4">
              {financeiroChamados.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-3">
                  <Coins className="h-10 w-10 text-slate-300" />
                  <div className="font-semibold text-slate-500">Nenhuma OS finalizada</div>
                  <p className="max-w-xs mx-auto text-[11px] text-slate-400">
                    As OS concluídas ou encerradas aparecerão aqui com as previsões de pagamento correspondentes.
                  </p>
                </div>
              ) : (
                financeiroChamados.map((chamado) => {
                  const orc = chamado.orcamentos?.find(o => o.homologado_pela_empresa)
                  if (!orc) return null

                  const matPagar = orc.responsavel_material_tecnico === 'tecnico' ? (orc.valor_materiais_tecnico_r$ || 0) : 0
                  const recTotal = (orc.valor_servico_tecnico_r$ || 0) + matPagar

                  const dataConcl = chamado.data_conclusao || chamado.criado_em
                  const dtReceber = calcularDataRepasse(dataConcl, empresaMae?.tipo_repasse, empresaMae?.prazo_repasse_dias)

                  const strReceber = formatarData(dtReceber)
                  const isReceberVencido = dtReceber && dtReceber < hoje

                  let statusColor = "bg-slate-100 text-slate-700"
                  let statusTexto = chamado.status as string
                  if (chamado.status === "servico_concluido") {
                    statusColor = "bg-green-50 text-green-800 border-green-200"
                    statusTexto = "Serviço Concluído"
                  } else if (chamado.status === "encerrado") {
                    statusColor = "bg-blue-50 text-blue-800 border-blue-200"
                    statusTexto = "OS Encerrada"
                  }

                  return (
                    <Card key={chamado.id} className="border-slate-200 shadow-sm bg-white">
                      <CardContent className="p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                {chamado.imovel?.codigo_imovel || "Sem Código"}
                              </span>
                              {chamado.imovel?.imobiliaria?.nome && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[9px] border border-blue-100">
                                  {chamado.imovel.imobiliaria.nome}
                                </span>
                              )}
                            </div>
                            <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                          </div>
                          <Badge className={`${statusColor} border text-[9px] font-bold uppercase`}>
                            {statusTexto}
                          </Badge>
                        </div>

                        <div className="text-[10px] text-slate-500 flex justify-between items-center bg-slate-50 p-2 rounded">
                          <span>Conclusão: <strong>{formatarData(dataConcl ? new Date(dataConcl) : null)}</strong></span>
                          <span className={isReceberVencido ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                            Previsão: <strong>{strReceber} {isReceberVencido && "(Vencido)"}</strong>
                          </span>
                        </div>

                        {/* Detalhamento de valores */}
                        <div className="bg-slate-50/50 p-2.5 rounded border border-slate-100 space-y-1">
                          <div className="flex justify-between">
                            <span>Mão de Obra (Serviço):</span>
                            <span className="font-semibold text-slate-800">
                              R$ {(orc.valor_servico_tecnico_r$ || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Materiais Comprados:</span>
                            <span className="font-semibold text-slate-600">
                              R$ {matPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400 italic">
                            Reembolso de materiais: {orc.responsavel_material_tecnico === 'tecnico' ? "Sim (pago pelo Técnico)" : "Não (pago pela Empresa)"}
                          </div>
                          <div className="flex justify-between border-t border-dashed pt-1.5 font-bold text-occasio-navy text-sm">
                            <span>Total a Receber:</span>
                            <span>R$ {recTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal de Novo Fechamento de Técnicos */}
      {exibirModalNovoFechamento && (() => {
        const chamadosCompetencia = financeiroChamados.filter(c => {
          if (c.status !== 'servico_concluido' && c.status !== 'encerrado') return false
          if (!c.tecnico_id) return false
          if (c.fechamento_tecnico_id) return false
          
          const dataRef = c.data_conclusao ? new Date(c.data_conclusao) : new Date(c.criado_em)
          return dataRef.getMonth() + 1 === mesFechamento && dataRef.getFullYear() === anoFechamento
        })

        let prevMaoDeObra = 0
        let prevReembolso = 0
        chamadosCompetencia.forEach(c => {
          const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return
          prevMaoDeObra += Number(orc.valor_servico_tecnico_r$ || 0)
          if (orc.responsavel_material_tecnico === 'tecnico') {
            prevReembolso += Number(orc.valor_materiais_tecnico_r$ || 0)
          }
        })

        const totalPrevisto = prevMaoDeObra + prevReembolso

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md border-slate-200 shadow-2xl bg-white animate-in zoom-in-95 duration-150">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-1.5 justify-between">
                  <span>Realizar Fechamento de Técnicos</span>
                  <button onClick={() => setExibirModalNovoFechamento(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                </CardTitle>
                <CardDescription className="text-xs">
                  Faturamento e repasse mensal consolidado da equipe de técnicos de campo.
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
                    <span className="text-slate-500">OS's da Equipe:</span>
                    <strong className="text-slate-700">{chamadosCompetencia.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Mão de Obra:</span>
                    <strong className="text-slate-700 font-mono">R$ {prevMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Reembolsos:</span>
                    <strong className="text-green-600 font-mono">R$ {prevReembolso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-bold">
                    <span className="text-slate-700">Total Líquido Devido:</span>
                    <span className="text-occasio-blue font-mono">
                      R$ {totalPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {chamadosCompetencia.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto border border-slate-100 rounded p-2 bg-white text-[10px] space-y-1.5">
                    {chamadosCompetencia.map(c => {
                      const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
                      const valTec = Number(orc?.valor_servico_tecnico_r$ || 0) + (orc?.responsavel_material_tecnico === 'tecnico' ? Number(orc?.valor_materiais_tecnico_r$ || 0) : 0)
                      return (
                        <div key={c.id} className="flex justify-between text-slate-500 border-b pb-1 last:border-0 last:pb-0">
                          <span className="truncate max-w-[200px]" title={c.titulo}>
                            [{c.imovel?.codigo_imovel}] {c.tecnico?.nome}: {c.titulo}
                          </span>
                          <span className="font-semibold text-slate-700 font-mono">
                            R$ {valTec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-red-500 font-medium text-center">
                    Nenhuma OS finalizada encontrada para esta competência.
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    disabled={salvandoFechamento || chamadosCompetencia.length === 0}
                    onClick={handleExecutarFechamentoTecnicos}
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

      {/* Modal de Detalhes do Fechamento de Técnicos */}
      {exibirModalDetalhesFechamento && fechamentoSelecionado && (() => {
        const f = fechamentoSelecionado
        const chamadosFechados = financeiroChamados.filter(c => c.fechamento_tecnico_id === f.id)

        // Agrupa valores por Técnico
        const tecnicosMap: { 
          [id: string]: { 
            nome: string
            maoDeObra: number
            reembolso: number
            total: number
          } 
        } = {}

        chamadosFechados.forEach(c => {
          if (!c.tecnico_id) return
          const orc = c.orcamentos?.find(o => o.homologado_pela_empresa)
          if (!orc) return

          const idTec = c.tecnico_id
          const nomeTec = c.tecnico?.nome || "Sem Nome"
          const maoDeObra = Number(orc.valor_servico_tecnico_r$ || 0)
          const reembolso = orc.responsavel_material_tecnico === 'tecnico' ? Number(orc.valor_materiais_tecnico_r$ || 0) : 0

          if (!tecnicosMap[idTec]) {
            tecnicosMap[idTec] = {
              nome: nomeTec,
              maoDeObra: 0,
              reembolso: 0,
              total: 0
            }
          }

          tecnicosMap[idTec].maoDeObra += maoDeObra
          tecnicosMap[idTec].reembolso += reembolso
          tecnicosMap[idTec].total += maoDeObra + reembolso
        })

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg border-slate-200 shadow-2xl bg-white animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex-shrink-0">
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-1.5 justify-between">
                  <span>Fechamento Competência: {String(f.mes).padStart(2, '0')}/{f.ano}</span>
                  <button onClick={() => setExibirModalDetalhesFechamento(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                </CardTitle>
                <CardDescription className="text-xs">
                  Detalhamento consolidado de repasses para técnicos fechados em {new Date(f.criado_em).toLocaleDateString('pt-BR')} por {f.criado_por?.nome || "Sistema"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 overflow-y-auto flex-grow text-xs">
                {/* Resumo */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200/60 flex justify-between items-center text-center">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">OS's Vinculadas</span>
                    <strong className="text-base text-slate-800">{chamadosFechados.length}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Repasse Total Técnicos</span>
                    <strong className="text-base text-occasio-blue font-mono font-bold">R$ {Number(f.total_pago_tecnicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                {/* Técnicos e Extratos */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-700 uppercase tracking-wider border-b pb-1 text-[10px]">
                    👥 Repasses por Técnico
                  </h4>
                  {Object.keys(tecnicosMap).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Nenhum técnico com valores a receber neste lote.</p>
                  ) : (
                    <div className="space-y-3 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      {Object.entries(tecnicosMap).map(([idTec, data]) => (
                        <div key={idTec} className="pt-2 flex flex-col space-y-1">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span>{data.nome}</span>
                            <span className="font-mono font-bold">R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Mão de Obra: R$ {data.maoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span>Reembolsos: R$ {data.reembolso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-end pt-1">
                            <Button
                              size="sm"
                              onClick={() => {
                                window.open(`/financeiro/recibo-tecnico/${f.id}/${idTec}`, '_blank')
                              }}
                              className="h-6 text-[9px] font-bold bg-occasio-blue hover:bg-occasio-navy text-white flex items-center gap-1"
                            >
                              <Printer className="h-3 w-3" /> Gerar Recibo / PDF
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Modal de Justificativa de Devolução da OS */}
      {chamadoDevolvendo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="bg-red-50 border-b border-red-100 p-4">
              <CardTitle className="text-sm font-extrabold text-red-900 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Devolver Ordem de Serviço
              </CardTitle>
              <CardDescription className="text-xs text-red-700">
                Você está devolvendo a OS: <strong>{chamadoDevolvendo.titulo}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Esta ação removerá você como técnico responsável e enviará a OS de volta para a triagem da Prestadora. 
                A justificativa será gravada no histórico de auditoria e ficará visível para o gestor.
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Justificativa da Devolução *
                </label>
                <textarea
                  value={justificativaDevolucao}
                  onChange={(e) => setJustificativaDevolucao(e.target.value)}
                  placeholder="Digite o motivo detalhado da devolução (mínimo de 10 caracteres)..."
                  required
                  rows={4}
                  className="w-full border border-slate-200 rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>Mínimo 10 caracteres</span>
                  <span className={justificativaDevolucao.length >= 10 ? "text-green-600" : "text-red-500"}>
                    {justificativaDevolucao.length} caracteres
                  </span>
                </div>
              </div>

              {erro && (
                <Alert variant="destructive" className="p-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-[11px] font-medium leading-tight">{erro}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setChamadoDevolvendo(null)
                    setJustificativaDevolucao("")
                    setErro(null)
                  }}
                  disabled={devolvendoLoading}
                  className="text-xs h-9 px-4 font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDevolverOS}
                  disabled={devolvendoLoading || justificativaDevolucao.length < 10}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-4 text-xs flex items-center gap-1.5"
                >
                  {devolvendoLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Devolvendo...
                    </>
                  ) : (
                    "Confirmar Devolução"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal para ampliação de imagens (Lightbox) */}
      {imagemZoom && (
        <div 
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setImagemZoom(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={imagemZoom} 
              alt="Foto ampliada" 
              className="max-w-[95vw] max-h-[90vh] rounded-lg shadow-2xl object-contain" 
            />
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-bold">
              Clique em qualquer lugar para fechar
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
