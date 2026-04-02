import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// FIPE API base URL (public API)
const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, brand_code, model_code, year_code, vehicle_type } = await req.json();
    const type = vehicle_type || "motos"; // motos, carros, caminhoes

    let url = "";
    switch (action) {
      case "brands":
        url = `${FIPE_BASE}/${type}/marcas`;
        break;
      case "models":
        if (!brand_code) throw new Error("brand_code required");
        url = `${FIPE_BASE}/${type}/marcas/${brand_code}/modelos`;
        break;
      case "years":
        if (!brand_code || !model_code) throw new Error("brand_code and model_code required");
        url = `${FIPE_BASE}/${type}/marcas/${brand_code}/modelos/${model_code}/anos`;
        break;
      case "price":
        if (!brand_code || !model_code || !year_code) throw new Error("brand_code, model_code, year_code required");
        url = `${FIPE_BASE}/${type}/marcas/${brand_code}/modelos/${model_code}/anos/${year_code}`;
        break;
      default:
        throw new Error("Invalid action. Use: brands, models, years, price");
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`FIPE API error: ${resp.status}`);
    }
    const data = await resp.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("FIPE lookup error:", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
