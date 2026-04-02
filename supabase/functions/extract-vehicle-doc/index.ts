import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, image_url } = await req.json();
    
    if (!image_base64 && !image_url) {
      throw new Error("image_base64 or image_url required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const imageContent = image_base64
      ? { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : { type: "image_url" as const, image_url: { url: image_url } };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em extrair dados de documentos de veículos brasileiros (CRV, CRLV, DUT).
Extraia TODOS os dados visíveis e retorne usando a tool extract_vehicle_data.
Se não conseguir ler algum campo, retorne null para ele.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todos os dados deste documento de veículo:" },
              imageContent,
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_vehicle_data",
            description: "Extract vehicle data from document image",
            parameters: {
              type: "object",
              properties: {
                brand: { type: "string", description: "Marca do veículo (ex: HONDA, YAMAHA)" },
                model: { type: "string", description: "Modelo completo (ex: CG 160 TITAN)" },
                year_manufacture: { type: "number", description: "Ano de fabricação" },
                year_model: { type: "number", description: "Ano do modelo" },
                plate: { type: "string", description: "Placa do veículo" },
                chassis: { type: "string", description: "Número do chassi" },
                renavam: { type: "string", description: "Código RENAVAM" },
                color: { type: "string", description: "Cor do veículo" },
                fuel: { type: "string", description: "Combustível (Gasolina, Flex, etc)" },
                engine_cc: { type: "string", description: "Cilindrada do motor" },
                owner_name: { type: "string", description: "Nome do proprietário" },
                owner_cpf: { type: "string", description: "CPF do proprietário" },
              },
              required: ["brand", "model"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_vehicle_data" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("Failed to process image");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("AI could not extract data from image");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Extract vehicle doc error:", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
