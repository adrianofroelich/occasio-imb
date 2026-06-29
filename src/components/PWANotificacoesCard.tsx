import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Bell, Smartphone, Info, Loader2, Check, X, Share, Plus 
} from "lucide-react"

// Chave VAPID pública padrão para homologação/fallback
const DEFAULT_VAPID_PUBLIC_KEY = "BDrsEIWlTy1YTAZxpkN1f1C0EcuCjL15j8lxS3KaXzDE_BvlWIHEIGdmsP3hfiiG3ldbF89pWEc6foyFxSOe5es"

// Helper para converter a chave VAPID Base64URL para Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PWANotificacoesCard() {
  const { user, perfil, refreshPerfil } = useAuth()

  // Estados locais
  const [permitePush, setPermitePush] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  
  // Estados para PWA
  const [isStandalone, setIsStandalone] = useState<boolean>(false)
  const [isIOS, setIsIOS] = useState<boolean>(false)
  const [hasPrompt, setHasPrompt] = useState<boolean>(false)
  const [showIOSTutorial, setShowIOSTutorial] = useState<boolean>(false)

  // Sincroniza o estado do switch com a informação atual no perfil do usuário
  useEffect(() => {
    if (perfil) {
      setPermitePush(!!perfil.permite_push)
    }
  }, [perfil])

  // Detecção inicial de PWA e OS
  useEffect(() => {
    // 1. Verifica se já está rodando em modo standalone (PWA instalado)
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || 
                             (navigator as any).standalone === true
    setIsStandalone(isStandaloneMode)

    // 2. Verifica se o dispositivo é iOS
    const iosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    setIsIOS(iosDevice)

    // 3. Verifica se o prompt nativo já está disponível
    setHasPrompt(!!(window as any).deferredPrompt)

    // 4. Escuta o evento customizado disparado pelo App.tsx
    const handlePwaInstallable = () => {
      setHasPrompt(true)
    }
    window.addEventListener("pwa-installable", handlePwaInstallable)
    return () => {
      window.removeEventListener("pwa-installable", handlePwaInstallable)
    }
  }, [])

  // Gerencia o fluxo de disparo do Prompt nativo de instalação
  const handleInstallApp = async () => {
    if (isIOS) {
      // Abre o tutorial do iOS
      setShowIOSTutorial(true)
      return
    }

    const deferredPrompt = (window as any).deferredPrompt
    if (!deferredPrompt) {
      setErro("O assistente de instalação não está pronto para o seu navegador. Tente pelo menu lateral dele.")
      return
    }

    try {
      // Dispara o prompt nativo
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        setSucesso("Obrigado por instalar o aplicativo!")
        ;(window as any).deferredPrompt = null
        setHasPrompt(false)
      }
    } catch (err) {
      console.error("Erro ao disparar prompt de instalação:", err)
      setErro("Falha ao abrir a instalação nativa.")
    }
  }

  // Inscreve no serviço de Notificações Push
  const subscribeUserToPush = async (): Promise<PushSubscription | null> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Seu navegador não oferece suporte para notificações push.")
    }

    // Aguarda o Service Worker estar pronto
    const registration = await navigator.serviceWorker.ready
    
    // Verifica se já existe uma inscrição ativa
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      return existingSubscription
    }

    // Obtém a chave pública VAPID (do env ou fallback padrão)
    const vapidKeyStr = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY
    const convertedVapidKey = urlBase64ToUint8Array(vapidKeyStr)

    // Solicita a inscrição do PushManager
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as any
    })
  }

  // Remove a inscrição do serviço de Push do navegador
  const unsubscribeUserFromPush = async () => {
    if (!("serviceWorker" in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }
  }

  // Trata a alteração do Toggle liga/desliga de notificações
  const handleTogglePush = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setLoading(true)
    setErro(null)
    setSucesso(null)

    if (!user) {
      setErro("Você precisa estar logado para realizar esta configuração.")
      setLoading(false)
      return
    }

    try {
      if (checked) {
        // Fluxo de Ativação
        if (!("Notification" in window)) {
          throw new Error("Este dispositivo não oferece suporte a notificações no navegador.")
        }

        // Solicita a permissão nativa
        const permission = await Notification.requestPermission()
        if (permission === "denied") {
          throw new Error("Permissão negada. Você bloqueou as notificações para este site nas configurações do seu navegador.")
        }

        if (permission !== "granted") {
          throw new Error("Permissão para notificações não concedida.")
        }

        // Gera a PushSubscription do service worker
        const subscription = await subscribeUserToPush()
        
        if (!subscription) {
          throw new Error("Não foi possível gerar as credenciais de push com o navegador.")
        }

        // Converte para JSON
        const subscriptionJSON = subscription.toJSON()

        // Envia as chaves e o endpoint para a tabela public.perfis do Supabase
        const { error: updateError } = await supabase
          .from("perfis")
          .update({
            permite_push: true,
            push_subscription: subscriptionJSON
          })
          .eq("id", user.id)

        if (updateError) throw updateError

        setPermitePush(true)
        setSucesso("Notificações no celular ativadas com sucesso!")
      } else {
        // Fluxo de Desativação
        await unsubscribeUserFromPush()

        // Atualiza o Supabase definindo como falso/null
        const { error: updateError } = await supabase
          .from("perfis")
          .update({
            permite_push: false,
            push_subscription: null
          })
          .eq("id", user.id)

        if (updateError) throw updateError

        setPermitePush(false)
        setSucesso("Notificações desativadas.")
      }

      // Atualiza o contexto global do perfil do usuário autenticado
      await refreshPerfil()
    } catch (err: any) {
      console.error(err)
      setErro(err.message || "Ocorreu um erro ao configurar as notificações por push.")
      // Reverte o switch local se houver falha no fluxo
      setPermitePush(!checked)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Bloco de Mensagens */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-start gap-2 animate-fadeIn">
          <Info className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
          <p className="text-xs font-semibold leading-relaxed">
            {erro}
          </p>
        </div>
      )}

      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex items-start gap-2 animate-fadeIn">
          <Check className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
          <p className="text-xs font-semibold leading-relaxed">
            {sucesso}
          </p>
        </div>
      )}

      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-occasio-blue" />
            <div>
              <CardTitle className="text-sm font-extrabold text-occasio-navy">Configurações do Celular</CardTitle>
              <CardDescription className="text-[11px] text-slate-400">Notificações e facilidade de acesso.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          
          {/* Seção 1: Notificações Push */}
          <div className="flex items-center justify-between gap-4 py-1.5">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-occasio-blue" /> Notificações no Celular
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed max-w-[280px]">
                Receba atualizações do conserto e aprovações em tempo real no seu dispositivo.
              </p>
            </div>
            
            {/* Toggle customizado premium */}
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={permitePush}
                onChange={handleTogglePush}
                disabled={loading}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-occasio-blue/30 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-occasio-blue peer-disabled:opacity-50"></div>
              {loading && (
                <Loader2 className="absolute -left-5 h-3.5 w-3.5 animate-spin text-occasio-blue" />
              )}
            </label>
          </div>

          {/* Seção 2: Instalação do PWA (somente visível se não estiver standalone e (for iOS ou tiver o prompt de instalação pronto)) */}
          {!isStandalone && (isIOS || hasPrompt) && (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block">
                  Aplicativo na Tela Inicial
                </span>
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-[280px]">
                  Instale o PWA na tela inicial do seu celular para acesso rápido e visual limpo de aplicativo.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleInstallApp}
                className="bg-occasio-blue hover:bg-occasio-navy text-white text-[11px] font-bold h-8 px-3 rounded shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
              >
                Instalar Aplicativo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          MODAL/TUTORIAL ELEGANTE DE INSTALAÇÃO PWA PARA DISPOSITIVOS iOS (Safari)
          ========================================================================= */}
      {showIOSTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-5 animate-slideUp">
            
            {/* Botão de Fechar */}
            <button 
              onClick={() => setShowIOSTutorial(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Fechar tutorial"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Cabeçalho */}
            <div className="text-center space-y-1">
              <Smartphone className="h-8 w-8 text-occasio-blue mx-auto mb-1 animate-bounce" />
              <h3 className="text-base font-extrabold text-occasio-navy">
                Instalar no iPhone / iPad
              </h3>
              <p className="text-xs text-slate-400">
                Adicione o aplicativo à sua tela de início usando o Safari.
              </p>
            </div>

            {/* Passos do Tutorial */}
            <div className="space-y-4 pt-1">
              
              {/* Passo 1 */}
              <div className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-occasio-blue/10 text-occasio-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    Abra o menu de Compartilhamento
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Toque no botão <strong className="text-slate-700">Compartilhar</strong> na barra inferior do Safari (o ícone de quadrado com uma seta para cima).
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 w-fit">
                    <Share className="h-4 w-4 text-slate-600" />
                    <span className="text-[10px] text-slate-600 font-semibold">Compartilhar</span>
                  </div>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-occasio-blue/10 text-occasio-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    Adicione à Tela de Início
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Role a lista de opções para baixo e selecione a opção <strong className="text-slate-700">Adicionar à Tela de Início</strong>.
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 w-fit">
                    <div className="bg-slate-200 rounded p-0.5 text-slate-700 flex items-center justify-center">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-600 font-semibold">Adicionar à Tela de Início</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Ação Principal */}
            <div className="pt-2">
              <Button
                onClick={() => setShowIOSTutorial(false)}
                className="w-full bg-occasio-blue hover:bg-occasio-navy text-white text-xs font-extrabold h-9 shadow-md"
              >
                Entendi, obrigado!
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
