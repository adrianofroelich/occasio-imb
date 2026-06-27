import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

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
        const { 
          email, password, nome, perfil, telefone, documento, 
          empresa_mae_id, categorias, creci, cep, endereco, 
          bairro, cidade, estado, tipo_repasse, prazo_repasse_dias,
          aceita_painel_digital
        } = body;

        const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          email_confirm: true,
          password: password,
          user_metadata: {
            nome: nome.trim(),
            perfil: perfil,
            telefone: telefone || null,
            documento_identificacao: documento || null,
            primeiro_acesso_pendente: true,
            empresa_mae_id: empresa_mae_id || null,
            categorias: categorias || null,
            creci: creci || null,
            cep: cep || null,
            endereco: endereco || null,
            bairro: bairro || null,
            cidade: cidade || null,
            estado: estado || null,
            tipo_repasse: tipo_repasse || null,
            prazo_repasse_dias: prazo_repasse_dias || null,
            aceita_painel_digital: aceita_painel_digital !== undefined ? aceita_painel_digital : true
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

        // 1. Atualiza a senha no Auth do Supabase e garante a confirmação do e-mail
        const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(
          userId,
          { 
            password,
            email_confirm: true
          }
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

      if (action === "atualizar-usuario") {
        const { 
          userId, email, nome, perfil, telefone, documento, 
          creci, cep, endereco, bairro, cidade, estado,
          tipo_repasse, prazo_repasse_dias, aceita_painel_digital
        } = body;

        const updateData: any = {};
        if (email) updateData.email = email.trim().toLowerCase();
        
        // Atualiza no Auth nativo do Supabase
        const { data, error } = await ctx.supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            ...updateData,
            user_metadata: {
              nome: nome?.trim(),
              perfil: perfil,
              telefone: telefone || null,
              documento_identificacao: documento || null,
              creci: creci || null,
              cep: cep || null,
              endereco: endereco || null,
              bairro: bairro || null,
              cidade: cidade || null,
              estado: estado || null,
              tipo_repasse: tipo_repasse || null,
              prazo_repasse_dias: prazo_repasse_dias || null,
              aceita_painel_digital: aceita_painel_digital !== undefined ? aceita_painel_digital : undefined
            }
          }
        );

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Atualiza os dados na tabela pública public.perfis utilizando o ctx.supabaseAdmin (bypassa RLS)
        const { error: dbError } = await ctx.supabaseAdmin
          .from("perfis")
          .update({
            nome: nome?.trim(),
            email: email ? email.trim().toLowerCase() : undefined,
            perfil: perfil,
            telefone: telefone || null,
            documento_identificacao: documento || null,
            creci: creci || null,
            cep: cep || null,
            endereco: endereco || null,
            bairro: bairro || null,
            cidade: cidade || null,
            estado: estado || null,
            tipo_repasse: tipo_repasse || null,
            prazo_repasse_dias: prazo_repasse_dias || null,
            aceita_painel_digital: aceita_painel_digital !== undefined ? aceita_painel_digital : undefined,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", userId);

        if (dbError) {
          return new Response(JSON.stringify({ error: dbError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ user: data.user }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (action === "deletar-usuario") {
        const { userId } = body;

        // 1. Busca o perfil para determinar o tipo e os filhos dependentes
        const { data: perfilData } = await ctx.supabaseAdmin
          .from("perfis")
          .select("perfil")
          .eq("id", userId)
          .single();

        if (perfilData) {
          const tipo = perfilData.perfil;

          if (tipo === "imobiliaria") {
            // A. Busca inquilinos e proprietários associados a imóveis dessa imobiliária
            const { data: imoveisData } = await ctx.supabaseAdmin
              .from("imoveis")
              .select("inquilino_id, proprietario_id")
              .eq("imobiliaria_id", userId);

            if (imoveisData && imoveisData.length > 0) {
              const idsExcluir = new Set<string>();
              imoveisData.forEach((imob: any) => {
                if (imob.inquilino_id) idsExcluir.add(imob.inquilino_id);
                if (imob.proprietario_id) idsExcluir.add(imob.proprietario_id);
              });

              // B. Deleta todos os inquilinos e proprietários do Auth do Supabase
              for (const id of idsExcluir) {
                await ctx.supabaseAdmin.auth.admin.deleteUser(id);
              }
            }
          } else if (tipo === "prestador") {
            // A. Busca técnicos vinculados a essa empresa prestadora
            const { data: tecnicosData } = await ctx.supabaseAdmin
              .from("perfis")
              .select("id")
              .eq("empresa_mae_id", userId);

            if (tecnicosData && tecnicosData.length > 0) {
              // B. Deleta cada técnico do Auth do Supabase
              for (const t of tecnicosData) {
                await ctx.supabaseAdmin.auth.admin.deleteUser(t.id);
              }
            }
          }
        }

        // 2. Deleta o usuário principal do Auth do Supabase
        const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
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
