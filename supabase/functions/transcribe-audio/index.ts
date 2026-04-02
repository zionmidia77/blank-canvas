import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio_base64 } = await req.json();
    if (!audio_base64) {
      return new Response(
        JSON.stringify({ error: "audio_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Log AI usage
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.100.1");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    sb.from("ai_usage_logs").insert({ function_name: "transcribe-audio" }).then(() => {});

    // Strip the data URI prefix if present, keep raw base64
    const rawBase64 = audio_base64.replace(/^data:audio\/[^;]+;base64,/, "");
    
    // Detect mime type from the data URI or default to wav
    let mimeType = "audio/wav";
    const mimeMatch = audio_base64.match(/^data:(audio\/[^;]+);base64,/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    // Use image_url content type with data URI - Gemini supports audio this way
    const dataUri = `data:${mimeType};base64,${rawBase64}`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: dataUri,
                },
              },
              {
                type: "text",
                text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem aspas, sem prefixos, sem explicações. Se não conseguir entender, retorne '[áudio inaudível]'.",
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const transcription = result.choices?.[0]?.message?.content?.trim() || "[áudio inaudível]";

    return new Response(
      JSON.stringify({ success: true, transcription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Transcribe error:", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
