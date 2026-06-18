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
  Camera, Wrench, CheckCircle2, Loader2, RefreshCw, HelpCircle, DollarSign, Hammer, AlertCircle
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
  imovel_id: string
  inquilino_id: string
  imovel: {
    codigo_imovel: string
    endereco: string
    bairro: string
  }
  inquilino: {
    nome: string
  }
}

export default function PrestadorDashboard() {
  const { user, perfil } = useAuth()
  
  // Abas do PWA (orcamentos ou ordens_servico)
  const [activeTab, setActiveTab] = useState<"orcamentos" | "os">("orcamentos")
  
  // Dados das listas
  const [chamadosPendentes, setChamadosPendentes] = useState<Chamado[]>([])
  const [osAtivas, setOsAtivas] = useState<Chamado[]>([])
  
  // Loading e alertas
  const [loading, setLoading] = useState(true)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Formulário de Cotação
  const [chamadoCotando, setChamadoCotando] = useState<Chamado | null>(null)
  const [valorServico, setValorServico] = useState("")
  const [valorMateriais, setValorMateriais] = useState("0.00")
  const [prazo, setPrazo] = useState("")
  const [observacoes, setObservacoes] = useState("")

  // Formulário de Conclusão de OS
  const [chamadoConcluindo, setChamadoConcluindo] = useState<Chamado | null>(null)
  const [relatorio, setRelatorio] = useState("")
  const [imagemDepois, setImagemDepois] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega listagens do prestador
  const loadPrestadorData = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    else setRealtimeLoading(true)
    setErro(null)

    try {
      // 1. Carrega chamados aguardando orçamento no status 'aguardando_orcamento'
      // E garante que este prestador ainda NÃO tenha enviado orçamento para este chamado
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
          inquilino:inquilino_id (nome)
        `)
        .eq("status", "aguardando_orcamento")
        .order("criado_em", { ascending: false })

      if (idsJaCotados.length > 0) {
        queryPendentes = queryPendentes.not("id", "in", `(${idsJaCotados.join(",")})`)
      }

      const { data: pendentesData, error: pendentesError } = await queryPendentes
      if (pendentesError) throw pendentesError
      setChamadosPendentes(pendentesData as unknown as Chamado[] || [])

      // 2. Carrega Ordens de Serviço Ativas (status 'os_liberada' ou 'em_execucao')
      // que estejam vinculadas a um orçamento deste prestador de serviço
      const { data: osData, error: osError } = await supabase
        .from("chamados")
        .select(`
          *,
          imovel:imovel_id (codigo_imovel, endereco, bairro),
          inquilino:inquilino_id (nome),
          orcamentos!inner (prestador_id)
        `)
        .eq("orcamentos.prestador_id", user?.id)
        .in("status", ["os_liberada", "em_execucao"])
        .order("criado_em", { ascending: false })

      if (osError) throw osError
      setOsAtivas(osData as unknown as Chamado[] || [])

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
  }, [user, perfil])

  // Trata envio da proposta de orçamento
  const handleEnviarOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chamadoCotando) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    if (!valorServico || !prazo) {
      setErro("Preencha o valor de serviço e o prazo de execução.")
      setSalvando(false)
      return
    }

    try {
      // 1. Cria o registro na tabela orcamentos
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .insert({
          chamado_id: chamadoCotando.id,
          prestador_id: user?.id,
          valor_servico_r$: parseFloat(valorServico),
          valor_materiais_r$: parseFloat(valorMateriais),
          prazo_execucao_dias: parseInt(prazo),
          observacoes_tecnicas: observacoes
        })

      if (orcamentoError) throw orcamentoError

      // 2. Atualiza o status do chamado correspondente para 'orcamento_recebido'
      const { error: chamadoError } = await supabase
        .from("chamados")
        .update({ status: "orcamento_recebido" })
        .eq("id", chamadoCotando.id)

      if (chamadoError) throw chamadoError

      // 3. Insere registro de alteração de status no histórico
      await supabase.from("historico_chamados").insert({
        chamado_id: chamadoCotando.id,
        usuario_id: user?.id,
        status_anterior: "aguardando_orcamento" as StatusChamado,
        novo_status: "orcamento_recebido" as StatusChamado,
        observacao: `Orçamento técnico de R$ ${(parseFloat(valorServico) + parseFloat(valorMateriais)).toFixed(2)} enviado pelo prestador ${perfil?.nome}.`
      })

      setSucesso("Orçamento enviado com sucesso!")
      setChamadoCotando(null)
      setValorServico("")
      setValorMateriais("0.00")
      setPrazo("")
      setObservacoes("")

      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar enviar proposta.")
    } finally {
      setSalvando(false)
    }
  }

  // Altera status da OS de os_liberada para em_execucao
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
        observacao: "Serviço iniciado no local pelo prestador."
      })

      setSucesso("Ordem de serviço iniciada! Bom trabalho.")
      await loadPrestadorData()
    } catch (err: any) {
      console.error(err)
      setErro("Falha ao atualizar chamado.")
    }
  }

  // Trata seleção de imagem da conclusão e roda o compressor Canvas
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

  // Envia a conclusão de serviço (em_execucao -> servico_concluido)
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
      const { error: orcamentoError } = await supabase
        .from("orcamentos")
        .update({
          relatorio_conclusao: relatorio,
          data_agendamento_servico: new Date().toISOString()
        })
        .eq("chamado_id", chamadoConcluindo.id)
        .eq("prestador_id", user?.id)

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
        observacao: "Execução finalizada pelo técnico. Relatório e imagem do conserto enviados."
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
            <Hammer className="h-6 w-6 text-occasio-blue" /> Painel do Prestador
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestão de cotações e execução técnica.</p>
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
      <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1.5 rounded-lg mb-6">
        <button
          onClick={() => { setActiveTab("orcamentos"); setChamadoCotando(null); setChamadoConcluindo(null) }}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "orcamentos" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Orçamentos Pendentes ({chamadosPendentes.length})
        </button>
        <button
          onClick={() => { setActiveTab("os"); setChamadoCotando(null); setChamadoConcluindo(null) }}
          className={`py-2 text-xs font-bold rounded-md transition-all ${
            activeTab === "os" 
              ? "bg-white text-occasio-navy shadow-sm" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          OS Ativas ({osAtivas.length})
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
          {activeTab === "orcamentos" && !chamadoCotando && (
            <div className="space-y-4">
              {chamadosPendentes.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-3">
                  <HelpCircle className="h-10 w-10 text-slate-300" />
                  <div className="font-semibold text-slate-500">Nenhum chamado pendente</div>
                  <p className="max-w-xs mx-auto text-[11px] text-slate-400">
                    Aguarde a imobiliária enviar novas solicitações de cotação para você.
                  </p>
                </div>
              ) : (
                chamadosPendentes.map((chamado) => (
                  <Card key={chamado.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all bg-white">
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold text-[9px]">
                            {chamado.imovel?.codigo_imovel || "Sem Código"}
                          </span>
                          <h3 className="font-extrabold text-occasio-navy text-sm mt-1">{chamado.titulo}</h3>
                        </div>
                        <Badge className="bg-yellow-50 text-yellow-800 border-yellow-200 border text-[9px] font-bold">
                          Cotar
                        </Badge>
                      </div>
                      <p className="text-slate-500 line-clamp-2 leading-relaxed">{chamado.descricao_problema}</p>
                      
                      <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-2.5">
                        <span>Endereço: <strong>{chamado.imovel?.endereco || "Não disponível"}</strong></span>
                        <Button 
                          onClick={() => setChamadoCotando(chamado)} 
                          size="sm" 
                          className="bg-occasio-blue hover:bg-occasio-navy text-white text-[10px] px-2 h-7 font-bold"
                        >
                          Enviar Orçamento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ======================== FORMULÁRIO DE ENVIO DE ORÇAMENTO ======================== */}
          {activeTab === "orcamentos" && chamadoCotando && (
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy">Proposta de Orçamento</CardTitle>
                <CardDescription className="text-xs">Para: {chamadoCotando.titulo}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleEnviarOrcamento} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded border text-xs text-slate-600 mb-2">
                    <strong>Detalhes da ocorrência:</strong>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed bg-white border p-2 rounded">{chamadoCotando.descricao_problema}</p>
                    <p className="mt-2 text-[10px]">Visitação técnica preferencial: <strong>{chamadoCotando.disponibilidade_atendimento}</strong></p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Mão de Obra (R$) *
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={valorServico}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorServico(e.target.value)}
                          required
                        />
                        <DollarSign className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Materiais (R$)
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={valorMateriais}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorMateriais(e.target.value)}
                        />
                        <DollarSign className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    </div>
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
                      Observações Técnicas
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Incluso troca de válvula hydra de latão e lixamento do cano."
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
                      {salvando ? "Enviando..." : "Enviar Proposta"}
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
                    Ordens de serviço liberadas pelas imobiliárias aparecerão aqui.
                  </p>
                </div>
              ) : (
                osAtivas.map((chamado) => (
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
                          {chamado.status.replace("_", " ")}
                        </Badge>
                      </div>
                      
                      <div className="p-2.5 bg-slate-50 rounded border text-[11px] leading-relaxed text-slate-600">
                        <strong>Endereço:</strong> {chamado.imovel?.endereco || "Não disponível"} ({chamado.imovel?.bairro || ""})<br/>
                        <strong>Inquilino:</strong> {chamado.inquilino?.nome || "Não informado"}
                      </div>

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
                ))
              )}
            </div>
          )}

          {/* ======================== FORMULÁRIO DE ENTREGA DE SERVIÇO (CONCLUSÃO) ======================== */}
          {activeTab === "os" && chamadoConcluindo && (
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
                <CardTitle className="text-sm font-extrabold text-occasio-navy">Concluir Ordem de Serviço</CardTitle>
                <CardDescription className="text-xs">Para: {chamadoConcluindo.titulo}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleConcluirServico} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Relatório Técnico de Conclusão *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Descreva as ações realizadas para sanar o problema técnico."
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
                          <p className="text-[9px] text-slate-400">Comprimido pelo Canvas antes de enviar.</p>
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
    </div>
  )
}
