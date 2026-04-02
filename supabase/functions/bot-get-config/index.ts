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
    const { bot_type, bot_id } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Priority: bot_id > bot_type (backward compatible)
    let query = supabase
      .from("bot_configs")
      .select("id, seller_name, platform, is_active, max_per_cycle, delay_seconds, dry_mode, bot_type, bot_id, schedule_time, last_heartbeat_at, last_run_at, leads_captured_today, facebook_account");

    if (bot_id && typeof bot_id === "string") {
      query = query.eq("bot_id", bot_id.trim().slice(0, 50));
    } else if (bot_type && ["messaging", "posting"].includes(bot_type)) {
      query = query.eq("bot_type", bot_type);
    } else {
      return new Response(JSON.stringify({ error: "bot_id ou bot_type é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Config não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, config: data }), {
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
