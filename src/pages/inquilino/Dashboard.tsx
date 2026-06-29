import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { comprimirImagemChamado } from "@/lib/compressor"
import VisualizadorImagem from "@/components/VisualizadorImagem"
import PWANotificacoesCard from "@/components/PWANotificacoesCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, Camera, Wrench, CheckCircle2, 
  AlertTriangle, Loader2, RefreshCw, Landmark, History, AlertCircle, Plus, X
} from "lucide-react"

// Tipagens locais
type StatusChamado = 
  | 'aberto' | 'em_triagem' | 'aguardando_orcamento' | 'orcamento_recebido' 
  | 'analise_proprietario' | 'aguardando_autorizacao' | 'os_liberada' 
  | 'em_execucao' | 'servico_concluido' | 'encerrado' | 'reprovado'

interface Imovel {
  id: string
  codigo_imovel: string
  endereco: string
  bairro: string
  cidade: string
  estado: string
}

interface Chamado {
  id: string
  titulo: string
  descricao_problema: string
  categoria: string
  disponibilidade_atendimento: string
  status: StatusChamado
  criado_em: string
  responsabilidade: string
  imagens_problema?: string[] | null
  imagens_solucao?: string[] | null
  recebedor_nome?: string | null
  recebedor_telefone?: string | null
}

// Configuração visual dos status para a timeline
const STATUS_TIMELINE: { status: StatusChamado; label: string; desc: string }[] = [
  { status: 'aberto', label: 'Chamado Aberto', desc: 'Aguardando triagem inicial da imobiliária.' },
  { status: 'em_triagem', label: 'Em Triagem', desc: 'Imobiliária está analisando a responsabilidade.' },
  { status: 'aguardando_orcamento', label: 'Cotação técnica', desc: 'Prestadores de serviço enviando orçamentos.' },
  { status: 'orcamento_recebido', label: 'Orçamentos em análise', desc: 'Valores recebidos sob revisão.' },
  { status: 'analise_proprietario', label: 'Análise do Proprietário', desc: 'Aguardando autorização financeira do dono.' },
  { status: 'aguardando_autorizacao', label: 'Aprovação Final', desc: 'Falta clique final da imobiliária.' },
  { status: 'os_liberada', label: 'O.S. Liberada', desc: 'Ordem de serviço gerada e autorizada.' },
  { status: 'em_execucao', label: 'Serviço Iniciado', desc: 'O prestador está realizando o conserto.' },
  { status: 'servico_concluido', label: 'Serviço Concluído', desc: 'Trabalho finalizado. Aguardando homologação.' },
  { status: 'encerrado', label: 'Chamado Resolvido', desc: 'Serviço concluído e arquivado com sucesso.' }
]

export default function InquilinoDashboard() {
  const { user, perfil } = useAuth()
  
  // Dados do imóvel e chamados
  const [imovel, setImovel] = useState<Imovel | null>(null)
  const [chamadosAtivos, setChamadosAtivos] = useState<Chamado[]>([])
  const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null)
  const [historico, setHistorico] = useState<Chamado[]>([])

  // Controle de Abas
  const [activeTab, setActiveTab] = useState<string>("novo")
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false)
  
  // Loading e alertas
  const [loading, setLoading] = useState(true)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Campos do formulário
  const [titulo, setTitulo] = useState("")
  const [categoria, setCategoria] = useState("")
  const [categorias, setCategorias] = useState<{ id: string; nome: string; descricao: string | null }[]>([])
  const [descricao, setDescricao] = useState("")
  const [disponibilidade, setDisponibilidade] = useState("")
  const [recebedorNome, setRecebedorNome] = useState("")
  const [recebedorTelefone, setRecebedorTelefone] = useState("")
  const [imagens, setImagens] = useState<File[]>([])
  const [imagensPreview, setImagensPreview] = useState<string[]>([])

  const aplicarMascaraTelefone = (value: string) => {
    const limpo = value.replace(/\D/g, "")
    if (limpo.length <= 10) {
      return limpo
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2")
    } else {
      return limpo
        .substring(0, 11)
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
    }
  }
  
  // Referência do input de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados para galeria de mídias e zoom de imagens
  const [midias, setMidias] = useState<{ id: string; url_storage: string; tipo_midia: string }[]>([])
  const [urlImagemZoom, setUrlImagemZoom] = useState<string | null>(null)

  // Sincroniza o chamado ativo baseado na aba selecionada (activeTab)
  useEffect(() => {
    if (activeTab === "novo") {
      setChamadoAtivo(null)
    } else {
      const ativo = chamadosAtivos.find(c => c.id === activeTab)
      setChamadoAtivo(ativo || null)
    }
  }, [activeTab, chamadosAtivos])

  // Sincroniza mídias do chamado ativo do inquilino
  useEffect(() => {
    if (chamadoAtivo) {
      supabase
        .from("chamados_midias")
        .select("*")
        .eq("chamado_id", chamadoAtivo.id)
        .then(({ data, error }) => {
          if (error) {
            console.error("Erro ao buscar mídias:", error)
          } else {
            setMidias(data || [])
          }
        })
    } else {
      setMidias([])
    }
  }, [chamadoAtivo])

  // Função para carregar os dados do inquilino (imóvel e chamado)
  const loadInquilinoData = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    setErro(null)

    try {
      // 0. Busca as categorias dinâmicas do banco de dados
      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categorias")
        .select("*")
        .order("nome")
      if (categoriasError) throw categoriasError
      const cats = categoriasData || []
      setCategorias(cats)

      // 1. Busca o imóvel onde este usuário é inquilino
      const { data: imovelData, error: imovelError } = await supabase
        .from("imoveis")
        .select("id, codigo_imovel, endereco, bairro, cidade, estado")
        .eq("inquilino_id", user?.id)
        .maybeSingle()

      if (imovelError) throw imovelError
      setImovel(imovelData as Imovel)

      if (imovelData) {
        // 2. Busca todos os chamados deste inquilino
        const { data: chamadosData, error: chamadosError } = await supabase
          .from("chamados")
          .select("*")
          .eq("inquilino_id", user?.id)
          .order("criado_em", { ascending: false })

        if (chamadosError) throw chamadosError

        const listaChamados = (chamadosData || []).map(c => ({
          ...c,
          categoria: cats.find(cat => cat.id === c.categoria)?.nome || c.categoria
        })) as Chamado[]
        
        // Identifica se há chamados ativos (qualquer status que não seja encerrado ou reprovado)
        const ativos = listaChamados.filter(c => c.status !== 'encerrado' && c.status !== 'reprovado')
        const passados = listaChamados.filter(c => c.status === 'encerrado' || c.status === 'reprovado')
        
        setChamadosAtivos(ativos)
        setHistorico(passados)

        // Gerencia a seleção da aba ativa no carregamento
        if (!hasSetInitialTab) {
          if (ativos.length > 0) {
            setActiveTab(ativos[0].id)
          } else {
            setActiveTab("novo")
          }
          setHasSetInitialTab(true)
        } else {
          setActiveTab(currentTab => {
            if (currentTab === "novo") return "novo"
            const aindaExiste = ativos.some(c => c.id === currentTab)
            return aindaExiste ? currentTab : (ativos[0]?.id || "novo")
          })
        }
      }
    } catch (err: any) {
      console.error(err)
      setErro("Falha ao sincronizar dados. Verifique a conexão.")
    } finally {
      setLoading(false)
      setRealtimeLoading(false)
    }
  }

  // Monitora mudanças em tempo real e inicia o carregamento de dados
  useEffect(() => {
    if (user && perfil) {
      loadInquilinoData()

      // Registra o canal Realtime no Supabase
      const canal = supabase
        .channel("realtime-chamados-inquilino")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chamados",
            filter: `inquilino_id=eq.${user.id}`
          },
          async (_payload) => {
            // Recarrega silenciosamente
            await loadInquilinoData(true)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(canal)
      }
    }
  }, [user, perfil])

  // Trata a seleção de imagem e executa o compressor preventivo com limite de 3
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = e.target.files
    if (!arquivos || arquivos.length === 0) return

    const arrayArquivos = Array.from(arquivos)

    // Limite estrito de 3 imagens
    if (imagens.length + arrayArquivos.length > 3) {
      setErro("Erro: Limite estrito de até 3 imagens por chamado.")
      return
    }

    // Validar formatos (.png, .jpg, .jpeg)
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

      setImagens(prev => [...prev, ...arquivosComprimidos])
      setImagensPreview(prev => [...prev, ...previews])
    } catch (err: any) {
      console.error(err)
      setErro("Erro ao tentar processar e comprimir a imagem.")
    }
  }

  const removerImagem = (index: number) => {
    setImagens(prev => prev.filter((_, i) => i !== index))
    setImagensPreview(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  // Executa o envio e abertura do chamado
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    if (!imovel) {
      setErro("Erro: Você precisa de um imóvel vinculado para abrir um chamado.")
      setSalvando(false)
      return
    }

    if (!titulo || !categoria || !descricao || !disponibilidade) {
      setErro("Preencha todos os campos obrigatórios (*).")
      setSalvando(false)
      return
    }

    try {
      // 1. Cria o chamado na tabela chamados
      const { data: chamadoCriado, error: chamadoError } = await supabase
        .from("chamados")
        .insert({
          imovel_id: imovel.id,
          inquilino_id: user?.id,
          titulo,
          descricao_problema: descricao,
          categoria,
          disponibilidade_atendimento: disponibilidade,
          status: "aberto",
          recebedor_nome: recebedorNome.trim() || null,
          recebedor_telefone: recebedorTelefone.trim() || null
        })
        .select()
        .single()

      if (chamadoError) throw chamadoError

      // 2. Registra o histórico inicial de criação
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoCriado.id,
        usuario_id: user?.id,
        novo_status: "aberto",
        observacao: "Chamado registrado no sistema pelo inquilino."
      })

      // 3. Executa upload das imagens comprimidas para o bucket chamados
      const urlsImagens: string[] = []
      if (imagens.length > 0) {
        for (let i = 0; i < imagens.length; i++) {
          const img = imagens[i]
          const extensao = img.type.split("/")[1] || "jpg"
          const caminho = `${chamadoCriado.id}/problema/img_${i}_${Date.now()}.${extensao}`

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

        // Salva o array de URLs na coluna imagens_problema
        const { error: updateError } = await supabase
          .from("chamados")
          .update({ imagens_problema: urlsImagens })
          .eq("id", chamadoCriado.id)

        if (updateError) throw updateError
      }

      setSucesso("Chamado de manutenção aberto com sucesso!")
      
      // Limpa os campos
      setTitulo("")
      setCategoria("")
      setDescricao("")
      setDisponibilidade("")
      setRecebedorNome("")
      setRecebedorTelefone("")
      setImagens([])
      setImagensPreview([])
      if (fileInputRef.current) fileInputRef.current.value = ""

      // Define a aba ativa para o novo chamado
      setActiveTab(chamadoCriado.id)

      // Recarrega os dados
      await loadInquilinoData()

    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro inesperado ao salvar chamado.")
    } finally {
      setSalvando(false)
    }
  }

  // Obtém o índice do status atual para desenhar a timeline de progresso
  const getIndiceStatusAtual = (statusAtual: StatusChamado) => {
    if (statusAtual === 'reprovado') return -1
    return STATUS_TIMELINE.findIndex(item => item.status === statusAtual)
  }

  // Removida constante de timeline simplificada não utilizada

  return (
    <div className="container mx-auto px-4 py-8 max-w-md md:max-w-xl bg-slate-50 min-h-screen pb-20">
      
      {/* Informações do Imóvel Vinculado */}
      <div className="mb-6 flex justify-between items-center bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-occasio-blue/10 rounded-lg text-occasio-blue">
            <Landmark className="h-6 w-6" />
          </div>
          {loading ? (
            <div className="space-y-1.5 animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded"></div>
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
            </div>
          ) : imovel ? (
            <div>
              <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded font-mono font-bold">
                Código: {imovel.codigo_imovel}
              </span>
              <h4 className="text-sm font-extrabold text-occasio-navy mt-1 leading-tight">{imovel.endereco}</h4>
              <p className="text-[11px] text-slate-400">{imovel.bairro} - {imovel.cidade}/{imovel.estado}</p>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-extrabold text-red-500 leading-tight">Imóvel Não Vinculado</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">Aguarde a imobiliária vincular seu cadastro ao contrato de locação.</p>
            </div>
          )}
        </div>
        <div>
          {realtimeLoading && (
            <RefreshCw className="h-4 w-4 text-occasio-blue animate-spin" />
          )}
        </div>
      </div>

      {/* Card de Instalação PWA e Notificações Push */}
      <div className="mb-6">
        <PWANotificacoesCard />
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
          <span>Verificando chamados de manutenção...</span>
        </div>
      ) : (
        <>
          {/* Abas de Chamados */}
          {imovel && (
            <div className="flex items-center gap-2 border-b border-slate-200 pb-px mb-6 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                type="button"
                onClick={() => setActiveTab("novo")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 ${
                  activeTab === "novo"
                    ? "border-occasio-blue text-occasio-blue font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Plus className="h-4 w-4" />
                Nova Solicitação
              </button>
              
              {chamadosAtivos.map((chamado) => {
                const isSelected = activeTab === chamado.id
                return (
                  <button
                    type="button"
                    key={chamado.id}
                    onClick={() => setActiveTab(chamado.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 ${
                      isSelected
                        ? "border-occasio-blue text-occasio-blue font-extrabold"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Wrench className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{chamado.titulo}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1 py-0.5 rounded font-mono font-bold uppercase">
                      {chamado.status.replace("_", " ")}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {activeTab !== "novo" && chamadoAtivo ? (
            /* ======================== VISUALIZAÇÃO DE CHAMADO ATIVO ======================== */
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-md bg-white">
                <CardHeader className="bg-occasio-navy text-white rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                        {chamadoAtivo.categoria}
                      </span>
                      <CardTitle className="text-base font-extrabold mt-1">{chamadoAtivo.titulo}</CardTitle>
                    </div>
                    <Badge className="bg-occasio-blue text-white hover:bg-occasio-blue px-2.5 py-0.5 rounded-full border border-white/20 text-[10px] font-bold uppercase tracking-wide">
                      {chamadoAtivo.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4 text-sm text-slate-700">
                  <div>
                    <strong className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Descrição do Problema</strong>
                    <p className="bg-slate-50 p-3 rounded text-slate-600 border border-slate-200/50 leading-relaxed text-xs">
                      {chamadoAtivo.descricao_problema}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <strong className="font-semibold text-slate-400 block mb-0.5">Disponibilidade</strong>
                      <span className="text-slate-700 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-occasio-blue" /> {chamadoAtivo.disponibilidade_atendimento}
                      </span>
                    </div>
                    <div>
                      <strong className="font-semibold text-slate-400 block mb-0.5">Abertura</strong>
                      <span className="text-slate-700">
                        {new Date(chamadoAtivo.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Galeria de Fotos com Zoom */}
                  {((chamadoAtivo.imagens_problema && chamadoAtivo.imagens_problema.length > 0) || 
                    (chamadoAtivo.imagens_solucao && chamadoAtivo.imagens_solucao.length > 0) || 
                    midias.length > 0) && (
                    <div className="pt-4 border-t border-slate-100 mt-2 space-y-4">
                      {/* Fotos do Problema */}
                      {((chamadoAtivo.imagens_problema && chamadoAtivo.imagens_problema.length > 0) || midias.some(m => m.tipo_midia === 'antes')) && (
                        <div>
                          <strong className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Fotos do Problema (Antes)</strong>
                          <div className="grid grid-cols-3 gap-2">
                            {chamadoAtivo.imagens_problema?.map((url, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => setUrlImagemZoom(url)}
                                className="relative aspect-square rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
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
                                className="relative aspect-square rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
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
                          <strong className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Fotos da Solução (Depois)</strong>
                          <div className="grid grid-cols-3 gap-2">
                            {chamadoAtivo.imagens_solucao?.map((url, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => setUrlImagemZoom(url)}
                                className="relative aspect-square rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
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
                                className="relative aspect-square rounded border overflow-hidden bg-slate-100 cursor-pointer group hover:border-occasio-blue transition-all"
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

              {/* Linha do Tempo Reativa (Timeline PWA) */}
              <Card className="border-slate-200 shadow-md bg-white">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-extrabold text-occasio-navy">Acompanhamento do Conserto</CardTitle>
                  <CardDescription className="text-xs">Timeline atualizada automaticamente a cada mudança.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="relative pl-6 border-l border-slate-200 space-y-6">
                    {STATUS_TIMELINE.map((item, idx) => {
                      const indiceAtual = getIndiceStatusAtual(chamadoAtivo.status)
                      const isPassou = idx < indiceAtual
                      const isAtivo = chamadoAtivo.status === item.status || (idx === indiceAtual)
                      const isFuturo = idx > indiceAtual && !isAtivo

                      return (
                        <div key={item.status} className="relative">
                          {/* Indicador de Bolinha da Timeline */}
                          <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all ${
                            isPassou ? "bg-green-500 border-green-500 text-white" :
                            isAtivo ? "bg-white border-occasio-blue ring-2 ring-occasio-blue/20" :
                            "bg-white border-slate-200"
                          }`}>
                            {isPassou && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </span>

                          {/* Conteúdo Textual */}
                          <div className={isFuturo ? "opacity-45" : ""}>
                            <h4 className={`text-xs font-bold leading-none ${isAtivo ? "text-occasio-blue text-sm font-extrabold" : "text-slate-700"}`}>
                              {item.label}
                            </h4>
                            {isAtivo && (
                              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                {item.desc}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : imovel ? (
            /* ======================== FORMULÁRIO DE CADASTRO DE CHAMADO ======================== */
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-extrabold text-occasio-navy flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-occasio-blue" /> Solicitar Manutenção
                </CardTitle>
                <CardDescription className="text-xs">
                  Descreva o problema no imóvel para que possamos enviar um técnico parceiro.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Título do Chamado (O que aconteceu?) *
                    </label>
                    <Input
                      placeholder="Ex: Vazamento sob a pia da cozinha"
                      value={titulo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitulo(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Categoria da Ocorrência *
                    </label>
                    <select
                      value={categoria}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoria(e.target.value)}
                      required
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                    >
                      <option value="">Selecione a Categoria...</option>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nome} {cat.descricao ? `(${cat.descricao})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Descrição Detalhada do Problema *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Descreva detalhadamente o problema. Ex: O cano de entrada de água sob a pia está gotejando muito quando a torneira é aberta, alagando o gabinete."
                      value={descricao}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescricao(e.target.value)}
                      required
                      className="w-full border border-slate-200 rounded-md p-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Melhores Dias e Horários para Atendimento *
                    </label>
                    <Input
                      placeholder="Ex: Seg a Sex das 14h às 18h"
                      value={disponibilidade}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisponibilidade(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nome do Responsável no Local <span className="text-slate-400 font-normal">(Opcional - Fallback: Inquilino)</span>
                      </label>
                      <Input
                        placeholder="Nome de quem receberá o técnico"
                        value={recebedorNome}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecebedorNome(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Telefone do Responsável <span className="text-slate-400 font-normal">(Opcional - Fallback: Inquilino)</span>
                      </label>
                      <Input
                        placeholder="Ex: (99) 99999-9999"
                        value={recebedorTelefone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecebedorTelefone(aplicarMascaraTelefone(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fotos do Problema (Upload de até 3 fotos)
                    </label>
                    <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      {imagensPreview.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 w-full mb-3">
                          {imagensPreview.map((preview, index) => (
                            <div key={index} className="relative border rounded-md overflow-hidden aspect-square bg-slate-100">
                              <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removerImagem(index)}
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
                          <Camera className="h-8 w-8 text-slate-400" />
                          <div className="flex text-xs text-slate-500">
                            <label className="relative cursor-pointer bg-white rounded-md font-semibold text-occasio-blue hover:text-occasio-navy focus-within:outline-none">
                              <span>Tirar Foto / Selecionar Arquivo ({imagensPreview.length}/3)</span>
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
                          <p className="text-[10px] text-slate-400">Aceita .png, .jpg, .jpeg. Compressão automática acima de 2MB (max 1200px).</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    disabled={salvando} 
                    type="submit" 
                    className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-semibold h-10 shadow-md"
                  >
                    {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar Chamado
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* Aviso de cadastro sem imóvel */
            <Card className="border-slate-200 border-dashed bg-slate-100/50 shadow-none py-16 px-6 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center gap-3">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <div className="text-sm font-semibold text-slate-600">Aguardando Vinculação do Imóvel</div>
                <p className="max-w-xs mx-auto text-xs text-slate-400 leading-relaxed">
                  O seu perfil de inquilino ainda não possui nenhum imóvel ativo associado. Por favor, entre em contato com sua Imobiliária para que eles cadastrem e vinculem o imóvel ao seu perfil.
                </p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Histórico Simplificado de Chamados Resolvidos */}
      {historico.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
            <History className="h-4 w-4" /> Histórico de Chamados
          </h3>
          <div className="space-y-3">
            {historico.map((item) => (
              <Card key={item.id} className="border-slate-200 shadow-sm bg-white/70 hover:bg-white transition-all">
                <CardContent className="p-4 flex justify-between items-center text-xs">
                  <div>
                    <h4 className="font-extrabold text-slate-700">{item.titulo}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Encerrado em: {new Date(item.criado_em).toLocaleDateString('pt-BR')} | Categoria: {item.categoria}
                    </p>
                  </div>
                  <Badge className={`${
                    item.status === 'encerrado' ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-red-50 text-red-700 border-red-200"
                  } border text-[9px] font-bold uppercase`}>
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Zoom Avançado para Vistoria */}
      {urlImagemZoom && (
        <VisualizadorImagem 
          src={urlImagemZoom} 
          onClose={() => setUrlImagemZoom(null)} 
        />
      )}
      
    </div>
  )
}
