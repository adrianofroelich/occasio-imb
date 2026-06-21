import { useState, useEffect } from "react"
import { supabase, obterMensagemErroEdge } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  UserPlus, 
  Users, 
  Phone, 
  Mail, 
  FileText, 
  CheckCircle, 
  Clock, 
  Search, 
  UserCheck, 
  Loader2,
  AlertCircle
} from "lucide-react"

// Interface local que estende o perfil para exibição
interface ClienteExibicao {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  perfil: 'inquilino' | 'proprietario'
  documento_identificacao: string | null
  primeiro_acesso_pendente: boolean
  criado_em: string
}

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteExibicao[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filtroPerfil, setFiltroPerfil] = useState<"todos" | "inquilino" | "proprietario">("todos")
  
  // Estados do Formulário
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [documento, setDocumento] = useState("")
  const [tipoPerfil, setTipoPerfil] = useState<"inquilino" | "proprietario">("inquilino")
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Carrega clientes da tabela public.perfis
  async function carregarClientes() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome, email, telefone, perfil, documento_identificacao, primeiro_acesso_pendente, criado_em")
        .in("perfil", ["inquilino", "proprietario"])
        .order("criado_em", { ascending: false })

      if (error) throw error

      setClientes((data || []) as ClienteExibicao[])
    } catch (err: any) {
      console.error("Erro ao carregar clientes:", err)
      setErrorMsg("Erro ao carregar a listagem de clientes.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarClientes()
  }, [])

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

  // Ação de cadastrar cliente
  const handleCadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!nome.trim()) {
      setErrorMsg("O nome é obrigatório.")
      return
    }
    if (!email.trim()) {
      setErrorMsg("O e-mail é obrigatório.")
      return
    }
    
    // Validação de formato de e-mail básico
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Insira um endereço de e-mail válido.")
      return
    }

    try {
      setSaving(true)

      const senhaProvisoria = `Occasio@${Math.random().toString(36).substring(2, 10).toUpperCase()}`

      // 1. Cria o usuário invocando a Edge Function 'admin-helper'
      const { data, error } = await supabase.functions.invoke("admin-helper", {
        body: {
          action: "criar-cliente",
          email: email.trim().toLowerCase(),
          password: senhaProvisoria,
          nome: nome.trim(),
          perfil: tipoPerfil,
          telefone: telefone.replace(/\D/g, "") ? telefone : null,
          documento: documento.replace(/\D/g, "") ? documento : null
        }
      })

      if (error) {
        const msg = await obterMensagemErroEdge(error)
        throw new Error(msg)
      }
      if (data && data.error) {
        const msg = await obterMensagemErroEdge({ message: data.error })
        throw new Error(msg)
      }

      if (error) {
        throw error
      }

      setSuccessMsg(`Cliente cadastrado com sucesso! E-mail pré-confirmado em auth.users. Senha provisória gerada: ${senhaProvisoria}`)
      
      // Limpa os campos do formulário
      setNome("")
      setEmail("")
      setTelefone("")
      setDocumento("")
      setTipoPerfil("inquilino")

      // Atualiza a lista
      carregarClientes()
    } catch (err: any) {
      console.error("Erro ao cadastrar cliente:", err)
      setErrorMsg(err.message || "Erro inesperado ao cadastrar o cliente.")
    } finally {
      setSaving(false)
    }
  }

  // Filtros aplicados
  const clientesFiltrados = clientes.filter(c => {
    const atendeBusca = 
      c.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.documento_identificacao && c.documento_identificacao.includes(searchQuery))
    
    const atendePerfil = filtroPerfil === "todos" ? true : c.perfil === filtroPerfil

    return atendeBusca && atendePerfil
  })

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-occasio-blue" />
            Gestão de Clientes
          </h1>
          <p className="text-slate-500 mt-1">
            Cadastre e liste proprietários e inquilinos sob a gestão da imobiliária.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Cadastro */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200/80 shadow-md sticky top-24">
            <CardHeader className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-b border-slate-200/60 pb-4">
              <CardTitle className="text-lg text-occasio-navy flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-occasio-blue" />
                Novo Cliente
              </CardTitle>
              <CardDescription>
                Adicione proprietários ou inquilinos. Um perfil de primeiro acesso será gerado no Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCadastrarCliente} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                      <span className="font-semibold">Cadastro Efetuado!</span>
                    </div>
                    <p className="text-slate-600 font-mono text-[11px] bg-white p-2 border border-emerald-100 rounded">
                      {successMsg}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    disabled={saving}
                    className="border-slate-200 focus-visible:ring-occasio-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ex: joao@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={saving}
                    className="border-slate-200 focus-visible:ring-occasio-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="telefone" className="text-xs font-semibold text-slate-700">
                    Telefone
                  </label>
                  <Input
                    id="telefone"
                    type="text"
                    placeholder="Ex: (11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(aplicarMascaraTelefone(e.target.value))}
                    disabled={saving}
                    className="border-slate-200 focus-visible:ring-occasio-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="documento" className="text-xs font-semibold text-slate-700">
                    CPF / CNPJ
                  </label>
                  <Input
                    id="documento"
                    type="text"
                    placeholder="Ex: 000.000.000-00"
                    value={documento}
                    onChange={(e) => setDocumento(aplicarMascaraCpfCnpj(e.target.value))}
                    disabled={saving}
                    className="border-slate-200 focus-visible:ring-occasio-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Tipo de Perfil
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setTipoPerfil("inquilino")}
                      className={`py-2 px-3 text-sm rounded-lg border font-medium transition-all ${
                        tipoPerfil === "inquilino"
                          ? "bg-occasio-blue/10 border-occasio-blue text-occasio-blue shadow-sm shadow-occasio-blue/5"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      disabled={saving}
                    >
                      Inquilino
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoPerfil("proprietario")}
                      className={`py-2 px-3 text-sm rounded-lg border font-medium transition-all ${
                        tipoPerfil === "proprietario"
                          ? "bg-occasio-blue/10 border-occasio-blue text-occasio-blue shadow-sm shadow-occasio-blue/5"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      disabled={saving}
                    >
                      Proprietário
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-occasio-blue hover:bg-occasio-navy text-white transition-all font-semibold shadow-md shadow-occasio-blue/10 mt-6"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Cliente"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Listagem de Clientes */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200/80 shadow-md">
            <CardHeader className="border-b border-slate-200/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-occasio-navy">Clientes Cadastrados</CardTitle>
                  <CardDescription>Visualização em tempo real de proprietários e inquilinos cadastrados.</CardDescription>
                </div>
                {/* Filtro por Perfil */}
                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/50 self-start sm:self-auto">
                  <button
                    onClick={() => setFiltroPerfil("todos")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      filtroPerfil === "todos" 
                        ? "bg-white text-occasio-navy shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltroPerfil("inquilino")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      filtroPerfil === "inquilino" 
                        ? "bg-white text-occasio-navy shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Inquilinos
                  </button>
                  <button
                    onClick={() => setFiltroPerfil("proprietario")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      filtroPerfil === "proprietario" 
                        ? "bg-white text-occasio-navy shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Proprietários
                  </button>
                </div>
              </div>

              {/* Barra de Busca */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nome, e-mail ou documento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-slate-200 focus-visible:ring-occasio-blue"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-occasio-blue mb-2" />
                  <p className="text-sm">Carregando dados da tabela de perfis...</p>
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-lg font-medium text-slate-700">Nenhum cliente cadastrado</p>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery 
                      ? "Nenhum resultado corresponde à sua pesquisa de busca." 
                      : "Cadastre novos proprietários e inquilinos no formulário ao lado para gerenciar seus vínculos."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <th className="py-3 px-6">Cliente</th>
                        <th className="py-3 px-6">Documento & Contato</th>
                        <th className="py-3 px-6">Perfil</th>
                        <th className="py-3 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {clientesFiltrados.map((cliente) => (
                        <tr key={cliente.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-semibold text-slate-800 text-sm">{cliente.nome}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                              ID: {cliente.id.substring(0, 8)}...
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1">
                              {cliente.email && (
                                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{cliente.email}</span>
                                </div>
                              )}
                              {cliente.telefone && (
                                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{cliente.telefone}</span>
                                </div>
                              )}
                              {cliente.documento_identificacao && (
                                <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{cliente.documento_identificacao}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <Badge 
                              variant="outline" 
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                                cliente.perfil === "inquilino"
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {cliente.perfil === "inquilino" ? "Inquilino" : "Proprietário"}
                            </Badge>
                          </td>
                          <td className="py-4 px-6">
                            {cliente.primeiro_acesso_pendente ? (
                              <div className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50/80 border border-amber-100 px-2 py-1 rounded-md text-xs font-semibold">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>Pendente de Primeiro Acesso</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md text-xs font-semibold">
                                <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                <span>Ativo</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
