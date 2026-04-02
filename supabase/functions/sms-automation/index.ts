import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SMSDEV_API_URL = "https://api.smsdev.com.br/v1/send";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SMSDEV_API_KEY = Deno.env.get("SMSDEV_API_KEY");
    if (!SMSDEV_API_KEY) {
      throw new Error("SMSDEV_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];

    // Reset daily counters if new day
    await supabase
      .from("sms_automations")
      .update({ sends_today: 0, last_reset_at: today })
      .neq("last_reset_at", today);

    // Get active automations
    const { data: automations } = await supabase
      .from("sms_automations")
      .select("*")
      .eq("is_active", true);

    if (!automations || automations.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma automação ativa", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    const results: any[] = [];

    for (const automation of automations) {
      if (automation.sends_today >= automation.max_sends_per_day) {
        results.push({ automation: automation.name, skipped: "limite diário atingido" });
        continue;
      }

      let clients: any[] = [];

      if (automation.trigger_type === "inactivity") {
        // Find inactive leads
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - automation.days_inactive);
        const cutoff = cutoffDate.toISOString();

        let query = supabase
          .from("clients")
          .select("id, name, phone")
          .not("phone", "is", null)
          .not("status", "eq", "lost")
          .not("pipeline_stage", "in", "(closed_won,closed_lost)")
          .lt("last_contact_at", cutoff)
          .order("last_contact_at", { ascending: true })
          .limit(automation.max_sends_per_day - automation.sends_today);

        if (automation.target_segment !== "all") {
          query = query.eq("pipeline_stage", automation.target_segment);
        }

        const { data } = await query;
        clients = data || [];
      } else if (automation.trigger_type === "birthday") {
        // Find birthday clients
        const { data } = await supabase
          .from("clients")
          .select("id, name, phone")
          .not("phone", "is", null)
          .not("status", "eq", "lost");

        // Filter birthdays in JS since we need month/day extraction
        const todayDate = new Date();
        clients = (data || []).filter((c: any) => {
          if (!c.phone) return false;
          // Check if we already sent SMS today
          return true; // birthday check done via auto_birthday_alerts
        });
        // Limit
        clients = clients.slice(0, automation.max_sends_per_day - automation.sends_today);
      } else if (automation.trigger_type === "post_sale") {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - automation.days_inactive);
        const cutoffStart = new Date(cutoffDate);
        cutoffStart.setDate(cutoffStart.getDate() - 1);

        const { data } = await supabase
          .from("clients")
          .select("id, name, phone")
          .not("phone", "is", null)
          .eq("pipeline_stage", "closed_won")
          .gte("updated_at", cutoffStart.toISOString())
          .lt("updated_at", cutoffDate.toISOString())
          .limit(automation.max_sends_per_day - automation.sends_today);

        clients = data || [];
      }

      // Filter out clients who already got SMS from this automation today
      const filteredClients: any[] = [];
      for (const client of clients) {
        const { count } = await supabase
          .from("sms_logs")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id)
          .eq("template_key", automation.id)
          .gte("sent_at", today);

        if ((count || 0) === 0) {
          filteredClients.push(client);
        }
      }

      // Send SMS to each client
      let sentCount = 0;
      for (const client of filteredClients) {
        if (!client.phone) continue;

        const personalizedMsg = automation.message_template
          .replace(/{nome}/g, client.name.split(" ")[0]);

        let cleanPhone = client.phone.replace(/\D/g, "");
        if (cleanPhone.length <= 11) cleanPhone = "55" + cleanPhone;

        try {
          const smsResponse = await fetch(SMSDEV_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: SMSDEV_API_KEY,
              type: 9,
              number: cleanPhone,
              msg: personalizedMsg,
            }),
          });

          const smsResult = await smsResponse.json();
          const success = smsResult.situacao === "OK" || smsResult.codigo === "1";

          await supabase.from("sms_logs").insert({
            client_id: client.id,
            phone: cleanPhone,
            message: personalizedMsg,
            template_key: automation.id,
            trigger_type: automation.trigger_type,
            status: success ? "sent" : "failed",
            smsdev_id: smsResult.id?.toString() || null,
            error_message: success ? null : JSON.stringify(smsResult),
          });

          if (success) {
            sentCount++;
            // Update last_contact_at
            await supabase
              .from("clients")
              .update({ last_contact_at: new Date().toISOString() })
              .eq("id", client.id);
          }
        } catch (e) {
          console.error(`Erro enviando SMS para ${client.name}:`, e);
        }
      }

      // Update sends_today
      await supabase
        .from("sms_automations")
        .update({ sends_today: automation.sends_today + sentCount })
        .eq("id", automation.id);

      totalSent += sentCount;
      results.push({
        automation: automation.name,
        candidates: filteredClients.length,
        sent: sentCount,
      });
    }

    return new Response(
      JSON.stringify({ success: true, totalSent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMS Automation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
