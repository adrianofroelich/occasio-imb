import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Shield, Link2, Trash2, RefreshCw, Loader2 } from "lucide-react"

interface PerfilSimplificado {
  id: string
  nome: string
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

export default function AdminVinculos() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()

  // Estados dos dados
  const [imobiliarias, setImobiliarias] = useState<PerfilSimplificado[]>([])
  const [empresas, setEmpresas] = useState<PerfilSimplificado[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])

  // Formulário
  const [imobiliariaId, setImobiliariaId] = useState("")
  const [empresaId, setEmpresaId] = useState("")

  // Loading e alertas
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Bloqueio de segurança (Apenas Super Admin)
  useEffect(() => {
    if (!loading && perfil?.perfil !== "super_admin") {
      navigate("/")
    }
  }, [perfil, loading, navigate])

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      // 1. Busca imobiliárias
      const { data: imobData, error: imobError } = await supabase
        .from("perfis")
        .select("id, nome")
        .eq("perfil", "imobiliaria")
        .order("nome")
      if (imobError) throw imobError
      setImobiliarias(imobData || [])

      // 2. Busca empresas prestadoras (perfil = prestador e sem empresa_mae_id)
      const { data: empData, error: empError } = await supabase
        .from("perfis")
        .select("id, nome")
        .eq("perfil", "prestador")
        .is("empresa_mae_id", null)
        .order("nome")
      if (empError) throw empError
      setEmpresas(empData || [])

      // 3. Busca vínculos ativos
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
      setErro("Falha ao carregar dados do painel administrativo.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && perfil?.perfil === "super_admin") {
      carregarDados()
    } else if (user) {
      setLoading(false)
    }
  }, [user, perfil])

  const handleCriarVinculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imobiliariaId || !empresaId) return
    setSalvando(true)
    setErro(null)
    setSucesso(null)

    try {
      const { error } = await supabase
        .from("vinculos_saas")
        .insert({
          imobiliaria_id: imobiliariaId,
          empresa_prestadora_id: empresaId
        })

      if (error) {
        if (error.code === "23505") {
          throw new Error("Este vínculo comercial já existe no sistema.")
        }
        throw error
      }

      setSucesso("Vínculo comercial estabelecido com sucesso!")
      setImobiliariaId("")
      setEmpresaId("")
      await carregarDados()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Erro ao tentar salvar o vínculo.")
    } finally {
      setSalvando(false)
    }
  }

  const handleRemoverVinculo = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este vínculo comercial?")) return
    setErro(null)
    setSucesso(null)

    try {
      const { error } = await supabase
        .from("vinculos_saas")
        .delete()
        .eq("id", id)

      if (error) throw error

      setSucesso("Vínculo comercial removido com sucesso!")
      await carregarDados()
    } catch (err: any) {
      console.error(err)
      setErro("Erro ao tentar remover o vínculo.")
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-occasio-blue" />
        <span>Carregando painel de controle administrativo...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-occasio-navy flex items-center gap-2">
            <Shield className="h-7 w-7 text-occasio-blue" /> Controle de Vínculos Comerciais
          </h1>
          <p className="text-slate-500 text-sm md:text-base">
            Conecte Imobiliárias com Empresas Prestadoras de Serviço credenciadas.
          </p>
        </div>
        <Button onClick={() => carregarDados()} variant="outline" size="sm" className="flex gap-2">
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
          <AlertDescription className="font-semibold">{sucesso}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Coluna do Formulário de Vínculo */}
        <div className="md:col-span-1">
          <Card className="border-slate-200 shadow-md bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-extrabold text-occasio-navy flex items-center gap-2">
                <Link2 className="h-4 w-4 text-occasio-blue" /> Novo Vínculo
              </CardTitle>
              <CardDescription className="text-xs">Vincule uma Imobiliária a um Prestador PJ.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCriarVinculo} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Imobiliária (Contratante) *
                  </label>
                  <select
                    value={imobiliariaId}
                    onChange={(e) => setImobiliariaId(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                  >
                    <option value="">Selecione a imobiliária...</option>
                    {imobiliarias.map((i) => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Empresa Prestadora (PJ) *
                  </label>
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-occasio-blue"
                  >
                    <option value="">Selecione a empresa...</option>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>

                <Button disabled={salvando} type="submit" className="w-full bg-occasio-blue hover:bg-occasio-navy text-white font-semibold">
                  {salvando ? "Criando Vínculo..." : "Criar Vínculo Comercial"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Coluna da Listagem de Vínculos */}
        <div className="md:col-span-2">
          <Card className="border-slate-200 shadow-md bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-extrabold text-occasio-navy">Vínculos Ativos ({vinculos.length})</CardTitle>
              <CardDescription className="text-xs">Lista de autorizações comerciais de prestadores para com as imobiliárias.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {vinculos.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-white flex flex-col items-center justify-center gap-2">
                  <Link2 className="h-8 w-8 text-slate-300" />
                  <span className="font-semibold text-slate-500">Nenhum vínculo comercial ativo</span>
                  <p className="max-w-xs text-[11px] text-slate-400">
                    Use o painel lateral para autorizar uma empresa de serviço a atender chamados de uma imobiliária.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {vinculos.map((v) => (
                    <div key={v.id} className="flex justify-between items-center p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Imobiliária:</span>{" "}
                          <strong className="text-occasio-navy text-sm font-bold">{v.imobiliaria?.nome}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Prestador PJ:</span>{" "}
                          <span className="text-slate-600 font-semibold">{v.empresa?.nome}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRemoverVinculo(v.id)}
                        variant="outline"
                        size="icon"
                        className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-700 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
