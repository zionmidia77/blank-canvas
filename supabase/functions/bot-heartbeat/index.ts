import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const botToken = req.headers.get("x-bot-token");
    const expectedToken = Deno.env.get("BOT_SECRET_TOKEN");

    if (!expectedToken || botToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { config_id, bot_id } = body;

    if (!config_id && !bot_id) {
      return new Response(JSON.stringify({ error: "config_id ou bot_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    let query = supabase
      .from("bot_configs")
      .update({
        last_heartbeat_at: now,
        last_run_at: now,
        updated_at: now,
      });

    // Priority: bot_id > config_id (backward compatible)
    if (bot_id && typeof bot_id === "string") {
      query = query.eq("bot_id", bot_id.trim().slice(0, 50));
    } else {
      query = query.eq("id", config_id);
    }

    const { data, error } = await query
      .select("id, seller_name, bot_id, is_active, last_heartbeat_at, last_run_at")
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Config não encontrada ou erro ao atualizar" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Heartbeat registrado",
      config: data,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
