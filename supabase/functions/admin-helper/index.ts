import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    // Trata requisição CORS OPTIONS (preflight)
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const { action, ...body } = await req.json();

      if (action === "criar-cliente") {
        const { email, password, nome, perfil, telefone, documento } = body;

        const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          email_confirm: true,
          password: password,
          user_metadata: {
            nome: nome.trim(),
            perfil: perfil,
            telefone: telefone || null,
            documento_identificacao: documento || null,
            primeiro_acesso_pendente: true
          }
        });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ user: data.user }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (action === "simular-primeiro-acesso") {
        const { userId, password } = body;

        // 1. Atualiza a senha no Auth do Supabase
        const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password }
        );

        if (authError) {
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 2. Atualiza a flag na tabela public.perfis
        const { error: dbError } = await ctx.supabaseAdmin
          .from("perfis")
          .update({ primeiro_acesso_pendente: false })
          .eq("id", userId);

        if (dbError) {
          return new Response(JSON.stringify({ error: dbError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: true, user: authData.user }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }),
};
