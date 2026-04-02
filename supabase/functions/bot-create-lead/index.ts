import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-token",
};

// In-memory rate limiting (resets on cold start, good enough for edge)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(token);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ===== PHONE VALIDATION =====

// Known placeholder/fake phone patterns
const BLOCKED_PHONES = [
  "99999999999",
  "11999999999",
  "5511999999999",
  "00000000000",
  "12345678901",
  "98765432100",
  "11111111111",
  "22222222222",
  "33333333333",
  "44444444444",
  "55555555555",
  "66666666666",
  "77777777777",
  "88888888888",
];

function isPhoneValid(phone: string | null): boolean {
  if (!phone) return false;

  // Remove country code prefix for comparison
  const digits = phone.replace(/\D/g, "");

  // Too short to be valid
  if (digits.length < 10) return false;

  // Check blocklist (with and without country code)
  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  if (BLOCKED_PHONES.includes(digits) || BLOCKED_PHONES.includes(withoutCountry)) {
    return false;
  }

  // All digits are the same (e.g., 99999999999)
  if (/^(\d)\1+$/.test(digits)) return false;

  // All digits after DDD are the same (e.g., 49999999999)
  const afterDDD = withoutCountry.slice(2); // remove DDD
  if (afterDDD.length >= 8 && /^(\d)\1+$/.test(afterDDD)) return false;

  // Sequential ascending or descending
  const isSequential = (s: string) => {
    let asc = true, desc = true;
    for (let i = 1; i < s.length; i++) {
      if (parseInt(s[i]) !== parseInt(s[i - 1]) + 1) asc = false;
      if (parseInt(s[i]) !== parseInt(s[i - 1]) - 1) desc = false;
    }
    return asc || desc;
  };
  if (afterDDD.length >= 8 && isSequential(afterDDD)) return false;

  return true;
}

// ===== MAIN HANDLER =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate bot token
    const botToken = req.headers.get("x-bot-token");
    const expectedToken = Deno.env.get("BOT_SECRET_TOKEN");

    if (!expectedToken || botToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    if (!checkRateLimit(botToken)) {
      return new Response(JSON.stringify({ error: "Rate limit excedido. Máximo 100 leads/hora." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }

    const body = await req.json();
    const { name, phone, email, interest, source, city, budget_range, notes, seller_name, local_vehicle_id } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (name.trim().length > 255) {
      return new Response(JSON.stringify({ error: "Nome muito longo (máx 255 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize phone (keep only digits and +)
    const sanitizedPhone = phone ? String(phone).replace(/[^\d+]/g, "").slice(0, 20) : null;

    // Validate phone against blocklist
    const phoneIsValid = isPhoneValid(sanitizedPhone);
    const finalPhone = phoneIsValid ? sanitizedPhone : null;

    // Build notes with phone warning if invalid
    let finalNotes = notes ? String(notes).slice(0, 1000) : "";
    if (sanitizedPhone && !phoneIsValid) {
      const warning = `📱 Telefone inválido/placeholder detectado (${sanitizedPhone}). Lead veio do Messenger sem WhatsApp válido — solicitar contato real pelo Messenger.`;
      finalNotes = finalNotes ? `${warning}\n\n${finalNotes}` : warning;
    }

    // Create Supabase client with service_role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Deduplication by phone — if phone exists, return existing lead
    if (finalPhone && finalPhone.length >= 10) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name, phone, pipeline_stage, created_at")
        .eq("phone", finalPhone)
        .limit(1)
        .single();

      if (existing) {
        return new Response(JSON.stringify({
          success: true,
          duplicate: true,
          phone_invalid: false,
          message: `Lead já existe: ${existing.name}`,
          lead: existing,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Lookup vehicle by local_bot_id if provided
    let vehicleUuid: string | null = null;
    if (local_vehicle_id && typeof local_vehicle_id === "string") {
      const sanitizedVehicleId = local_vehicle_id.trim().slice(0, 20);
      const { data: vehicle } = await supabase
        .from("stock_vehicles")
        .select("id")
        .eq("local_bot_id", sanitizedVehicleId)
        .limit(1)
        .single();
      if (vehicle) {
        vehicleUuid = vehicle.id;
      }
    }

    // Create the lead
    const { data, error } = await supabase.from("clients").insert({
      name: name.trim().slice(0, 255),
      phone: finalPhone,
      email: email ? String(email).trim().slice(0, 255) : null,
      interest: interest ? String(interest).slice(0, 500) : null,
      source: source ? String(source).slice(0, 50) : "bot-messenger",
      city: city ? String(city).slice(0, 100) : null,
      budget_range: budget_range ? String(budget_range).slice(0, 50) : null,
      notes: finalNotes || null,
      status: "lead",
      temperature: "warm",
      pipeline_stage: "new",
      vehicle_id: vehicleUuid,
    }).select().single();

    if (error) {
      console.error("Erro ao criar lead:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log in bot_logs if seller/bot config provided
    if (seller_name) {
      const { data: botConfig } = await supabase
        .from("bot_configs")
        .select("id")
        .eq("seller_name", seller_name)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (botConfig) {
        await supabase.from("bot_logs").insert({
          bot_config_id: botConfig.id,
          event_type: "lead_created",
          platform: source || "messenger",
          contact_name: name,
          message_in: interest || null,
          lead_created: true,
          client_id: data.id,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      duplicate: false,
      phone_invalid: !phoneIsValid,
      message: !phoneIsValid
        ? "Lead criado sem telefone válido. Solicite o número real ao cliente."
        : "Lead criado com sucesso",
      lead: data,
    }), {
      status: 201,
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
