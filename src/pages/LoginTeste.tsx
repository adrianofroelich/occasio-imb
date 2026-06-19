import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertTriangle, Shield, Landmark, User, HardHat, UserCheck, LogOut, Clock } from "lucide-react"

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

interface UsuarioDinamico {
  id: string
  nome: string
  email: string
  perfil: 'inquilino' | 'proprietario' | 'prestador' | 'imobiliaria'
  primeiro_acesso_pendente: boolean
  telefone: string | null
  documento_identificacao: string | null
  empresa_mae_id?: string | null
  categorias?: string[] | null
}

export default function LoginTeste() {
  const navigate = useNavigate()
  const { user, perfil, loading: authLoading, signOut } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [usuariosDinamicos, setUsuariosDinamicos] = useState<UsuarioDinamico[]>([])

  // Bloqueio de segurança em ambiente de produção
  useEffect(() => {
    if (import.meta.env.PROD) {
      navigate("/login")
    }
  }, [navigate])

  // Carrega os usuários dinâmicos da tabela de perfis (excluindo os mockados fixos)
  const carregarUsuariosDinamicos = async () => {
    try {
      const emailsMocks = CONTAS_TESTE.map(c => c.email)
      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome, email, perfil, primeiro_acesso_pendente, telefone, documento_identificacao, empresa_mae_id, categorias")
        .order("criado_em", { ascending: false })

      if (error) throw error
      
      // Filtra e-mails válidos e que não sejam das contas estáticas de teste
      const dinâmicos = (data || [])
        .filter(u => u.email && !emailsMocks.includes(u.email)) as UsuarioDinamico[]
        
      setUsuariosDinamicos(dinâmicos)
    } catch (err) {
      console.error("Erro ao carregar usuários dinâmicos:", err)
    }
  }

  useEffect(() => {
    carregarUsuariosDinamicos()
  }, [user])

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
        if (
          signInError.message.includes("Invalid login credentials") || 
          signInError.message.includes("User not found") || 
          signInError.message.includes("Email not confirmed")
        ) {
          
          // 2. Verifica se o usuário já existe na tabela de perfis para resgatar o ID dele
          const { data: perfilData } = await supabase
            .from("perfis")
            .select("id")
            .eq("email", conta.email)
            .maybeSingle()

          if (perfilData?.id) {
            // Se já existe, redefinimos a senha dele administrativamente via Edge Function para a senha padrão de teste
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke("admin-helper", {
              body: {
                action: "simular-primeiro-acesso",
                userId: perfilData.id,
                password: senhaPadrao
              }
            })

            if (edgeError || (edgeData && edgeData.error)) {
              throw new Error(edgeError?.message || edgeData?.error || "Erro ao resincronizar a senha da conta de teste.")
            }

            // Tenta logar novamente com a nova senha sincronizada
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: conta.email,
              password: senhaPadrao
            })
            if (retryError) throw retryError

            setAlert({
              type: "success",
              message: `A senha de ${conta.nome} foi sincronizada para "${senhaPadrao}" e o login foi realizado com sucesso!`
            })
          } else {
            // Se não existe, cria a conta no auth.users via signUp
            const { error: signUpError } = await supabase.auth.signUp({
              email: conta.email,
              password: senhaPadrao,
              options: {
                data: {
                  nome: conta.nome,
                  perfil: conta.perfil,
                  telefone: conta.telefone,
                  documento_identificacao: conta.documento,
                  primeiro_acesso_pendente: false // contas mockadas estáticas já iniciam ativas
                }
              }
            })

            if (signUpError) throw signUpError

            // Efetua o login após criar
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: conta.email,
              password: senhaPadrao
            })
            if (retryError) throw retryError
            
            setAlert({
              type: "success",
              message: `Conta de ${conta.nome} criada e logada com sucesso!`
            })
          }
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

  // Simula o login ou primeiro acesso dos usuários dinâmicos
  const handleAcessoDinamico = async (usuario: UsuarioDinamico) => {
    setLoading(usuario.id)
    setAlert(null)
    const senhaPadrao = "occasio12345"

    try {
      if (usuario.primeiro_acesso_pendente) {
        // Simulação de Primeiro Acesso usando a Edge Function 'admin-helper':
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke("admin-helper", {
          body: {
            action: "simular-primeiro-acesso",
            userId: usuario.id,
            password: senhaPadrao
          }
        })
        if (edgeError || (edgeData && edgeData.error)) {
          throw new Error(edgeError?.message || edgeData?.error || "Erro ao atualizar a senha administrativamente.")
        }

        // 3. Faz login normal
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: usuario.email,
          password: senhaPadrao
        })
        if (signInError) throw signInError

        setAlert({
          type: "success",
          message: `Primeiro acesso realizado! Senha definida para "${senhaPadrao}" e login efetuado com sucesso como ${usuario.nome}.`
        })
      } else {
        // Login normal
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: usuario.email,
          password: senhaPadrao
        })

        if (signInError) {
          // Fallback se a senha não estiver sincronizada: redefinimos administrativamente e logamos
          if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("User not found")) {
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke("admin-helper", {
              body: {
                action: "simular-primeiro-acesso",
                userId: usuario.id,
                password: senhaPadrao
              }
            })
            if (edgeError || (edgeData && edgeData.error)) {
              throw new Error(edgeError?.message || edgeData?.error || "Erro ao atualizar a senha administrativamente.")
            }

            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: usuario.email,
              password: senhaPadrao
            })
            if (retryError) throw retryError

            setAlert({
              type: "success",
              message: `Senha resincronizada para "${senhaPadrao}". Logado com sucesso como: ${usuario.nome}`
            })
          } else {
            throw signInError
          }
        } else {
          setAlert({
            type: "success",
            message: `Logado com sucesso como: ${usuario.nome} (${usuario.perfil.toUpperCase()})`
          })
        }
      }
      
      // Recarrega a lista dinamicamente
      await carregarUsuariosDinamicos()
    } catch (err: any) {
      console.error(err)
      setAlert({
        type: "error",
        message: `Erro ao simular acesso dinâmico: ${err.message || "Tente novamente."}`
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

      {/* Listagem de Perfis de Teste Fixos */}
      <h2 className="text-xl font-bold text-occasio-navy mb-6">Contas Estáticas de Homologação</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {CONTAS_TESTE.map((conta) => {
          const Icone = conta.icone
          const isAtivo = perfil?.perfil === conta.perfil && user?.email === conta.email

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

      {/* Listagem de Usuários Cadastrados Dinamicamente */}
      <div className="mt-12">
        <div className="flex flex-col mb-6">
          <h2 className="text-xl font-bold text-occasio-navy flex items-center gap-2">
            <User className="h-6 w-6 text-occasio-blue" />
            Clientes Cadastrados no Onboarding
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Usuários criados dinamicamente no painel de Clientes da Imobiliária. Simule o Primeiro Acesso (definição de senha) ou faça o login normal.
          </p>
        </div>

        {usuariosDinamicos.length === 0 ? (
          <Card className="border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-slate-500">
            <User className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">Nenhum cliente dinâmico cadastrado ainda.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Acesse a tela de Clientes com uma conta de Imobiliária (/imobiliaria/clientes) e cadastre proprietários ou inquilinos para vê-los aqui.
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {usuariosDinamicos.map((usuario) => {
              const isAtivo = user?.id === usuario.id
              
              const Icone = 
                usuario.perfil === "inquilino" ? UserCheck :
                usuario.perfil === "proprietario" ? User :
                usuario.perfil === "prestador" ? HardHat : Landmark

              const corBadge = 
                usuario.perfil === "inquilino" ? "bg-sky-50 text-sky-700 border-sky-200" :
                usuario.perfil === "proprietario" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                usuario.perfil === "prestador" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-blue-50 text-blue-700 border-blue-200"

              const labelPerfil = 
                usuario.perfil === "inquilino" ? "Inquilino" :
                usuario.perfil === "proprietario" ? "Proprietário" :
                usuario.perfil === "imobiliaria" ? "Imobiliária" :
                usuario.empresa_mae_id ? "Técnico Vinculado" : "Empresa Prestadora (PJ)"

              return (
                <Card key={usuario.id} className={`flex flex-col border transition-all duration-300 hover:shadow-lg ${isAtivo ? "ring-2 ring-occasio-blue border-occasio-blue" : "border-slate-200"}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`p-1 rounded ${
                          usuario.perfil === "inquilino" ? "bg-sky-50" : 
                          usuario.perfil === "proprietario" ? "bg-indigo-50" :
                          usuario.perfil === "prestador" ? "bg-amber-50" : "bg-blue-50"
                        }`}>
                          <Icone className={`h-3.5 w-3.5 ${
                            usuario.perfil === "inquilino" ? "text-sky-600" : 
                            usuario.perfil === "proprietario" ? "text-indigo-600" :
                            usuario.perfil === "prestador" ? "text-amber-600" : "text-blue-600"
                          }`} />
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${corBadge}`}>
                          {labelPerfil}
                        </Badge>
                      </div>
                      {usuario.primeiro_acesso_pendente ? (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3" /> 1º Acesso Pendente
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                          Ativo
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base text-occasio-navy truncate">{usuario.nome}</CardTitle>
                    <CardDescription className="text-xs font-mono truncate">{usuario.email}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-between space-y-4 pt-0">
                    <div className="text-xs text-slate-500 space-y-1">
                      {usuario.telefone && <p><strong>Tel:</strong> {usuario.telefone}</p>}
                      {usuario.documento_identificacao && <p><strong>Doc:</strong> {usuario.documento_identificacao}</p>}
                      {usuario.categorias && usuario.categorias.length > 0 && (
                        <p className="truncate"><strong>Espec:</strong> {usuario.categorias.join(", ")}</p>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => handleAcessoDinamico(usuario)}
                      disabled={loading !== null || authLoading}
                      className={`w-full text-xs shadow-md font-semibold transition-all ${
                        isAtivo 
                          ? "bg-slate-200 text-slate-600 hover:bg-slate-300" 
                          : usuario.primeiro_acesso_pendente 
                            ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/10" 
                            : "bg-occasio-blue hover:bg-occasio-navy text-white shadow-occasio-blue/10"
                      }`}
                    >
                      {loading === usuario.id 
                        ? "Processando..." 
                        : isAtivo 
                          ? "Logado" 
                          : usuario.primeiro_acesso_pendente 
                            ? "Simular Primeiro Acesso" 
                            : "Acessar Painel"}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
