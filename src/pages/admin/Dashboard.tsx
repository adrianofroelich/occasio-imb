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

  // Formulário: Prestadoras
  const [prestNome, setPrestNome] = useState("")
  const [prestCnpj, setPrestCnpj] = useState("")
  const [prestEmail, setPrestEmail] = useState("")
  const [prestTelefone, setPrestTelefone] = useState("")

  // Formulário: Vínculos
  const [vinculoImobiliariaId, setVinculoImobiliariaId] = useState("")
  const [vinculoEmpresaId, setVinculoEmpresaId] = useState("")

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

  // Processa cadastro de Imobiliária
  const handleCadastrarImobiliaria = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imobNome || !imobCnpj || !imobEmail) return
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
          documento: imobCnpj
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
          documento: prestCnpj
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
                  <Button 
                    disabled={salvando}
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
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-occasio-navy text-sm">{imob.nome}</h3>
                          {imob.primeiro_acesso_pendente ? (
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">1º Acesso Pendente</Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-800 border border-green-200 text-[9px] font-bold">Ativo</Badge>
                          )}
                        </div>
                        <div className="text-slate-500 mt-1.5 space-y-1">
                          <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {imob.email}</div>
                          <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> CNPJ: {imob.documento_identificacao || "Não informado"}</div>
                          {imob.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {imob.telefone}</div>}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-medium">
                        ID: {imob.id.slice(0, 8)}...
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
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-occasio-navy text-sm">{emp.nome}</h3>
                          {emp.primeiro_acesso_pendente ? (
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">1º Acesso Pendente</Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-800 border border-green-200 text-[9px] font-bold">Ativo</Badge>
                          )}
                        </div>
                        <div className="text-slate-500 mt-1.5 space-y-1">
                          <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {emp.email}</div>
                          <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> CNPJ: {emp.documento_identificacao || "Não informado"}</div>
                          {emp.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {emp.telefone}</div>}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-medium">
                        ID: {emp.id.slice(0, 8)}...
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

    </div>
  )
}
