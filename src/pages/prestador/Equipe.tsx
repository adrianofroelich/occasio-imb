import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth, type Perfil } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Users, UserPlus, RefreshCw, Loader2, Mail, Phone, FileText } from "lucide-react"

const CATEGORIAS_OPCOES = ["Elétrica", "Hidráulica", "Pintura", "Reparos", "Alvenaria", "Vidraçaria", "Serralheria"]

export default function PrestadorEquipe() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()

  // Estados dos dados
  const [tecnicos, setTecnicos] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)

  // Formulário
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [documento, setDocumento] = useState("")
  const [categorias, setCategorias] = useState<string[]>([])

  // Alertas e salvamento
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Segurança: Apenas prestador conta-mãe (empresa_mae_id deve ser nulo)
  useEffect(() => {
    if (!loading && (perfil?.perfil !== "prestador" || perfil?.empresa_mae_id)) {
      navigate("/")
    }
  }, [perfil, loading, navigate])

  const carregarEquipe = async () => {
    if (!user) return
    setLoading(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .eq("empresa_mae_id", user.id)
        .order("nome")

      if (error) throw error
      setTecnicos((data || []) as Perfil[])
    } catch (err: any) {
      console.error(err)
      setErro("Falha ao carregar a listagem de técnicos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && perfil?.perfil === "prestador" && !perfil?.empresa_mae_id) {
      carregarEquipe()
    } else if (user) {
      setLoading(false)
    }
  }, [user, perfil])

  // Máscaras brasileiras
  const aplicarMascaraCpfCnpj = (value: string) => {
    const limpo = value.replace(/\D/g, "")
    if (limpo.length <= 11) {
      return limpo
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    } else {
      return limpo
        .substring(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2")
    }
  }

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

  const handleToggleCategoria = (cat: string) => {
    if (categorias.includes(cat)) {
      setCategorias(categorias.filter(item => item !== cat))
    } else {
      setCategorias([...categorias, cat])
    }
  }

  const handleCadastrarTecnico = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !email.trim()) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      const senhaProvisoria = `Occasio@${Math.random().toString(36).substring(2, 10).toUpperCase()}`

      // 1. Invoca Edge Function admin-helper para criar o usuário do Técnico
      const { data, error } = await supabase.functions.invoke("admin-helper", {
        body: {
          action: "criar-cliente",
          email: email.trim().toLowerCase(),
          password: senhaProvisoria,
          nome: nome.trim(),
          perfil: "prestador",
          telefone: telefone.replace(/\D/g, "") ? telefone : null,
          documento: documento.replace(/\D/g, "") ? documento : null,
          empresa_mae_id: user?.id,
          categorias: categorias
        }
      })

      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || "Erro ao cadastrar técnico na base administrativa.")
      }

      setSucesso(`Técnico cadastrado com sucesso! E-mail pré-confirmado em auth.users. Senha provisória gerada: ${senhaProvisoria}`)
      
      // Limpa os campos do formulário
      setNome("")
      setEmail("")
      setTelefone("")
      setDocumento("")
      setCategorias([])

      await carregarEquipe()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar registrar o técnico.")
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
        <span>Carregando dados da equipe técnica...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-occasio-navy flex items-center gap-2">
            <Users className="h-7 w-7 text-occasio-blue" /> Minha Equipe Técnica
          </h1>
          <p className="text-slate-500 text-sm md:text-base">
            Gerencie e cadastre os técnicos de campo da sua empresa para designação de OS.
          </p>
        </div>
        <Button onClick={() => carregarEquipe()} variant="outline" size="sm" className="flex gap-2">
          <RefreshCw className="h-4 w-4" /> Recarregar
        </Button>
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertDescription className="font-semibold font-mono text-[11px] whitespace-pre-line">{sucesso}</AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Formulário de Cadastro do Técnico */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-md bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-occasio-blue" /> Novo Técnico
              </CardTitle>
              <CardDescription className="text-xs">
                Registre uma conta filho (técnico) vinculada à sua empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCadastrarTecnico} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nome Completo *
                  </label>
                  <Input
                    placeholder="Ex: Lucas Eletricista"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    disabled={salvando}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    E-mail (Login) *
                  </label>
                  <Input
                    type="email"
                    placeholder="Ex: lucas@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={salvando}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Telefone
                  </label>
                  <Input
                    placeholder="Ex: (11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(aplicarMascaraTelefone(e.target.value))}
                    disabled={salvando}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    CPF ou CNPJ do Técnico
                  </label>
                  <Input
                    placeholder="Ex: 000.000.000-00"
                    value={documento}
                    onChange={(e) => setDocumento(aplicarMascaraCpfCnpj(e.target.value))}
                    disabled={salvando}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-2">
                    Categorias de Serviço *
                  </label>
                  <div className="grid grid-cols-2 gap-2 border p-3 rounded-md bg-slate-50/50">
                    {CATEGORIAS_OPCOES.map((cat) => (
                      <label key={cat} className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={categorias.includes(cat)}
                          onChange={() => handleToggleCategoria(cat)}
                          disabled={salvando}
                          className="rounded border-slate-300 text-occasio-blue focus:ring-occasio-blue h-3.5 w-3.5"
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>

                <Button disabled={salvando || categorias.length === 0} type="submit" className="w-full bg-occasio-blue hover:bg-occasio-navy text-white font-semibold">
                  {salvando ? "Salvando..." : "Cadastrar Técnico"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Listagem de Técnicos cadastrados */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 shadow-md bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-extrabold text-occasio-navy">Técnicos Ativos ({tecnicos.length})</CardTitle>
              <CardDescription className="text-xs">Membros da equipe disponíveis para execução e vistorias.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tecnicos.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white flex flex-col items-center justify-center gap-2">
                  <Users className="h-10 w-10 text-slate-300" />
                  <span className="font-semibold text-slate-500">Nenhum técnico na equipe</span>
                  <p className="max-w-xs text-[11px] text-slate-400">
                    Cadastre os membros da sua equipe técnica para delegar as OS enviadas pelas imobiliárias.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
                  {tecnicos.map((t) => (
                    <div key={t.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <strong className="text-occasio-navy text-sm font-bold">{t.nome}</strong>
                          {t.primeiro_acesso_pendente ? (
                            <Badge className="bg-yellow-50 text-yellow-800 border-yellow-200 border text-[9px] font-bold">
                              Primeiro Acesso Pendente
                            </Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-800 border-green-200 border text-[9px] font-bold">
                              Ativo
                            </Badge>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {t.email}</span>
                          {t.telefone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {t.telefone}</span>}
                          {t.documento_identificacao && <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> {t.documento_identificacao}</span>}
                        </div>
                        {t.categorias && t.categorias.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {t.categorias.map(cat => (
                              <Badge key={cat} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[9px] font-bold px-2 py-0.2">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
