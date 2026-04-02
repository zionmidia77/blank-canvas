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

    const { client_id, phone, message, trigger_type = "manual", template_key } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - keep only digits, ensure 55 prefix
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 11) cleanPhone = "55" + cleanPhone;
    if (cleanPhone.length === 10) cleanPhone = "55" + cleanPhone;

    // Send via SMSdev API
    const smsResponse = await fetch(SMSDEV_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: SMSDEV_API_KEY,
        type: 9,
        number: cleanPhone,
        msg: message,
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("SMSdev response:", JSON.stringify(smsResult));

    const success = smsResult.situacao === "OK" || smsResult.codigo === "1";

    // Log in database
    if (client_id) {
      await supabase.from("sms_logs").insert({
        client_id,
        phone: cleanPhone,
        message,
        template_key,
        trigger_type,
        status: success ? "sent" : "failed",
        smsdev_id: smsResult.id?.toString() || null,
        error_message: success ? null : JSON.stringify(smsResult),
      });

      // Create interaction record
      await supabase.from("interactions").insert({
        client_id,
        type: "sms",
        content: `📱 SMS ${success ? "enviado" : "falhou"}: ${message.substring(0, 100)}...`,
        created_by: "system",
      });
    }

    return new Response(
      JSON.stringify({ success, sms_id: smsResult.id, details: smsResult }),
      { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
