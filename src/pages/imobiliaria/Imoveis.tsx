import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Home as HomeIcon, MapPin, Ruler, DollarSign, Loader2, AlertCircle, CheckCircle, Edit, Trash2 } from "lucide-react"

// Interfaces de tipos mapeados
interface Imovel {
  id: string
  codigo_imovel: string
  endereco: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  metragem_m2: number | null
  limite_alcada_r$: number
  inquilino_id: string | null
  proprietario_id: string | null
  inquilino?: { nome: string } | null
  proprietario?: { nome: string } | null
}

interface PerfilDropdown {
  id: string
  nome: string
}

export default function Imoveis() {
  const { user, perfil } = useAuth()
  
  // Estados para dados da tabela e selects
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [inquilinos, setInquilinos] = useState<PerfilDropdown[]>([])
  const [proprietarios, setProprietarios] = useState<PerfilDropdown[]>([])
  
  // Estados de loading e UI
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)

  // Estados dos campos do formulário
  const [codigoImovel, setCodigoImovel] = useState("")
  const [endereco, setEndereco] = useState("")
  const [bairro, setBairro] = useState("")
  const [cidade, setCidade] = useState("Curitiba")
  const [estado, setEstado] = useState("PR")
  const [cep, setCep] = useState("")
  const [metragem, setMetragem] = useState("")
  const [limiteAlcada, setLimiteAlcada] = useState("500.00")
  const [inquilinoId, setInquilinoId] = useState("")
  const [proprietarioId, setProprietarioId] = useState("")

  // Estados para Edição e Exclusão
  const [imovelEditando, setImovelEditando] = useState<Imovel | null>(null)
  const [imovelParaExcluir, setImovelParaExcluir] = useState<Imovel | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Carrega a listagem de imóveis, inquilinos e proprietários do banco de dados
  const loadData = async () => {
    try {
      setLoading(true)
      setErro(null)

      // 1. Carrega os imóveis sob a gestão da imobiliária ativa (ou todos se for super_admin)
      let query = supabase
        .from("imoveis")
        .select(`
          *,
          inquilino:inquilino_id (nome),
          proprietario:proprietario_id (nome)
        `)
        .order("criado_em", { ascending: false })

      if (perfil?.perfil === "imobiliaria") {
        query = query.eq("imobiliaria_id", user?.id)
      }

      const { data: imoveisData, error: imoveisError } = await query
      if (imoveisError) throw imoveisError
      setImoveis(imoveisData || [])

      // 2. Carrega lista de inquilinos e proprietários cadastrados no sistema para alimentar os selects
      const { data: inquilinosData, error: inquilinosError } = await supabase
        .from("perfis")
        .select("id, nome")
        .eq("perfil", "inquilino")
        .order("nome")

      if (inquilinosError) throw inquilinosError
      setInquilinos(inquilinosData || [])

      const { data: proprietariosData, error: proprietariosError } = await supabase
        .from("perfis")
        .select("id, nome")
        .eq("perfil", "proprietario")
        .order("nome")

      if (proprietariosError) throw proprietariosError
      setProprietarios(proprietariosData || [])

    } catch (err: any) {
      console.error(err)
      setErro("Não foi possível carregar os dados. Verifique a sua conexão ou se possui privilégios de acesso.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && perfil) {
      loadData()
    }
  }, [user, perfil])

  // Aplica máscara simples de CEP
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "")
    if (valor.length > 8) valor = valor.slice(0, 8)
    if (valor.length > 5) {
      valor = `${valor.slice(0, 5)}-${valor.slice(5)}`
    }
    setCep(valor)
  }

  // Executa o envio do formulário de cadastro/edição de imóvel
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    if (!codigoImovel || !endereco || !bairro || !cep) {
      setErro("Por favor, preencha todos os campos obrigatórios (*).")
      setSalvando(false)
      return
    }

    try {
      if (imovelEditando) {
        // Fluxo de Edição / Atualização de Imóvel
        const { error } = await supabase
          .from("imoveis")
          .update({
            codigo_imovel: codigoImovel,
            endereco,
            bairro,
            cidade,
            estado,
            cep,
            metragem_m2: metragem ? parseFloat(metragem) : null,
            limite_alcada_r$: limiteAlcada ? parseFloat(limiteAlcada) : 500.00,
            inquilino_id: inquilinoId || null,
            proprietario_id: proprietarioId || null
          })
          .eq("id", imovelEditando.id)

        if (error) {
          if (error.message.includes("unico_codigo_por_imobiliaria")) {
            throw new Error("Você já possui um imóvel cadastrado com este Código de Identificação.")
          }
          throw error
        }

        setSucesso(`Imóvel "${codigoImovel}" atualizado com sucesso!`)
        setImovelEditando(null)
      } else {
        // Fluxo de Cadastro Original de Imóvel
        const imobiliariaVinculo = user?.id

        const { error } = await supabase.from("imoveis").insert({
          imobiliaria_id: imobiliariaVinculo,
          codigo_imovel: codigoImovel,
          endereco,
          bairro,
          cidade,
          estado,
          cep,
          metragem_m2: metragem ? parseFloat(metragem) : null,
          limite_alcada_r$: limiteAlcada ? parseFloat(limiteAlcada) : 500.00,
          inquilino_id: inquilinoId || null,
          proprietario_id: proprietarioId || null
        })

        if (error) {
          if (error.message.includes("unico_codigo_por_imobiliaria")) {
            throw new Error("Você já possui um imóvel cadastrado com este Código de Identificação.")
          }
          throw error
        }

        setSucesso("Imóvel cadastrado com sucesso!")
      }

      // Limpa os campos
      setCodigoImovel("")
      setEndereco("")
      setBairro("")
      setCep("")
      setMetragem("")
      setLimiteAlcada("500.00")
      setInquilinoId("")
      setProprietarioId("")
      
      setFormAberto(false)
      await loadData() // Recarrega a tabela

    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar salvar o imóvel. Verifique as chaves e permissões do banco.")
    } finally {
      setSalvando(false)
    }
  }

  // Preenche o formulário para edição do imóvel selecionado
  const handleEditarClick = (imovel: Imovel) => {
    setErro(null)
    setSucesso(null)
    setImovelEditando(imovel)
    setCodigoImovel(imovel.codigo_imovel)
    setEndereco(imovel.endereco)
    setBairro(imovel.bairro)
    setCidade(imovel.cidade)
    setEstado(imovel.estado)
    setCep(imovel.cep)
    setMetragem(imovel.metragem_m2 ? imovel.metragem_m2.toString() : "")
    setLimiteAlcada(imovel.limite_alcada_r$.toString())
    setInquilinoId(imovel.inquilino_id || "")
    setProprietarioId(imovel.proprietario_id || "")
    setFormAberto(true)
  }

  // Limpa o formulário e cancela o modo de edição
  const handleCancelarEdicao = () => {
    setImovelEditando(null)
    setCodigoImovel("")
    setEndereco("")
    setBairro("")
    setCidade("Curitiba")
    setEstado("PR")
    setCep("")
    setMetragem("")
    setLimiteAlcada("500.00")
    setInquilinoId("")
    setProprietarioId("")
    setErro(null)
    setSucesso(null)
  }

  // Executa a exclusão lógica/física do imóvel
  const handleConfirmarExclusao = async () => {
    if (!imovelParaExcluir) return

    try {
      setDeleting(true)
      setErro(null)
      setSucesso(null)

      // Deleta o imóvel diretamente no Supabase (as permissões RLS da Imobiliária permitem)
      const { error } = await supabase
        .from("imoveis")
        .delete()
        .eq("id", imovelParaExcluir.id)

      if (error) throw error

      setSucesso(`Imóvel "${imovelParaExcluir.codigo_imovel}" excluído com sucesso!`)
      setImovelParaExcluir(null)
      
      // Se o imóvel que estava sendo editado foi excluído, cancela a edição
      if (imovelEditando && imovelEditando.id === imovelParaExcluir.id) {
        handleCancelarEdicao()
      }

      await loadData() // Recarrega a tabela
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar excluir o imóvel.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-occasio-navy flex items-center gap-2">
            <HomeIcon className="h-7 w-7 text-occasio-blue" /> Gestão de Imóveis
          </h1>
          <p className="text-slate-500 text-sm md:text-base">
            Cadastre os imóveis sob seu portfólio, defina a alçada de gastos e vincule proprietários e inquilinos.
          </p>
        </div>
        <Button 
          onClick={() => {
            if (formAberto) {
              handleCancelarEdicao()
              setFormAberto(false)
            } else {
              setFormAberto(true)
            }
          }} 
          className="bg-occasio-blue hover:bg-occasio-navy text-white flex gap-2 font-semibold shadow-md shadow-occasio-blue/20"
        >
          <Plus className="h-5 w-5" /> {formAberto ? "Cancelar" : "Cadastrar Imóvel"}
        </Button>
      </div>

      {erro && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="font-semibold">{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertDescription className="font-semibold">{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Formulário Lateral / Deslizante / Acoplado */}
      {formAberto && (
        <Card className="mb-8 border-slate-200 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-occasio-navy">
              {imovelEditando ? "Editar Imóvel" : "Cadastrar Novo Imóvel"}
            </CardTitle>
            <CardDescription>
              {imovelEditando 
                ? "Altere os dados do imóvel selecionado e clique em Salvar." 
                : "Preencha os dados abaixo. Itens com asterisco (*) são obrigatórios."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Código de Identificação *
                  </label>
                  <Input
                    placeholder="Ex: AP-102, CSO-5"
                    value={codigoImovel}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCodigoImovel(e.target.value)}
                    required
                  />
                  <span className="text-[10px] text-slate-400">Deve ser único em seu portfólio.</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    CEP *
                  </label>
                  <Input
                    placeholder="Ex: 80000-000"
                    value={cep}
                    onChange={handleCepChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Metragem (m²)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 78.50"
                      value={metragem}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMetragem(e.target.value)}
                    />
                    <Ruler className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Endereço Completo *
                  </label>
                  <Input
                    placeholder="Rua, Número, Complemento"
                    value={endereco}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndereco(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Bairro *
                  </label>
                  <Input
                    placeholder="Bairro"
                    value={bairro}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBairro(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Cidade
                  </label>
                  <Input
                    value={cidade}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCidade(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Estado
                  </label>
                  <Input
                    maxLength={2}
                    value={estado}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEstado(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Limite de Alçada para Manutenção (R$)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={limiteAlcada}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLimiteAlcada(e.target.value)}
                    />
                    <DollarSign className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                  </div>
                  <span className="text-[10px] text-slate-400">Até este valor, a imobiliária autoriza o serviço diretamente.</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Proprietário Vinculado
                  </label>
                  <select
                    value={proprietarioId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProprietarioId(e.target.value)}
                    className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-occasio-blue"
                  >
                    <option value="">Selecione um Proprietário...</option>
                    {proprietarios.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Inquilino Vinculado
                  </label>
                  <select
                    value={inquilinoId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInquilinoId(e.target.value)}
                    className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-occasio-blue"
                  >
                    <option value="">Selecione um Inquilino...</option>
                    {inquilinos.map(i => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => {
                    if (imovelEditando) {
                      handleCancelarEdicao()
                    }
                    setFormAberto(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button disabled={salvando} type="submit" className="bg-occasio-blue hover:bg-occasio-navy text-white font-semibold">
                  {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 
                  {imovelEditando ? "Salvar Alterações" : "Salvar Cadastro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Imóveis */}
      <Card className="border-slate-200 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
              <span>Carregando portfólio de imóveis...</span>
            </div>
          ) : imoveis.length === 0 ? (
            <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center gap-3">
              <MapPin className="h-12 w-12 text-slate-300" />
              <div className="font-semibold text-slate-500 text-lg">Nenhum imóvel cadastrado</div>
              <p className="max-w-xs mx-auto text-sm text-slate-400">
                Você ainda não possui imóveis sob sua gestão. Clique em "Cadastrar Imóvel" no topo para iniciar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-4">Código</th>
                    <th scope="col" className="px-6 py-4">Endereço</th>
                    <th scope="col" className="px-6 py-4">Metragem</th>
                    <th scope="col" className="px-6 py-4">Limite Alçada</th>
                    <th scope="col" className="px-6 py-4">Proprietário</th>
                    <th scope="col" className="px-6 py-4">Inquilino</th>
                    <th scope="col" className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {imoveis.map((imovel) => (
                    <tr key={imovel.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-occasio-navy">{imovel.codigo_imovel}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{imovel.endereco}</div>
                        <div className="text-xs text-slate-400">{imovel.bairro} - {imovel.cep} | {imovel.cidade}/{imovel.estado}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-800">
                        {imovel.metragem_m2 ? `${imovel.metragem_m2.toLocaleString('pt-BR')} m²` : "-"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {imovel.limite_alcada_r$.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {imovel.proprietario?.nome || <span className="text-slate-400 italic">Não vinculado</span>}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {imovel.inquilino?.nome || <span className="text-slate-400 italic">Não vinculado</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditarClick(imovel)}
                            className={`h-8 w-8 p-0 text-slate-500 hover:text-occasio-blue hover:bg-slate-100 ${
                              imovelEditando?.id === imovel.id ? "bg-slate-100 text-occasio-blue" : ""
                            }`}
                            title="Editar Imóvel"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setImovelParaExcluir(imovel)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            title="Excluir Imóvel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Exclusão de Imóvel */}
      {imovelParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md border-slate-200 shadow-2xl bg-white overflow-hidden animate-scale-in">
            <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
                <CardTitle className="text-lg font-extrabold">Excluir Imóvel</CardTitle>
              </div>
              <CardDescription className="text-red-700/80 text-xs font-semibold">
                Atenção: Esta ação é permanente e não poderá ser desfeita.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                Você está prestes a excluir a ficha do imóvel <strong className="text-slate-900">{imovelParaExcluir.codigo_imovel}</strong> ({imovelParaExcluir.endereco}). 
                Isto removerá o imóvel definitivamente do sistema de gestão da imobiliária.
              </p>
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setImovelParaExcluir(null)}
                  disabled={deleting}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarExclusao}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/10 text-xs"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                      Excluindo...
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
