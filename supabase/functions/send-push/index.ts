import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-secret",
};

Deno.serve(async (req) => {
  // Trata requisições preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const triggerSecret = Deno.env.get("TRIGGER_SECRET") || "occasio_push_trigger_secret_998124";
    const incomingSecret = req.headers.get("x-trigger-secret");

    // Valida o token de segurança para evitar chamadas maliciosas
    if (incomingSecret !== triggerSecret) {
      console.warn("Tentativa de acesso não autorizada na Edge Function send-push.");
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, record } = await req.json();

    if (type !== "historico_insert" || !record || !record.chamado_id) {
      return new Response(JSON.stringify({ error: "Payload inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { chamado_id, novo_status, observacao } = record;

    // Inicializa o cliente admin do Supabase (com bypass de RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Busca os detalhes do chamado e os IDs dos envolvidos
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .select(`
        titulo,
        status,
        inquilino_id,
        empresa_prestadora_id,
        tecnico_id,
        imoveis:imovel_id (
          imobiliaria_id,
          proprietario_id,
          codigo_imovel
        )
      `)
      .eq("id", chamado_id)
      .single();

    if (chamadoError || !chamado) {
      throw new Error(`Chamado não encontrado: ${chamadoError?.message || "Sem retorno"}`);
    }

    const imovel = chamado.imoveis as any;
    const imobiliariaId = imovel?.imobiliaria_id;
    const proprietarioId = imovel?.proprietario_id;
    const inquilinoId = chamado.inquilino_id;
    const prestadoraId = chamado.empresa_prestadora_id;
    const tecnicoId = chamado.tecnico_id;
    const codigoImovel = imovel?.codigo_imovel || "N/A";
    const titulo = chamado.titulo;

    // Lista de notificações a serem disparadas
    const notifications: { userId: string; title: string; body: string; url: string }[] = [];

    // Helper para enfileirar a notificação caso o usuário exista
    const queueNotification = (userId: string | null, title: string, body: string, url: string) => {
      if (userId) {
        notifications.push({ userId, title, body, url });
      }
    };

    // Mapeamento lógico de quem notificar com base no status do histórico
    switch (novo_status) {
      case "aberto":
        queueNotification(
          imobiliariaId,
          "Novo chamado aberto 🛠️",
          `Imóvel ${codigoImovel}: chamado "${titulo}" aberto pelo inquilino.`,
          "/imobiliaria"
        );
        break;

      case "em_triagem":
        queueNotification(
          inquilinoId,
          "Chamado em triagem 🔍",
          `Seu chamado "${titulo}" está sendo analisado pela imobiliária.`,
          "/inquilino"
        );
        break;

      case "aguardando_orcamento":
        queueNotification(
          prestadoraId,
          "Novo chamado para orçamento 📝",
          `Você recebeu uma solicitação de orçamento para o chamado "${titulo}" no imóvel ${codigoImovel}.`,
          "/prestador"
        );
        break;

      case "orcamento_recebido":
        queueNotification(
          imobiliariaId,
          "Orçamento recebido 💰",
          `O prestador enviou o orçamento para o chamado "${titulo}".`,
          "/imobiliaria"
        );
        break;

      case "analise_proprietario":
        queueNotification(
          proprietarioId,
          "Orçamento para aprovação 📋",
          `Há um orçamento aguardando sua aprovação para o chamado "${titulo}".`,
          "/proprietario"
        );
        break;

      case "aguardando_autorizacao":
        queueNotification(
          imobiliariaId,
          "Orçamento aprovado pelo proprietário ✅",
          `O proprietário aprovou o orçamento do chamado "${titulo}". Por favor, autorize a execução.`,
          "/imobiliaria"
        );
        break;

      case "os_liberada":
        queueNotification(
          prestadoraId,
          "Ordem de Serviço liberada 🚀",
          `A execução do chamado "${titulo}" foi autorizada. Pode iniciar o serviço.`,
          "/prestador"
        );
        if (tecnicoId) {
          queueNotification(
            tecnicoId,
            "Ordem de Serviço atribuída 🛠️",
            `Você tem uma nova O.S. autorizada para execução: "${titulo}".`,
            "/prestador"
          );
        }
        queueNotification(
          inquilinoId,
          "Serviço autorizado ✅",
          `O serviço do chamado "${titulo}" foi autorizado e iniciará em breve.`,
          "/inquilino"
        );
        break;

      case "em_execucao":
        queueNotification(
          inquilinoId,
          "Serviço em andamento ⚡",
          `O técnico iniciou a execução do serviço "${titulo}".`,
          "/inquilino"
        );
        queueNotification(
          imobiliariaId,
          "Serviço em execução ⚙️",
          `O prestador iniciou a execução da O.S. "${titulo}".`,
          "/imobiliaria"
        );
        break;

      case "servico_concluido":
        queueNotification(
          imobiliariaId,
          "Serviço concluído pelo prestador 🏁",
          `O prestador concluiu a execução de "${titulo}". Avalie e homologue o chamado.`,
          "/imobiliaria"
        );
        queueNotification(
          inquilinoId,
          "Serviço concluído 📦",
          `A manutenção "${titulo}" foi sinalizada como concluída pelo técnico.`,
          "/inquilino"
        );
        break;

      case "encerrado":
        queueNotification(
          inquilinoId,
          "Chamado encerrado 🎉",
          `O chamado "${titulo}" foi finalizado e homologado pela imobiliária.`,
          "/inquilino"
        );
        queueNotification(
          proprietarioId,
          "Manutenção finalizada 📁",
          `A manutenção do chamado "${titulo}" foi concluída e encerrada.`,
          "/proprietario"
        );
        break;

      case "reprovado":
        queueNotification(
          prestadoraId,
          "Orçamento reprovado ❌",
          `O orçamento para o chamado "${titulo}" foi reprovado/recusado.`,
          "/prestador"
        );
        queueNotification(
          inquilinoId,
          "Chamado reprovado/cancelado ❌",
          `O chamado "${titulo}" foi reprovado ou cancelado pela imobiliária.`,
          "/inquilino"
        );
        break;

      default:
        // Caso genérico se houver algum outro status
        break;
    }

    // Configura os detalhes do VAPID para assinatura das chaves de push
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@occasioimob.com.br";
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    if (!publicKey || !privateKey) {
      throw new Error("Chaves VAPID não configuradas nas variáveis de ambiente.");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const results = [];

    // Envia cada notificação pendente para seu respectivo usuário
    for (const notif of notifications) {
      // Busca a inscrição de push do usuário no banco
      const { data: userProfile, error: profileError } = await supabase
        .from("perfis")
        .select("permite_push, push_subscription")
        .eq("id", notif.userId)
        .single();

      if (profileError || !userProfile) {
        results.push({ userId: notif.userId, status: "ignored", reason: "Perfil não encontrado ou erro no banco." });
        continue;
      }

      if (!userProfile.permite_push || !userProfile.push_subscription) {
        results.push({ userId: notif.userId, status: "ignored", reason: "Notificações push desativadas ou sem credenciais salvas." });
        continue;
      }

      const subscription = userProfile.push_subscription as any;

      try {
        // Envia a notificação via protocolo webpush
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
          JSON.stringify({
            title: notif.title,
            body: notif.body,
            data: {
              url: notif.url,
            },
          })
        );

        results.push({ userId: notif.userId, status: "success" });
        console.log(`Notificação push enviada com sucesso para o usuário: ${notif.userId}`);
      } catch (pushError: any) {
        console.error(`Erro ao disparar push para o usuário ${notif.userId}:`, pushError);
        results.push({ userId: notif.userId, status: "error", error: pushError.message });

        // Tratamento de limpeza: remove inscrições inválidas ou expiradas (404/410)
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          console.log(`Limpando inscrição expirada/inválida do usuário ${notif.userId}`);
          await supabase
            .from("perfis")
            .update({ permite_push: false, push_subscription: null })
            .eq("id", notif.userId);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erro interno na Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
