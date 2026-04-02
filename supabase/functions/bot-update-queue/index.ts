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
    const { item_id, status, error_msg } = body;

    if (!item_id || typeof item_id !== "string") {
      return new Response(JSON.stringify({ error: "item_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validStatuses = ["pending", "posted", "error"];
    if (!status || !validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: "status inválido (pending, posted, error)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updateData: Record<string, unknown> = { status };
    if (status === "posted") {
      updateData.posted_at = new Date().toISOString();
    }
    if (error_msg) {
      updateData.error_msg = String(error_msg).slice(0, 500);
    }

    const { data, error } = await supabase
      .from("bot_posting_queue")
      .update(updateData)
      .eq("id", item_id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar fila:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the item failed, automatically fetch the next pending item
    let nextItem = null;
    if (status === "error") {
      const { data: next, error: nextError } = await supabase
        .from("bot_posting_queue")
        .select("id, vehicle_id, local_bot_id, scheduled_for")
        .eq("status", "pending")
        .lte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextError && next) {
        nextItem = next;
      }
    }

    return new Response(JSON.stringify({ success: true, item: data, next_item: nextItem }), {
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
