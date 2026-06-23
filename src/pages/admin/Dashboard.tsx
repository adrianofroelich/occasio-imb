import { useEffect, useState } from "react"
import { supabase, obterMensagemErroEdge } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, Landmark, HardHat, Link2, Trash2, RefreshCw, Loader2, Plus, 
  CheckCircle, AlertCircle, Phone, FileText, Mail
} from "lucide-react"

// Tipagens
interface PerfilUsuario {
  id: string
  nome: string
  email: string | null
  perfil: 'super_admin' | 'imobiliaria' | 'prestador' | 'inquilino' | 'proprietario'
  primeiro_acesso_pendente: boolean
  telefone: string | null
  documento_identificacao: string | null
  criado_em: string
  creci?: string | null
  cep?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  tipo_repasse?: 'mensal' | 'quinzenal' | 'semanal' | 'por_servico' | null
  prazo_repasse_dias?: number | null
}

interface Vinculo {
  id: string
  imobiliaria_id: string
  empresa_prestadora_id: string
  imobiliaria: {
    nome: string
  }
  empresa: {
    nome: string
  }
}

// Máscaras de digitação pt-BR
const aplicarMascaraCNPJ = (val: string) => {
  const digitos = val.replace(/\D/g, "").slice(0, 14)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`
  if (digitos.length <= 12) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`
}

const aplicarMascaraTelefone = (val: string) => {
  const digitos = val.replace(/\D/g, "").slice(0, 11)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

const aplicarMascaraCEP = (val: string) => {
  const digitos = val.replace(/\D/g, "").slice(0, 8)
  if (digitos.length <= 5) return digitos
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

export default function AdminDashboard() {
  const { user, perfil: authPerfil } = useAuth()
  const navigate = useNavigate()

  // Controle de abas
  const [activeTab, setActiveTab] = useState<"imobiliarias" | "prestadoras" | "vinculos">("imobiliarias")

  // Listagens
  const [imobiliarias, setImobiliarias] = useState<PerfilUsuario[]>([])
  const [empresas, setEmpresas] = useState<PerfilUsuario[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])

  // Formulário: Imobiliárias
  const [imobNome, setImobNome] = useState("")
  const [imobCnpj, setImobCnpj] = useState("")
  const [imobEmail, setImobEmail] = useState("")
  const [imobTelefone, setImobTelefone] = useState("")
  const [imobCreci, setImobCreci] = useState("")
  const [imobCep, setImobCep] = useState("")
  const [imobEndereco, setImobEndereco] = useState("")
  const [imobBairro, setImobBairro] = useState("")
  const [imobCidade, setImobCidade] = useState("")
  const [imobEstado, setImobEstado] = useState("")
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [imobTipoRepasse, setImobTipoRepasse] = useState<"mensal" | "quinzenal" | "semanal" | "por_servico" | "">("")
  const [imobPrazoRepasseDias, setImobPrazoRepasseDias] = useState<number | "">("")

  // Formulário: Prestadoras
  const [prestNome, setPrestNome] = useState("")
  const [prestCnpj, setPrestCnpj] = useState("")
  const [prestEmail, setPrestEmail] = useState("")
  const [prestTelefone, setPrestTelefone] = useState("")
  const [prestTipoRepasse, setPrestTipoRepasse] = useState<"mensal" | "quinzenal" | "semanal" | "por_servico" | "">("")
  const [prestPrazoRepasseDias, setPrestPrazoRepasseDias] = useState<number | "">("")

  // Formulário: Vínculos
  const [vinculoImobiliariaId, setVinculoImobiliariaId] = useState("")
  const [vinculoEmpresaId, setVinculoEmpresaId] = useState("")

  // Estados de Edição
  const [perfilEditando, setPerfilEditando] = useState<PerfilUsuario | null>(null)
  const [editNome, setEditNome] = useState("")
  const [editCnpj, setEditCnpj] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editTelefone, setEditTelefone] = useState("")
  const [editCreci, setEditCreci] = useState("")
  const [editCep, setEditCep] = useState("")
  const [editEndereco, setEditEndereco] = useState("")
  const [editBairro, setEditBairro] = useState("")
  const [editCidade, setEditCidade] = useState("")
  const [editEstado, setEditEstado] = useState("")
  const [editTipoRepasse, setEditTipoRepasse] = useState<"mensal" | "quinzenal" | "semanal" | "por_servico" | "">("")
  const [editPrazoRepasseDias, setEditPrazoRepasseDias] = useState<number | "">("")
  const [editando, setEditando] = useState(false)

  // Estados de Exclusão Crítica
  const [perfilParaExcluir, setPerfilParaExcluir] = useState<PerfilUsuario | null>(null)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("")
  const [excluindo, setExcluindo] = useState(false)

  // Loading e alertas
  const [loadingData, setLoadingData] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Segurança: bloquear se não for super admin
  useEffect(() => {
    if (!loadingData && authPerfil?.perfil !== "super_admin") {
      navigate("/")
    }
  }, [authPerfil, loadingData, navigate])

  // Busca geral de dados do banco
  const carregarDados = async (silencioso = false) => {
    if (!silencioso) setLoadingData(true)
    setErro(null)

    try {
      // 1. Busca imobiliárias
      const { data: imobData, error: imobError } = await supabase
        .from("perfis")
        .select("*")
        .eq("perfil", "imobiliaria")
        .order("nome")
      if (imobError) throw imobError
      setImobiliarias(imobData as PerfilUsuario[] || [])

      // 2. Busca empresas prestadoras PJ (perfil = prestador e sem empresa_mae_id)
      const { data: empData, error: empError } = await supabase
        .from("perfis")
        .select("*")
        .eq("perfil", "prestador")
        .is("empresa_mae_id", null)
        .order("nome")
      if (empError) throw empError
      setEmpresas(empData as PerfilUsuario[] || [])

      // 3. Busca vínculos comerciais
      const { data: vincData, error: vincError } = await supabase
        .from("vinculos_saas")
        .select(`
          id,
          imobiliaria_id,
          empresa_prestadora_id,
          imobiliaria:imobiliaria_id (nome),
          empresa:empresa_prestadora_id (nome)
        `)
        .order("criado_em", { ascending: false })
      if (vincError) throw vincError
      setVinculos(vincData as unknown as Vinculo[] || [])

    } catch (err: any) {
      console.error(err)
      setErro("Falha ao carregar dados operacionais do SaaS.")
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (user && authPerfil?.perfil === "super_admin") {
      carregarDados()
    } else if (user) {
      setLoadingData(false)
    }
  }, [user, authPerfil])

  // Busca automática CEP para Imobiliária
  const handleCepChange = async (valorCep: string) => {
    const formatado = aplicarMascaraCEP(valorCep)
    setImobCep(formatado)
    const limpo = valorCep.replace(/\D/g, "")

    if (limpo.length === 8) {
      setBuscandoCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setImobEndereco(data.logradouro || "")
          setImobBairro(data.bairro || "")
          setImobCidade(data.localidade || "")
          setImobEstado(data.uf || "")
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err)
      } finally {
        setBuscandoCep(false)
      }
    }
  }

  // Busca automática CEP para Edição
  const handleCepChangeEdit = async (valorCep: string) => {
    const formatado = aplicarMascaraCEP(valorCep)
    setEditCep(formatado)
    const limpo = valorCep.replace(/\D/g, "")

    if (limpo.length === 8) {
      setBuscandoCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setEditEndereco(data.logradouro || "")
          setEditBairro(data.bairro || "")
          setEditCidade(data.localidade || "")
          setEditEstado(data.uf || "")
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err)
      } finally {
        setBuscandoCep(false)
      }
    }
  }

  // Edição
  const handleAbrirEdicao = (p: PerfilUsuario) => {
    setPerfilEditando(p)
    setEditNome(p.nome || "")
    setEditCnpj(p.documento_identificacao ? aplicarMascaraCNPJ(p.documento_identificacao) : "")
    setEditEmail(p.email || "")
    setEditTelefone(p.telefone ? aplicarMascaraTelefone(p.telefone) : "")
    setEditCreci(p.creci || "")
    setEditCep(p.cep ? aplicarMascaraCEP(p.cep) : "")
    setEditEndereco(p.endereco || "")
    setEditBairro(p.bairro || "")
    setEditCidade(p.cidade || "")
    setEditEstado(p.estado || "")
    setEditTipoRepasse(p.tipo_repasse || "")
    setEditPrazoRepasseDias(p.prazo_repasse_dias ?? "")
    setErro(null)
    setSucesso(null)
  }

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!perfilEditando) return
    setEditando(true)
    setErro(null)
    setSucesso(null)

    try {
      // 1. Se alterou o e-mail, atualiza no Supabase Auth via Edge Function
      const emailAlterado = editEmail.trim().toLowerCase() !== (perfilEditando.email || "").trim().toLowerCase()
      
      const { error: edgeError } = await supabase.functions.invoke("admin-helper", {
        body: {
          action: "atualizar-usuario",
          userId: perfilEditando.id,
          email: emailAlterado ? editEmail.trim().toLowerCase() : undefined,
          nome: editNome.trim(),
          perfil: perfilEditando.perfil,
          telefone: editTelefone.replace(/\D/g, "") ? editTelefone : null,
          documento: editCnpj.replace(/\D/g, "") ? editCnpj : null,
          creci: perfilEditando.perfil === "imobiliaria" && editCreci.trim() ? editCreci.trim() : null,
          cep: editCep.replace(/\D/g, "") ? editCep : null,
          endereco: editEndereco.trim() || null,
          bairro: editBairro.trim() || null,
          cidade: editCidade.trim() || null,
          estado: editEstado.trim().toUpperCase() || null,
          tipo_repasse: editTipoRepasse || null,
          prazo_repasse_dias: editPrazoRepasseDias !== "" ? Number(editPrazoRepasseDias) : null
        }
      })

      if (edgeError) {
        const msg = await obterMensagemErroEdge(edgeError)
        throw new Error(msg)
      }

      // 2. Atualiza a tabela public.perfis diretamente
      const { error: dbError } = await supabase
        .from("perfis")
        .update({
          nome: editNome.trim(),
          email: editEmail.trim().toLowerCase(),
          documento_identificacao: editCnpj.replace(/\D/g, "") ? editCnpj : null,
          telefone: editTelefone.replace(/\D/g, "") ? editTelefone : null,
          creci: perfilEditando.perfil === "imobiliaria" && editCreci.trim() ? editCreci.trim() : null,
          cep: editCep.replace(/\D/g, "") ? editCep : null,
          endereco: editEndereco.trim() || null,
          bairro: editBairro.trim() || null,
          cidade: editCidade.trim() || null,
          estado: editEstado.trim().toUpperCase() || null,
          tipo_repasse: editTipoRepasse || null,
          prazo_repasse_dias: editPrazoRepasseDias !== "" ? Number(editPrazoRepasseDias) : null
        })
        .eq("id", perfilEditando.id)

      if (dbError) throw dbError

      setSucesso(`Dados de "${editNome}" atualizados com sucesso!`)
      setPerfilEditando(null)
      await carregarDados(true)
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao atualizar dados do parceiro.")
    } finally {
      setEditando(false)
    }
  }

  // Exclusão em Cascata
  const handleConfirmarExclusao = async () => {
    if (!perfilParaExcluir) return
    if (confirmacaoTexto !== "EXCLUIR") {
      setErro("Palavra de confirmação incorreta. Digite EXCLUIR para confirmar.")
      return
    }

    setExcluindo(true)
    setErro(null)
    setSucesso(null)

    try {
      const { error: edgeError } = await supabase.functions.invoke("admin-helper", {
        body: {
          action: "deletar-usuario",
          userId: perfilParaExcluir.id
        }
      })

      if (edgeError) {
        const msg = await obterMensagemErroEdge(edgeError)
        throw new Error(msg)
      }

      setSucesso(`Parceiro "${perfilParaExcluir.nome}" e todos os seus dados dependentes foram excluídos em cascata!`)
      setPerfilParaExcluir(null)
      setConfirmacaoTexto("")
      await carregarDados(true)
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar excluir parceiro em cascata.")
    } finally {
      setExcluindo(false)
    }
  }

  // Processa cadastro de Imobiliária
  const handleCadastrarImobiliaria = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imobNome || !imobCnpj || !imobEmail || !imobCreci || !imobCep) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      // Dispara criação segura no Supabase Auth em background via Edge Function
      const { data, error: edgeError } = await supabase.functions.invoke("admin-helper", {
        body: {
          action: "criar-cliente",
          email: imobEmail.trim().toLowerCase(),
          password: "occasio12345", // senha de acesso padrão inicial
          nome: imobNome.trim(),
          perfil: "imobiliaria",
          telefone: imobTelefone || null,
          documento: imobCnpj,
          creci: imobCreci.trim(),
          cep: imobCep,
          endereco: imobEndereco.trim() || null,
          bairro: imobBairro.trim() || null,
          cidade: imobCidade.trim() || null,
          estado: imobEstado.trim().toUpperCase() || null,
          tipo_repasse: imobTipoRepasse || null,
          prazo_repasse_dias: imobPrazoRepasseDias !== "" ? Number(imobPrazoRepasseDias) : null
        }
      })

      if (edgeError) {
        const msg = await obterMensagemErroEdge(edgeError)
        throw new Error(msg)
      }
      if (data?.error) {
        const msg = await obterMensagemErroEdge({ message: data.error })
        throw new Error(msg)
      }

      setSucesso(`Imobiliária "${imobNome}" cadastrada com sucesso! Senha temporária: occasio12345`)
      setImobNome("")
      setImobCnpj("")
      setImobEmail("")
      setImobTelefone("")
      setImobCreci("")
      setImobCep("")
      setImobEndereco("")
      setImobBairro("")
      setImobCidade("")
      setImobEstado("")
      setImobTipoRepasse("")
      setImobPrazoRepasseDias("")
      await carregarDados(true)
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar registrar imobiliária.")
    } finally {
      setSalvando(false)
    }
  }

  // Processa cadastro de Empresa Prestadora
  const handleCadastrarPrestadora = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prestNome || !prestCnpj || !prestEmail) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      // Dispara criação segura no Supabase Auth em background via Edge Function
      const { data, error: edgeError } = await supabase.functions.invoke("admin-helper", {
        body: {
          action: "criar-cliente",
          email: prestEmail.trim().toLowerCase(),
          password: "occasio12345", // senha de acesso padrão inicial
          nome: prestNome.trim(),
          perfil: "prestador",
          telefone: prestTelefone || null,
          documento: prestCnpj,
          tipo_repasse: prestTipoRepasse || null,
          prazo_repasse_dias: prestPrazoRepasseDias !== "" ? Number(prestPrazoRepasseDias) : null
        }
      })

      if (edgeError) {
        const msg = await obterMensagemErroEdge(edgeError)
        throw new Error(msg)
      }
      if (data?.error) {
        const msg = await obterMensagemErroEdge({ message: data.error })
        throw new Error(msg)
      }

      setSucesso(`Empresa Prestadora "${prestNome}" cadastrada com sucesso! Senha temporária: occasio12345`)
      setPrestNome("")
      setPrestCnpj("")
      setPrestEmail("")
      setPrestTelefone("")
      setPrestTipoRepasse("")
      setPrestPrazoRepasseDias("")
      await carregarDados(true)
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar registrar empresa prestadora.")
    } finally {
      setSalvando(false)
    }
  }

  // Estabelece Vínculo Comercial
  const handleCriarVinculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vinculoImobiliariaId || !vinculoEmpresaId) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      const { error } = await supabase
        .from("vinculos_saas")
        .insert({
          imobiliaria_id: vinculoImobiliariaId,
          empresa_prestadora_id: vinculoEmpresaId
        })

      if (error) {
        if (error.code === "23505") {
          throw new Error("Este vínculo comercial já existe no ecossistema.")
        }
        throw error
      }

      setSucesso("Vínculo comercial estabelecido com sucesso!")
      setVinculoImobiliariaId("")
      setVinculoEmpresaId("")
      await carregarDados(true)
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar estabelecer vínculo.")
    } finally {
      setSalvando(false)
    }
  }

  // Remove Vínculo Comercial
  const handleRemoverVinculo = async (id: string) => {
    if (!confirm("Tem certeza que deseja dissolver este vínculo comercial?")) return
    setErro(null)
    setSucesso(null)

    try {
      const { error } = await supabase
        .from("vinculos_saas")
        .delete()
        .eq("id", id)

      if (error) throw error

      setSucesso("Vínculo comercial dissolvido com sucesso.")
      await carregarDados(true)
    } catch (err: any) {
      console.error(err)
      setErro("Erro ao tentar remover o vínculo.")
    }
  }

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
        <span>Carregando painel de controle centralizado...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      
      {/* Cabeçalho de Identificação */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-occasio-navy flex items-center gap-2">
            <Shield className="h-7 w-7 text-occasio-blue" /> Dashboard de Admin SaaS
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Controle fechado e centralizado do ecossistema Occasio.Imob.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => carregarDados(true)} 
          className="text-xs font-semibold flex items-center gap-1.5 h-9"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="font-bold text-red-800">Erro Operacional</AlertTitle>
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="font-semibold text-green-800">Sucesso!</AlertTitle>
          <AlertDescription className="font-semibold">{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Abas Administrativas */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => { setActiveTab("imobiliarias"); setErro(null); setSucesso(null) }}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-all ${
            activeTab === "imobiliarias"
              ? "border-occasio-blue text-occasio-blue"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Landmark className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Imobiliárias ({imobiliarias.length})
        </button>
        <button
          onClick={() => { setActiveTab("prestadoras"); setErro(null); setSucesso(null) }}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-all ${
            activeTab === "prestadoras"
              ? "border-occasio-blue text-occasio-blue"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HardHat className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Empresas Prestadoras ({empresas.length})
        </button>
        <button
          onClick={() => { setActiveTab("vinculos"); setErro(null); setSucesso(null) }}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-all ${
            activeTab === "vinculos"
              ? "border-occasio-blue text-occasio-blue"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Link2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Vínculos Comerciais ({vinculos.length})
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* ======================== SEÇÃO 1: FORMULÁRIOS (LADO ESQUERDO) ======================== */}
        <div className="lg:col-span-1 space-y-6">
          
          {activeTab === "imobiliarias" && (
            <Card className="border-slate-200 shadow bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200/50 p-4">
                <CardTitle className="text-sm font-bold text-occasio-navy flex items-center gap-1.5">
                  <Landmark className="h-4 w-4 text-occasio-blue" />
                  Cadastrar Imobiliária
                </CardTitle>
                <CardDescription className="text-xs">Cria o gestor no Auth com e-mail confirmado.</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleCadastrarImobiliaria} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Razão Social *</label>
                    <Input 
                      placeholder="Ex: Imobiliária Silva Ltda" 
                      value={imobNome}
                      onChange={(e) => setImobNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">CNPJ *</label>
                      <Input 
                        placeholder="00.000.000/0000-00" 
                        value={imobCnpj}
                        onChange={(e) => setImobCnpj(aplicarMascaraCNPJ(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">CRECI *</label>
                      <Input 
                        placeholder="Ex: 12345-J" 
                        value={imobCreci}
                        onChange={(e) => setImobCreci(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail Administrativo *</label>
                    <Input 
                      type="email"
                      placeholder="silva@imobiliaria.com.br" 
                      value={imobEmail}
                      onChange={(e) => setImobEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                    <Input 
                      placeholder="(00) 00000-0000" 
                      value={imobTelefone}
                      onChange={(e) => setImobTelefone(aplicarMascaraTelefone(e.target.value))}
                    />
                  </div>

                  {/* Campos de endereço com busca por CEP */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Endereço de Faturamento / Sede</span>
                    
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">CEP *</label>
                      <div className="relative">
                        <Input 
                          placeholder="00000-000" 
                          value={imobCep}
                          onChange={(e) => handleCepChange(e.target.value)}
                          required
                        />
                        {buscandoCep && (
                          <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-semibold animate-pulse">Buscando...</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Logradouro e Número *</label>
                      <Input 
                        placeholder="Ex: Av. Sete de Setembro, 1500 - Sala 4" 
                        value={imobEndereco}
                        onChange={(e) => setImobEndereco(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bairro *</label>
                        <Input 
                          placeholder="Ex: Centro" 
                          value={imobBairro}
                          onChange={(e) => setImobBairro(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cidade *</label>
                        <Input 
                          placeholder="Ex: Curitiba" 
                          value={imobCidade}
                          onChange={(e) => setImobCidade(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Estado (UF) *</label>
                      <Input 
                        placeholder="Ex: PR" 
                        maxLength={2}
                        value={imobEstado}
                        onChange={(e) => setImobEstado(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>

                  {/* Condições de Acerto */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Acerto Financeiro com Prestador PJ</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Condição de Acerto *</label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          value={imobTipoRepasse}
                          onChange={(e) => {
                            setImobTipoRepasse(e.target.value as any)
                            setImobPrazoRepasseDias("")
                          }}
                          required
                        >
                          <option value="">Selecione...</option>
                          <option value="mensal">Mensal</option>
                          <option value="quinzenal">Quinzenal</option>
                          <option value="semanal">Semanal</option>
                          <option value="por_servico">Por serviço realizado</option>
                        </select>
                      </div>

                      {imobTipoRepasse && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            {imobTipoRepasse === "mensal" && "Dia do mês do repasse? *"}
                            {imobTipoRepasse === "quinzenal" && "Dias após quinzena? *"}
                            {imobTipoRepasse === "semanal" && "Dias após semana? *"}
                            {imobTipoRepasse === "por_servico" && "Dias após entrega? *"}
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={imobTipoRepasse === "mensal" ? 31 : undefined}
                            placeholder="Ex: 5"
                            value={imobPrazoRepasseDias}
                            onChange={(e) => setImobPrazoRepasseDias(e.target.value ? Number(e.target.value) : "")}
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    disabled={salvando || buscandoCep}
                    type="submit" 
                    className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-semibold h-9"
                  >
                    {salvando ? "Processando..." : <><Plus className="h-4 w-4 mr-1" /> Registrar Imobiliária</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === "prestadoras" && (
            <Card className="border-slate-200 shadow bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200/50 p-4">
                <CardTitle className="text-sm font-bold text-occasio-navy flex items-center gap-1.5">
                  <HardHat className="h-4 w-4 text-occasio-blue" />
                  Cadastrar Prestadora PJ
                </CardTitle>
                <CardDescription className="text-xs">Cria a conta-mãe gerencial com senha padrão.</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleCadastrarPrestadora} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nome Fantasia *</label>
                    <Input 
                      placeholder="Ex: Pedro Reformas Hidráulicas" 
                      value={prestNome}
                      onChange={(e) => setPrestNome(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">CNPJ *</label>
                    <Input 
                      placeholder="00.000.000/0000-00" 
                      value={prestCnpj}
                      onChange={(e) => setPrestCnpj(aplicarMascaraCNPJ(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail Comercial *</label>
                    <Input 
                      type="email"
                      placeholder="contato@pedroreformas.com.br" 
                      value={prestEmail}
                      onChange={(e) => setPrestEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                    <Input 
                      placeholder="(00) 00000-0000" 
                      value={prestTelefone}
                      onChange={(e) => setPrestTelefone(aplicarMascaraTelefone(e.target.value))}
                    />
                  </div>

                  {/* Condições de Acerto */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Condição de Repasse para Técnicos (PF)</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Condição de Acerto *</label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          value={prestTipoRepasse}
                          onChange={(e) => {
                            setPrestTipoRepasse(e.target.value as any)
                            setPrestPrazoRepasseDias("")
                          }}
                          required
                        >
                          <option value="">Selecione...</option>
                          <option value="mensal">Mensal</option>
                          <option value="quinzenal">Quinzenal</option>
                          <option value="semanal">Semanal</option>
                          <option value="por_servico">Por serviço realizado</option>
                        </select>
                      </div>

                      {prestTipoRepasse && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            {prestTipoRepasse === "mensal" && "Dia do mês do repasse? *"}
                            {prestTipoRepasse === "quinzenal" && "Dias após quinzena? *"}
                            {prestTipoRepasse === "semanal" && "Dias após semana? *"}
                            {prestTipoRepasse === "por_servico" && "Dias após entrega? *"}
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={prestTipoRepasse === "mensal" ? 31 : undefined}
                            placeholder="Ex: 5"
                            value={prestPrazoRepasseDias}
                            onChange={(e) => setPrestPrazoRepasseDias(e.target.value ? Number(e.target.value) : "")}
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    disabled={salvando}
                    type="submit" 
                    className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-semibold h-9"
                  >
                    {salvando ? "Processando..." : <><Plus className="h-4 w-4 mr-1" /> Registrar Prestadora</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === "vinculos" && (
            <Card className="border-slate-200 shadow bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200/50 p-4">
                <CardTitle className="text-sm font-bold text-occasio-navy flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-occasio-blue" />
                  Estabelecer Vínculo
                </CardTitle>
                <CardDescription className="text-xs">Associa a prestadora PJ à carteira da imobiliária.</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleCriarVinculo} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Imobiliária *</label>
                    <select
                      value={vinculoImobiliariaId}
                      onChange={(e) => setVinculoImobiliariaId(e.target.value)}
                      required
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                    >
                      <option value="">Selecione uma imobiliária...</option>
                      {imobiliarias.map((imob) => (
                        <option key={imob.id} value={imob.id}>{imob.nome}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Empresa Prestadora PJ *</label>
                    <select
                      value={vinculoEmpresaId}
                      onChange={(e) => setVinculoEmpresaId(e.target.value)}
                      required
                      className="w-full border border-slate-200 rounded-md h-9 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                    >
                      <option value="">Selecione uma prestadora...</option>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.nome}</option>
                      ))}
                    </select>
                  </div>

                  <Button 
                    disabled={salvando || !vinculoImobiliariaId || !vinculoEmpresaId}
                    type="submit" 
                    className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-semibold h-9"
                  >
                    {salvando ? "Salvando..." : "Vincular Comercialmente"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

        </div>

        {/* ======================== SEÇÃO 2: LISTAGEM DE DADOS (LADO DIREITO - 2 COLUNAS) ======================== */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* LISTAGEM: IMOBILIÁRIAS */}
          {activeTab === "imobiliarias" && (
            <div className="space-y-4">
              {imobiliarias.length === 0 ? (
                <Card className="border-dashed border-slate-300 p-8 text-center text-slate-400 bg-white">
                  <Landmark className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma imobiliária parceira cadastrada.</p>
                </Card>
              ) : (
                imobiliarias.map((imob) => (
                  <Card key={imob.id} className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-occasio-navy text-sm">{imob.nome}</h3>
                          {imob.primeiro_acesso_pendente ? (
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">1º Acesso Pendente</Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-800 border border-green-200 text-[9px] font-bold">Ativo</Badge>
                          )}
                        </div>
                        <div className="text-slate-500 space-y-1">
                          <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {imob.email}</div>
                          <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> CNPJ: {imob.documento_identificacao || "Não informado"}</div>
                          {imob.creci && <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> CRECI: {imob.creci}</div>}
                          {imob.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {imob.telefone}</div>}
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] bg-slate-50/50 p-2 rounded border border-slate-100 max-w-lg leading-relaxed font-medium">
                            <span className="font-extrabold text-occasio-navy">Condição de Acerto PJ:</span>{' '}
                            {imob.tipo_repasse ? (
                              <>
                                <span className="capitalize font-bold text-occasio-blue">{imob.tipo_repasse}</span>{' '}
                                {imob.tipo_repasse === 'mensal' && `(Todo dia ${imob.prazo_repasse_dias})`}
                                {imob.tipo_repasse === 'quinzenal' && `(${imob.prazo_repasse_dias} dias após quinzena)`}
                                {imob.tipo_repasse === 'semanal' && `(${imob.prazo_repasse_dias} dias após semana)`}
                                {imob.tipo_repasse === 'por_servico' && `(${imob.prazo_repasse_dias} dias após entrega)`}
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Não configurada</span>
                            )}
                          </div>
                          {(imob.endereco || imob.cep) && (
                            <div className="text-slate-500 mt-1.5 text-[10px] bg-slate-50/50 p-2 rounded border border-slate-100 max-w-lg leading-relaxed font-medium">
                              <span className="font-extrabold text-occasio-navy">Endereço:</span> {imob.endereco}{imob.bairro ? `, ${imob.bairro}` : ""}{imob.cidade ? ` - ${imob.cidade}/${imob.estado}` : ""}{imob.cep ? ` (CEP: ${imob.cep})` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 border-slate-200 hover:border-occasio-blue hover:text-occasio-blue text-slate-600 font-semibold flex items-center gap-1 text-[11px]"
                          onClick={() => handleAbrirEdicao(imob)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 border-slate-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50/50 text-slate-600 font-semibold flex items-center gap-1 text-[11px]"
                          onClick={() => {
                            setPerfilParaExcluir(imob)
                            setConfirmacaoTexto("")
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* LISTAGEM: PRESTADORAS PJ */}
          {activeTab === "prestadoras" && (
            <div className="space-y-4">
              {empresas.length === 0 ? (
                <Card className="border-dashed border-slate-300 p-8 text-center text-slate-400 bg-white">
                  <HardHat className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma empresa prestadora cadastrada.</p>
                </Card>
              ) : (
                empresas.map((emp) => (
                  <Card key={emp.id} className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-occasio-navy text-sm">{emp.nome}</h3>
                          {emp.primeiro_acesso_pendente ? (
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">1º Acesso Pendente</Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-800 border border-green-200 text-[9px] font-bold">Ativo</Badge>
                          )}
                        </div>
                        <div className="text-slate-500 space-y-1">
                          <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {emp.email}</div>
                          <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> CNPJ: {emp.documento_identificacao || "Não informado"}</div>
                          {emp.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {emp.telefone}</div>}
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] bg-slate-50/50 p-2 rounded border border-slate-100 max-w-lg leading-relaxed font-medium">
                            <span className="font-extrabold text-occasio-navy">Repasse Técnicos (PF):</span>{' '}
                            {emp.tipo_repasse ? (
                              <>
                                <span className="capitalize font-bold text-occasio-blue">{emp.tipo_repasse}</span>{' '}
                                {emp.tipo_repasse === 'mensal' && `(Todo dia ${emp.prazo_repasse_dias})`}
                                {emp.tipo_repasse === 'quinzenal' && `(${emp.prazo_repasse_dias} dias após quinzena)`}
                                {emp.tipo_repasse === 'semanal' && `(${emp.prazo_repasse_dias} dias após semana)`}
                                {emp.tipo_repasse === 'por_servico' && `(${emp.prazo_repasse_dias} dias após entrega)`}
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Não configurado</span>
                            )}
                          </div>
                          {(emp.endereco || emp.cep) && (
                            <div className="text-slate-500 mt-1.5 text-[10px] bg-slate-50/50 p-2 rounded border border-slate-100 max-w-lg leading-relaxed font-medium">
                              <span className="font-extrabold text-occasio-navy">Endereço:</span> {emp.endereco}{emp.bairro ? `, ${emp.bairro}` : ""}{emp.cidade ? ` - ${emp.cidade}/${emp.estado}` : ""}{emp.cep ? ` (CEP: ${emp.cep})` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 border-slate-200 hover:border-occasio-blue hover:text-occasio-blue text-slate-600 font-semibold flex items-center gap-1 text-[11px]"
                          onClick={() => handleAbrirEdicao(emp)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 border-slate-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50/50 text-slate-600 font-semibold flex items-center gap-1 text-[11px]"
                          onClick={() => {
                            setPerfilParaExcluir(emp)
                            setConfirmacaoTexto("")
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* LISTAGEM: VÍNCULOS COMERCIAIS */}
          {activeTab === "vinculos" && (
            <div className="space-y-4">
              {vinculos.length === 0 ? (
                <Card className="border-dashed border-slate-300 p-8 text-center text-slate-400 bg-white">
                  <Link2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">Nenhum vínculo comercial ativo cadastrado.</p>
                </Card>
              ) : (
                vinculos.map((v) => (
                  <Card key={v.id} className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-4 flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-500">Imobiliária:</span>
                          <strong className="text-occasio-navy font-bold">{v.imobiliaria?.nome || "Imobiliária Silva"}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <HardHat className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-500">Prestador PJ:</span>
                          <strong className="text-slate-700 font-bold">{v.empresa?.nome || "Prestador Pedro"}</strong>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoverVinculo(v.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

        </div>

      </div>

      {/* Modal de Edição */}
      {perfilEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-slate-200 shadow-xl bg-white max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-slate-50 border-b border-slate-200 p-4 flex flex-row items-center justify-between sticky top-0 z-10">
              <div>
                <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-occasio-blue" /> Editar {perfilEditando.perfil === "imobiliaria" ? "Imobiliária" : "Empresa Prestadora"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Atualize os dados cadastrais do parceiro.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full text-slate-500 hover:text-slate-700"
                onClick={() => setPerfilEditando(null)}
                disabled={editando}
              >
                &times;
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSalvarEdicao} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Razão Social / Nome Fantasia *</label>
                  <Input 
                    placeholder="Ex: Nome da Empresa" 
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    required
                    disabled={editando}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">CNPJ *</label>
                    <Input 
                      placeholder="00.000.000/0000-00" 
                      value={editCnpj}
                      onChange={(e) => setEditCnpj(aplicarMascaraCNPJ(e.target.value))}
                      required
                      disabled={editando}
                    />
                  </div>
                  {perfilEditando.perfil === "imobiliaria" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">CRECI *</label>
                      <Input 
                        placeholder="Ex: 12345-J" 
                        value={editCreci}
                        onChange={(e) => setEditCreci(e.target.value)}
                        required
                        disabled={editando}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail Administrativo *</label>
                  <Input 
                    type="email"
                    placeholder="contato@empresa.com.br" 
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    disabled={editando}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <Input 
                    placeholder="(00) 00000-0000" 
                    value={editTelefone}
                    onChange={(e) => setEditTelefone(aplicarMascaraTelefone(e.target.value))}
                    disabled={editando}
                  />
                </div>

                {perfilEditando.perfil === "imobiliaria" && (
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Endereço de Faturamento / Sede</span>
                    
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">CEP *</label>
                      <div className="relative">
                        <Input 
                          placeholder="00000-000" 
                          value={editCep}
                          onChange={(e) => handleCepChangeEdit(e.target.value)}
                          required
                          disabled={editando}
                        />
                        {buscandoCep && (
                          <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-semibold animate-pulse">Buscando...</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Logradouro e Número *</label>
                      <Input 
                        placeholder="Ex: Av. Sete de Setembro, 1500 - Sala 4" 
                        value={editEndereco}
                        onChange={(e) => setEditEndereco(e.target.value)}
                        required
                        disabled={editando}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bairro *</label>
                        <Input 
                          placeholder="Ex: Centro" 
                          value={editBairro}
                          onChange={(e) => setEditBairro(e.target.value)}
                          required
                          disabled={editando}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cidade *</label>
                        <Input 
                          placeholder="Ex: Curitiba" 
                          value={editCidade}
                          onChange={(e) => setEditCidade(e.target.value)}
                          required
                          disabled={editando}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Estado (UF) *</label>
                      <Input 
                        placeholder="Ex: PR" 
                        maxLength={2}
                        value={editEstado}
                        onChange={(e) => setEditEstado(e.target.value.toUpperCase())}
                        required
                        disabled={editando}
                      />
                    </div>
                  </div>
                )}

                {/* Condições de Acerto na Edição */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    {perfilEditando.perfil === "imobiliaria" 
                      ? "Acerto Financeiro com Prestador PJ" 
                      : "Condição de Repasse para Técnicos (PF)"}
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {perfilEditando.perfil === "imobiliaria"
                          ? "Condição de Acerto com o Prestador PJ *"
                          : "Condição de Acerto com o Técnico *"}
                      </label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={editTipoRepasse}
                        onChange={(e) => {
                          setEditTipoRepasse(e.target.value as any)
                          setEditPrazoRepasseDias("")
                        }}
                        disabled={editando}
                        required
                      >
                        <option value="">Selecione...</option>
                        <option value="mensal">Mensal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="semanal">Semanal</option>
                        <option value="por_servico">Por serviço realizado</option>
                      </select>
                    </div>

                    {editTipoRepasse && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {editTipoRepasse === "mensal" && "Dia do mês do repasse? *"}
                          {editTipoRepasse === "quinzenal" && "Dias após quinzena? *"}
                          {editTipoRepasse === "semanal" && "Dias após semana? *"}
                          {editTipoRepasse === "por_servico" && "Dias após entrega? *"}
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={editTipoRepasse === "mensal" ? 31 : undefined}
                          placeholder="Ex: 5"
                          value={editPrazoRepasseDias}
                          onChange={(e) => setEditPrazoRepasseDias(e.target.value ? Number(e.target.value) : "")}
                          disabled={editando}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPerfilEditando(null)}
                    disabled={editando}
                    className="w-1/2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs h-9"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={editando || buscandoCep}
                    type="submit"
                    className="w-1/2 bg-occasio-blue hover:bg-occasio-navy text-white font-semibold text-xs h-9"
                  >
                    {editando ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Exclusão Crítica (Cascata) */}
      {perfilParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-red-200 shadow-2xl bg-white border animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-red-50 border-b border-red-100 p-4">
              <CardTitle className="text-sm font-extrabold text-red-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" /> ALERTA CRÍTICO: Exclusão Permanente
              </CardTitle>
              <CardDescription className="text-xs text-red-700 font-semibold">
                Esta ação é irreversível e excluirá tudo associado em cascata.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="bg-red-50/50 border border-red-200 p-3 rounded text-xs text-red-800 space-y-1.5 leading-relaxed font-semibold">
                <p>Ao confirmar a exclusão do parceiro <strong>{perfilParaExcluir.nome}</strong>:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {perfilParaExcluir.perfil === "imobiliaria" ? (
                    <>
                      <li>A conta da Imobiliária e seu acesso ao sistema serão removidos.</li>
                      <li>Todos os <strong>Imóveis</strong> cadastrados sob a imobiliária serão deletados.</li>
                      <li>Todas as contas de <strong>Inquilinos e Proprietários</strong> criadas pela imobiliária serão removidas do Auth.</li>
                      <li>Todos os <strong>Chamados e Ordens de Serviço (O.S.)</strong> e seus respectivos <strong>Orçamentos</strong> serão excluídos.</li>
                    </>
                  ) : (
                    <>
                      <li>A conta da Empresa Prestadora e seu acesso ao sistema serão removidos.</li>
                      <li>Todos os <strong>Técnicos Vinculados</strong> da equipe serão removidos do Auth.</li>
                      <li>Todos os <strong>Orçamentos e Laudos Técnicos</strong> enviados por ela ou por seus técnicos serão apagados.</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  Para confirmar, digite <span className="text-red-600 select-all font-extrabold">EXCLUIR</span> abaixo:
                </label>
                <Input
                  placeholder="Digite EXCLUIR em letras maiúsculas"
                  value={confirmacaoTexto}
                  onChange={(e) => setConfirmacaoTexto(e.target.value)}
                  disabled={excluindo}
                  className="text-center font-bold border-red-200 focus-visible:ring-red-500 uppercase"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPerfilParaExcluir(null)
                    setConfirmacaoTexto("")
                  }}
                  disabled={excluindo}
                  className="w-1/2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarExclusao}
                  disabled={excluindo || confirmacaoTexto !== "EXCLUIR"}
                  className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9 flex items-center justify-center gap-1.5"
                >
                  {excluindo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Excluindo...
                    </>
                  ) : (
                    "Confirmar Exclusão"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
