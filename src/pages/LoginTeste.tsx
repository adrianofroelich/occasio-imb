import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, AlertTriangle, Shield, Landmark, User, HardHat, UserCheck, LogOut } from "lucide-react"

// Estrutura das contas mockadas de teste
const CONTAS_TESTE = [
  {
    perfil: "super_admin" as const,
    email: "super@occasio.imb.br",
    nome: "Carlos Super Admin",
    documento: "000.000.000-00",
    telefone: "(41) 99999-0001",
    icone: Shield,
    cor: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-200",
    descricao: "Acesso total irrestrito para homologação e suporte de todas as imobiliárias."
  },
  {
    perfil: "imobiliaria" as const,
    email: "imobiliaria@occasio.imb.br",
    nome: "Occasio Imóveis Ltda",
    documento: "12.345.678/0001-99",
    telefone: "(41) 98888-0002",
    icone: Landmark,
    cor: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-200",
    descricao: "Gerencia imóveis, inquilinos, proprietários e analisa orçamentos de manutenção."
  },
  {
    perfil: "inquilino" as const,
    email: "inquilino@occasio.imb.br",
    nome: "João Inquilino de Teste",
    documento: "111.222.333-44",
    telefone: "(41) 97777-0003",
    icone: UserCheck,
    cor: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-200",
    descricao: "Visualiza seu imóvel alugado e abre novos chamados de manutenção."
  },
  {
    perfil: "prestador" as const,
    email: "prestador@occasio.imb.br",
    nome: "Pedro Prestador Hidráulica",
    documento: "222.333.444-55",
    telefone: "(41) 96666-0004",
    icone: HardHat,
    cor: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-200",
    descricao: "Envia orçamentos para chamados em aberto e realiza a execução dos serviços."
  },
  {
    perfil: "proprietario" as const,
    email: "proprietario@occasio.imb.br",
    nome: "Maria Proprietária de Teste",
    documento: "333.444.555-66",
    telefone: "(41) 95555-0005",
    icone: User,
    cor: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-200",
    descricao: "Aprova orçamentos que extrapolam a alçada financeira direta da imobiliária."
  }
]

export default function LoginTeste() {
  const { user, perfil, loading: authLoading, signOut } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Executa o login direto ou cadastra e loga se o usuário ainda não existir no auth.users
  const handleAcessoInstantaneo = async (conta: typeof CONTAS_TESTE[number]) => {
    setLoading(conta.perfil)
    setAlert(null)
    const senhaPadrao = "occasio12345"

    try {
      // 1. Tenta realizar login direto
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: conta.email,
        password: senhaPadrao
      })

      if (signInError) {
        // 2. Se o erro for de usuário não encontrado, tenta realizar o cadastro
        if (signInError.message.includes("Invalid login credentials")) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: conta.email,
            password: senhaPadrao,
            options: {
              data: {
                nome: conta.nome,
                perfil: conta.perfil,
                telefone: conta.telefone,
                documento_identificacao: conta.documento
              }
            }
          })

          if (signUpError) throw signUpError

          // Realiza login após cadastrar com sucesso
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email: conta.email,
            password: senhaPadrao
          })

          if (retryError) throw retryError
          
          setAlert({
            type: "success",
            message: `Conta de ${conta.nome} criada e logada com sucesso!`
          })
        } else {
          throw signInError
        }
      } else {
        setAlert({
          type: "success",
          message: `Logado com sucesso como: ${conta.nome} (${conta.perfil.toUpperCase()})`
        })
      }
    } catch (err: any) {
      console.error(err)
      setAlert({
        type: "error",
        message: `Erro na autenticação: ${err.message || "Tente novamente."}`
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center space-y-4 mb-10">
        <span className="bg-occasio-blue/10 text-occasio-blue border border-occasio-blue/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
          Painel de Desenvolvimento
        </span>
        <h1 className="text-3xl font-extrabold text-occasio-navy md:text-4xl">
          Simulador de Autenticação & RLS
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Crie contas e alterne sessões instantaneamente para testar a aplicação sob as regras de Row Level Security de cada ator.
        </p>
      </div>

      {alert && (
        <Alert className={`mb-8 ${alert.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          {alert.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          <AlertTitle className={alert.type === "success" ? "text-green-800" : "text-red-800 font-bold"}>
            {alert.type === "success" ? "Sucesso!" : "Atenção"}
          </AlertTitle>
          <AlertDescription className={alert.type === "success" ? "text-green-700" : "text-red-700"}>
            {alert.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Seção de Sessão Ativa */}
      <Card className="mb-8 border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-occasio-navy text-lg">Sessão Ativa Atualmente</CardTitle>
              <CardDescription>Dados decodificados a partir do Supabase Auth e tabela perfis.</CardDescription>
            </div>
            {user && (
              <Button variant="outline" size="sm" onClick={signOut} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 flex gap-2">
                <LogOut className="h-4 w-4" /> Deslogar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {authLoading ? (
            <div className="text-center py-4 text-slate-500">Carregando dados da sessão...</div>
          ) : user && perfil ? (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><strong className="text-slate-500">Nome do Usuário:</strong> {perfil.nome}</p>
                <p><strong className="text-slate-500">Email:</strong> {user.email}</p>
                <p><strong className="text-slate-500">Perfil Técnico:</strong> <span className="uppercase font-bold text-occasio-blue">{perfil.perfil}</span></p>
              </div>
              <div className="space-y-2">
                <p><strong className="text-slate-500">Documento:</strong> {perfil.documento_identificacao || "Não cadastrado"}</p>
                <p><strong className="text-slate-500">Telefone:</strong> {perfil.telefone || "Não cadastrado"}</p>
                <p><strong className="text-slate-500">ID de Usuário (UUID):</strong> <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{user.id}</code></p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 flex flex-col items-center justify-center gap-2">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <span>Nenhum usuário logado. Utilize os atalhos abaixo para autenticar instantaneamente.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listagem de Perfis de Teste */}
      <h2 className="text-xl font-bold text-occasio-navy mb-6">Selecione um Perfil para Simular</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CONTAS_TESTE.map((conta) => {
          const Icone = conta.icone
          const isAtivo = perfil?.perfil === conta.perfil

          return (
            <Card key={conta.perfil} className={`flex flex-col border transition-all duration-300 hover:shadow-lg ${isAtivo ? "ring-2 ring-occasio-blue border-occasio-blue" : "border-slate-200"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${conta.bg}`}>
                    <Icone className={`h-6 w-6 ${conta.cor}`} />
                  </div>
                  {isAtivo && (
                    <span className="bg-occasio-blue text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Ativo
                    </span>
                  )}
                </div>
                <CardTitle className="text-base text-occasio-navy">{conta.nome}</CardTitle>
                <CardDescription className="text-xs font-mono">{conta.email}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between space-y-4 pt-0">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {conta.descricao}
                </p>
                <Button
                  onClick={() => handleAcessoInstantaneo(conta)}
                  disabled={loading !== null || authLoading}
                  className={`w-full text-xs shadow-md ${isAtivo ? "bg-slate-200 text-slate-600 hover:bg-slate-300" : "bg-occasio-blue hover:bg-occasio-navy text-white"}`}
                >
                  {loading === conta.perfil ? "Carregando..." : isAtivo ? "Logado" : "Entrar como " + conta.nome.split(" ")[0]}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
