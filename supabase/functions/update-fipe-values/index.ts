import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all vehicles that have FIPE codes stored
    const { data: vehicles, error: fetchError } = await supabase
      .from("stock_vehicles")
      .select("id, brand, model, fipe_brand_code, fipe_model_code, fipe_year_code, fipe_vehicle_type")
      .not("fipe_brand_code", "is", null)
      .not("fipe_model_code", "is", null)
      .not("fipe_year_code", "is", null);

    if (fetchError) throw fetchError;

    if (!vehicles || vehicles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum veículo com códigos FIPE encontrado", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    const errors: string[] = [];

    for (const vehicle of vehicles) {
      try {
        const type = vehicle.fipe_vehicle_type || "carros";
        const url = `${FIPE_BASE}/${type}/marcas/${vehicle.fipe_brand_code}/modelos/${vehicle.fipe_model_code}/anos/${vehicle.fipe_year_code}`;
        
        const resp = await fetch(url);
        if (!resp.ok) {
          errors.push(`Vehicle ${vehicle.id}: FIPE API error ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        const priceStr = data.Valor?.replace("R$ ", "").replace(/\./g, "").replace(",", ".");
        const price = parseFloat(priceStr);

        if (!isNaN(price)) {
          const { error: updateError } = await supabase
            .from("stock_vehicles")
            .update({ fipe_value: price, fipe_updated_at: new Date().toISOString() })
            .eq("id", vehicle.id);

          if (updateError) {
            errors.push(`Vehicle ${vehicle.id}: DB update error - ${updateError.message}`);
          } else {
            updated++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors.push(`Vehicle ${vehicle.id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: vehicles.length, updated, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Update FIPE error:", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
