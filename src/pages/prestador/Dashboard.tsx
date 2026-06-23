import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { comprimirImagem } from "@/lib/compressor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Camera, Wrench, CheckCircle2, Loader2, RefreshCw, HelpCircle, Hammer, AlertCircle,
  User, UserCheck, FileText, Coins, TrendingUp
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
  
  // Abas do PWA (orcamentos, os, financeiro)
  const [activeTab, setActiveTab] = useState<"orcamentos" | "os" | "financeiro">("orcamentos")
  
  // Dados das listas
  const [chamadosPendentes, setChamadosPendentes] = useState<Chamado[]>([])
  const [osAtivas, setOsAtivas] = useState<Chamado[]>([])
  const [financeiroChamados, setFinanceiroChamados] = useState<Chamado[]>([])
  const [empresaMae, setEmpresaMae] = useState<any | null>(null)
  
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
  const [imagemDepois, setImagemDepois] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para ampliar foto do problema / visualização de mídia
  const [imagemZoom, setImagemZoom] = useState<string | null>(null)

  // Verifica se é perfil de Técnico (pertence a uma Empresa Mãe) ou Empresa PJ (é conta-mãe)
  const ehTecnico = !!perfil?.empresa_mae_id

  // Carrega listagens do prestador/empresa
  const loadPrestadorData = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    setErro(null)

    try {
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
            imovel:imovel_id (codigo_imovel, endereco, bairro),
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
        setChamadosPendentes(pendentesData as unknown as Chamado[] || [])

        // 2. Busca OS Ativas delegadas ao técnico ('os_liberada' ou 'em_execucao')
        // 2. Busca OS Ativas delegadas ao técnico ('os_liberada' ou 'em_execucao')
        const { data: osData, error: osError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro),
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
        setOsAtivas(osData as unknown as Chamado[] || [])

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
        setFinanceiroChamados(chamadosComOrcamento as unknown as Chamado[])

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
            imovel:imovel_id (codigo_imovel, endereco, bairro),
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
        setChamadosPendentes(pendentesData as unknown as Chamado[] || [])

        // 2. Busca todas as OS ativas de toda a sua equipe técnica
        const { data: osData, error: osError } = await supabase
          .from("chamados")
          .select(`
            *,
            imovel:imovel_id (codigo_imovel, endereco, bairro),
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
        setOsAtivas(osData as unknown as Chamado[] || [])

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
        setFinanceiroChamados(chamadosComOrcamento as unknown as Chamado[])
      }

    } catch (err: any) {
      console.error(err)
      setErro("Falha ao sincronizar dados com o servidor.")
    } finally {
      setLoading(false)
      setRealtimeLoading(false)
    }
  }

  useEffect(() => {
    if (user && perfil) {
      loadPrestadorData()

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
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoDelegando.id,
        usuario_id: user?.id,
        status_anterior: chamadoDelegando.status,
        novo_status: chamadoDelegando.status,
        observacao: `Chamado designado ao técnico ${tecNome} para realização de vistoria e cotação.`
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

  // Técnico: Trata seleção de imagem da conclusão e roda o compressor Canvas
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return

    try {
      const arquivoComprimido = await comprimirImagem(arquivo)
      setImagemDepois(arquivoComprimido)
      setImagemPreview(URL.createObjectURL(arquivoComprimido))
    } catch (err: any) {
      console.error(err)
      setErro("Erro ao processar imagem final do serviço.")
    }
  }

  // Técnico: Envia a conclusão de serviço (em_execucao -> servico_concluido)
  const handleConcluirServico = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoConcluindo) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    if (!relatorio || !imagemDepois) {
      setErro("É necessário preencher o relatório final e anexar a foto da conclusão do serviço.")
      setSalvando(false)
      return
    }

    try {
      // 1. Upload da imagem comprimida "depois" para o Storage
      const extensao = imagemDepois.type.split("/")[1] || "jpg"
      const caminho = `chamados/${chamadoConcluindo.id}_depois.${extensao}`

      const { error: uploadError } = await supabase.storage
        .from("chamados-midias")
        .upload(caminho, imagemDepois)

      if (uploadError) throw uploadError

      // Busca URL pública do arquivo enviado
      const { data: urlData } = supabase.storage
        .from("chamados-midias")
        .getPublicUrl(caminho)

      // 2. Salva na tabela chamados_midias
      const { error: midiaError } = await supabase
        .from("chamados_midias")
        .insert({
          chamado_id: chamadoConcluindo.id,
          usuario_id: user?.id,
          url_storage: urlData.publicUrl,
          tipo_midia: "depois"
        })

      if (midiaError) throw midiaError

      // 3. Atualiza o orçamento correspondente com o relatório técnico de conclusão
      // Puxamos o orçamento associado a esse chamado para atualizar
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({
          relatorio_conclusao: relatorio,
          data_agendamento_servico: new Date().toISOString()
        })
        .eq("chamado_id", chamadoConcluindo.id)

      if (orcamentoError) throw orcamentoError

      // 4. Atualiza status do chamado para 'servico_concluido'
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "servico_concluido" })
        .eq("id", chamadoConcluindo.id)

      if (chamadoError) throw chamadoError

      // 5. Histórico
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoConcluindo.id,
        usuario_id: user?.id,
        status_anterior: "em_execucao" as StatusChamado,
        novo_status: "servico_concluido" as StatusChamado,
        observacao: `Execução finalizada pelo técnico ${perfil?.nome}. Relatório e foto comprobatória enviados.`
      })

      setSucesso("Serviço concluído com sucesso! Aguardando homologação da imobiliária.")
      setChamadoConcluindo(null)
      setRelatorio("")
      setImagemDepois(null)
      setImagemPreview(null)
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
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-occasio-navy flex items-center gap-2">
            <Hammer className="h-6 w-6 text-occasio-blue" /> 
            {ehTecnico ? "PWA do Técnico" : "Painel do Prestador (PJ)"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {ehTecnico 
              ? "Orçamentos de campo e ordens de serviço delegadas." 
              : "Gestão comercial, delegação técnica e homologação."}
          </p>
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
      <div className="grid grid-cols-3 gap-2 bg-slate-200/60 p-1.5 rounded-lg mb-6">
        <button
          onClick={() => { 
            setActiveTab("orcamentos")
            setChamadoCotando(null)
            setChamadoConcluindo(null)
            setChamadoDelegando(null)
            setChamadoHomologando(null)
          }}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
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
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "os" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          OS Ativas ({osAtivas.length})
        </button>
        <button
          onClick={() => { 
            setActiveTab("financeiro")
            setChamadoCotando(null)
            setChamadoConcluindo(null)
            setChamadoDelegando(null)
            setChamadoHomologando(null)
          }}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
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
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                              {chamado.imovel?.codigo_imovel || "Sem Código"}
                            </span>
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
                        <p className="text-slate-500 line-clamp-2 leading-relaxed">{chamado.descricao_problema}</p>
                        
                        {/* Exibe a foto do problema anexada (tipo_midia = 'antes') se houver */}
                        {chamado.chamados_midias && chamado.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                          <div className="mt-1">
                            <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {chamado.chamados_midias
                                .filter(m => m.tipo_midia === 'antes')
                                .map(midia => (
                                  <img 
                                    key={midia.id} 
                                    src={midia.url_storage} 
                                    alt="Foto do Problema" 
                                    onClick={() => setImagemZoom(midia.url_storage)}
                                    className="h-14 w-14 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                                  />
                                ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] text-slate-600">
                          <div><strong>Endereço:</strong> {chamado.imovel?.endereco || "Não disponível"}</div>
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

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                          {ehTecnico ? (
                            <Button 
                              onClick={() => setChamadoCotando(chamado)} 
                              size="sm" 
                              className="bg-occasio-blue hover:bg-occasio-navy text-white text-[10px] px-3 h-7 font-bold"
                            >
                              Enviar Orçamento
                            </Button>
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
                    
                    {/* Foto do problema se houver */}
                    {chamadoCotando.chamados_midias && chamadoCotando.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                      <div className="mt-3">
                        <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {chamadoCotando.chamados_midias
                            .filter(m => m.tipo_midia === 'antes')
                            .map(midia => (
                              <img 
                                key={midia.id} 
                                src={midia.url_storage} 
                                alt="Foto do Problema" 
                                onClick={() => setImagemZoom(midia.url_storage)}
                                className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                              />
                            ))}
                        </div>
                      </div>
                    )}
                    
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
          {activeTab === "orcamentos" && chamadoDelegando && (
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
                  <div className="p-3 bg-slate-50 rounded border text-xs text-slate-600 mb-2 space-y-2">
                    <div>
                      <strong>Descrição do Problema:</strong>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed bg-white border p-2 rounded">{chamadoDelegando.descricao_problema}</p>
                    </div>

                    {/* Foto do problema se houver */}
                    {chamadoDelegando.chamados_midias && chamadoDelegando.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                      <div>
                        <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {chamadoDelegando.chamados_midias
                            .filter(m => m.tipo_midia === 'antes')
                            .map(midia => (
                              <img 
                                key={midia.id} 
                                src={midia.url_storage} 
                                alt="Foto do Problema" 
                                onClick={() => setImagemZoom(midia.url_storage)}
                                className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                              />
                            ))}
                        </div>
                      </div>
                    )}

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

                    {/* Foto do problema se houver */}
                    {chamadoHomologando.chamados_midias && chamadoHomologando.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                      <div>
                        <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {chamadoHomologando.chamados_midias
                            .filter(m => m.tipo_midia === 'antes')
                            .map(midia => (
                              <img 
                                key={midia.id} 
                                src={midia.url_storage} 
                                alt="Foto do Problema" 
                                onClick={() => setImagemZoom(midia.url_storage)}
                                className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                              />
                            ))}
                        </div>
                      </div>
                    )}

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
          {activeTab === "os" && !chamadoConcluindo && (
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
                                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                    {chamado.imovel?.codigo_imovel || "Sem Código"}
                                  </span>
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
                              
                              <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                                <div><strong>Endereço:</strong> {chamado.imovel?.endereco || "Não disponível"} ({chamado.imovel?.bairro || ""})</div>
                                <div><strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}</div>
                              </div>

                              {/* Exibe a foto do problema anexada (tipo_midia = 'antes') se houver */}
                              {chamado.chamados_midias && chamado.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                                <div className="mt-2">
                                  <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                                  <div className="flex gap-2 overflow-x-auto pb-1">
                                    {chamado.chamados_midias
                                      .filter(m => m.tipo_midia === 'antes')
                                      .map(midia => (
                                        <img 
                                          key={midia.id} 
                                          src={midia.url_storage} 
                                          alt="Foto do Problema" 
                                          onClick={() => setImagemZoom(midia.url_storage)}
                                          className="h-14 w-14 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                                        />
                                      ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5">
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
                                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                        {chamado.imovel?.codigo_imovel || "Sem Código"}
                                      </span>
                                      <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                                    </div>
                                    <Badge className="bg-teal-50 text-teal-800 border-teal-200 border text-[9px] font-bold uppercase">
                                      Liberada
                                    </Badge>
                                  </div>
                                  
                                  <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                                    <div><strong>Endereço:</strong> {chamado.imovel?.endereco || "Não disponível"} ({chamado.imovel?.bairro || ""})</div>
                                    <div><strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}</div>
                                    {chamado.tecnico && (
                                      <div className="pt-1 border-t border-slate-200 mt-1 flex items-center gap-1 text-slate-700">
                                        <User className="h-3 w-3 text-slate-400" />
                                        Técnico Responsável: <strong className="text-slate-800">{chamado.tecnico.nome}</strong>
                                      </div>
                                    )}
                                  </div>

                                  {/* Exibe a foto do problema anexada (tipo_midia = 'antes') se houver */}
                                  {chamado.chamados_midias && chamado.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                                    <div className="mt-2">
                                      <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                                      <div className="flex gap-2 overflow-x-auto pb-1">
                                        {chamado.chamados_midias
                                          .filter(m => m.tipo_midia === 'antes')
                                          .map(midia => (
                                            <img 
                                              key={midia.id} 
                                              src={midia.url_storage} 
                                              alt="Foto do Problema" 
                                              onClick={() => setImagemZoom(midia.url_storage)}
                                              className="h-14 w-14 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                                            />
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="bg-teal-50/50 border border-teal-100 text-teal-800 text-[10px] p-2 rounded font-semibold mt-1">
                                    A OS foi enviada e recebida no PWA do Técnico {chamado.tecnico?.nome || "designado"}. Aguardando o início do serviço no local.
                                  </div>
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
                                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                                        {chamado.imovel?.codigo_imovel || "Sem Código"}
                                      </span>
                                      <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                                    </div>
                                    <Badge className="bg-orange-50 text-orange-800 border-orange-200 border text-[9px] font-bold uppercase">
                                      Em Execução
                                    </Badge>
                                  </div>
                                  
                                  <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600 space-y-1">
                                    <div><strong>Endereço:</strong> {chamado.imovel?.endereco || "Não disponível"} ({chamado.imovel?.bairro || ""})</div>
                                    <div><strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}</div>
                                    {chamado.tecnico && (
                                      <div className="pt-1 border-t border-slate-200 mt-1 flex items-center gap-1 text-slate-700">
                                        <User className="h-3 w-3 text-slate-400" />
                                        Técnico Responsável: <strong className="text-slate-800">{chamado.tecnico.nome}</strong>
                                      </div>
                                    )}
                                  </div>

                                  {/* Exibe a foto do problema anexada (tipo_midia = 'antes') se houver */}
                                  {chamado.chamados_midias && chamado.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                                    <div className="mt-2">
                                      <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema:</span>
                                      <div className="flex gap-2 overflow-x-auto pb-1">
                                        {chamado.chamados_midias
                                          .filter(m => m.tipo_midia === 'antes')
                                          .map(midia => (
                                            <img 
                                              key={midia.id} 
                                              src={midia.url_storage} 
                                              alt="Foto do Problema" 
                                              onClick={() => setImagemZoom(midia.url_storage)}
                                              className="h-14 w-14 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                                            />
                                          ))}
                                      </div>
                                    </div>
                                  )}

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
                    
                    {/* Foto do problema se houver */}
                    {chamadoConcluindo.chamados_midias && chamadoConcluindo.chamados_midias.some(m => m.tipo_midia === 'antes') && (
                      <div>
                        <span className="block font-bold text-[9px] text-slate-400 uppercase mb-1">Foto do Problema (Antes):</span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {chamadoConcluindo.chamados_midias
                            .filter(m => m.tipo_midia === 'antes')
                            .map(midia => (
                              <img 
                                key={midia.id} 
                                src={midia.url_storage} 
                                alt="Foto do Problema Antes" 
                                onClick={() => setImagemZoom(midia.url_storage)}
                                className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-slate-200"
                              />
                            ))}
                        </div>
                      </div>
                    )}
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
                      Foto do Serviço Concluído ('Depois') *
                    </label>
                    <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      {imagemPreview ? (
                        <div className="relative w-full flex flex-col items-center">
                           <img src={imagemPreview} alt="Conserto finalizado" className="max-h-36 rounded shadow-md object-contain mb-2" />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            type="button"
                            onClick={() => { setImagemDepois(null); setImagemPreview(null) }}
                            className="text-[10px] text-red-600 border-red-200 hover:bg-red-50 h-7"
                          >
                            Remover
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 text-center flex flex-col items-center">
                          <Camera className="h-7 w-7 text-slate-400" />
                          <div className="flex text-xs text-slate-500">
                            <label className="relative cursor-pointer bg-white rounded-md font-semibold text-occasio-blue hover:text-occasio-navy">
                              <span>Enviar foto do 'Depois'</span>
                              <input 
                                ref={fileInputRef} 
                                type="file" 
                                accept="image/*" 
                                onChange={handleImageChange} 
                                className="sr-only" 
                                required
                              />
                            </label>
                          </div>
                          <p className="text-[9px] text-slate-400">Comprimida pelo Canvas antes do upload.</p>
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

            {/* Lista de Chamados no Financeiro */}
            <div className="space-y-4">
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
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                              {chamado.imovel?.codigo_imovel || "Sem Código"}
                            </span>
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
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
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
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                              {chamado.imovel?.codigo_imovel || "Sem Código"}
                            </span>
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
