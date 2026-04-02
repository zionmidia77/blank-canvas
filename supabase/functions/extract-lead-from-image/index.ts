import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_IMAGES_PER_REQUEST = 5;

type ExtractedData = {
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  interest: string | null;
  budget_range: string | null;
  notes: string | null;
  source: string;
  confidence: "high" | "medium" | "low";
  birthdate: string | null;
  cpf: string | null;
  employer: string | null;
  position: string | null;
  salary: number | null;
};

type SimilarityCandidate = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  similarity_score: number;
  match_reasons: string[];
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toImageDataUrl = (value: string) =>
  value.startsWith("data:") ? value : `data:image/jpeg;base64,${value}`;

const normalizeExtracted = (raw: any): ExtractedData => ({
  name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : null,
  phone: typeof raw?.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null,
  email: typeof raw?.email === "string" && raw.email.trim() ? raw.email.trim() : null,
  city: typeof raw?.city === "string" && raw.city.trim() ? raw.city.trim() : null,
  interest: typeof raw?.interest === "string" && raw.interest.trim() ? raw.interest.trim() : null,
  budget_range:
    typeof raw?.budget_range === "string" && raw.budget_range.trim()
      ? raw.budget_range.trim()
      : null,
  notes: typeof raw?.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null,
  source: typeof raw?.source === "string" && raw.source.trim() ? raw.source.trim() : "facebook",
  confidence:
    raw?.confidence === "high" || raw?.confidence === "medium" || raw?.confidence === "low"
      ? raw.confidence
      : "medium",
  birthdate: typeof raw?.birthdate === "string" && raw.birthdate.trim() ? raw.birthdate.trim() : null,
  cpf: typeof raw?.cpf === "string" && raw.cpf.trim() ? raw.cpf.trim() : null,
  employer: typeof raw?.employer === "string" && raw.employer.trim() ? raw.employer.trim() : null,
  position: typeof raw?.position === "string" && raw.position.trim() ? raw.position.trim() : null,
  salary: typeof raw?.salary === "number" ? raw.salary : null,
});

// --- Similarity scoring ---

const normalizeStr = (s: string | null | undefined): string =>
  (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const digitsOnly = (s: string | null | undefined): string =>
  (s || "").replace(/\D/g, "");

const levenshtein = (a: string, b: string): number => {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
};

const nameSimilarity = (a: string | null, b: string | null): number => {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;

  // Token-based: compare first+last name tokens
  const tokensA = na.split(/\s+/).filter(Boolean);
  const tokensB = nb.split(/\s+/).filter(Boolean);

  let matchedTokens = 0;
  const totalTokens = Math.max(tokensA.length, tokensB.length);

  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb) { matchedTokens++; break; }
      const maxLen = Math.max(ta.length, tb.length);
      if (maxLen > 2 && levenshtein(ta, tb) <= 1) { matchedTokens += 0.8; break; }
    }
  }

  const tokenScore = (matchedTokens / totalTokens) * 100;

  // Also check first+last name match (common pattern)
  const firstA = tokensA[0], lastA = tokensA[tokensA.length - 1];
  const firstB = tokensB[0], lastB = tokensB[tokensB.length - 1];
  let flScore = 0;
  if (firstA === firstB) flScore += 50;
  else if (firstA && firstB && levenshtein(firstA, firstB) <= 1) flScore += 40;
  if (tokensA.length > 1 && tokensB.length > 1) {
    if (lastA === lastB) flScore += 50;
    else if (lastA && lastB && levenshtein(lastA, lastB) <= 1) flScore += 40;
  }

  return Math.max(tokenScore, flScore);
};

const phoneSimilarity = (a: string | null, b: string | null): number => {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db || da.length < 8 || db.length < 8) return 0;
  // Last 8 digits match = very high
  if (da.slice(-8) === db.slice(-8)) return 95;
  // Last 9 digits match = exact
  if (da.length >= 9 && db.length >= 9 && da.slice(-9) === db.slice(-9)) return 100;
  return 0;
};

const emailSimilarity = (a: string | null, b: string | null): number => {
  const ea = normalizeStr(a);
  const eb = normalizeStr(b);
  if (!ea || !eb) return 0;
  if (ea === eb) return 100;
  // Same domain, similar local part
  const [localA, domainA] = ea.split("@");
  const [localB, domainB] = eb.split("@");
  if (domainA && domainA === domainB && localA && localB) {
    const maxLen = Math.max(localA.length, localB.length);
    const dist = levenshtein(localA, localB);
    if (dist <= 2) return 80;
    return Math.max(0, 60 - (dist / maxLen) * 60);
  }
  return 0;
};

const computeSimilarity = (
  extracted: ExtractedData,
  candidate: any,
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // Phone (weight 40)
  const pScore = phoneSimilarity(extracted.phone, candidate.phone);
  if (pScore > 0) {
    weightedScore += pScore * 40;
    totalWeight += 40;
    reasons.push(`Telefone ${pScore >= 95 ? "idêntico" : "similar"} (${pScore}%)`);
  }

  // Email (weight 35)
  const eScore = emailSimilarity(extracted.email, candidate.email);
  if (eScore > 0) {
    weightedScore += eScore * 35;
    totalWeight += 35;
    reasons.push(`Email ${eScore >= 90 ? "idêntico" : "similar"} (${eScore}%)`);
  }

  // Name (weight 25)
  const nScore = nameSimilarity(extracted.name, candidate.name);
  if (nScore > 30) {
    weightedScore += nScore * 25;
    totalWeight += 25;
    reasons.push(`Nome ${nScore >= 90 ? "idêntico" : nScore >= 70 ? "muito similar" : "parcialmente similar"} (${nScore}%)`);
  }

  if (totalWeight === 0) return { score: 0, reasons: [] };

  const finalScore = Math.round(weightedScore / totalWeight);
  return { score: finalScore, reasons };
};

const findSimilarCandidates = async (
  supabase: any,
  extracted: ExtractedData,
): Promise<SimilarityCandidate[]> => {
  const orConditions: string[] = [];
  const cleanPhone = digitsOnly(extracted.phone);
  const cleanEmail = normalizeStr(extracted.email);
  const cleanName = normalizeStr(extracted.name);

  if (cleanPhone.length >= 8) {
    orConditions.push(`phone.ilike.%${cleanPhone.slice(-8)}%`);
  }
  if (cleanEmail) {
    orConditions.push(`email.ilike.%${cleanEmail}%`);
  }

  // Name search: first + last name
  const nameParts = cleanName.split(/\s+/).filter(Boolean);
  if (nameParts.length >= 1 && nameParts[0].length >= 2) {
    orConditions.push(`name.ilike.%${nameParts[0]}%`);
  }

  if (orConditions.length === 0) return [];

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, city")
    .or(orConditions.join(","))
    .limit(10);

  if (error || !data) return [];

  const candidates: SimilarityCandidate[] = [];

  for (const row of data) {
    const { score, reasons } = computeSimilarity(extracted, row);
    if (score >= 40) {
      candidates.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        city: row.city,
        similarity_score: score,
        match_reasons: reasons,
      });
    }
  }

  candidates.sort((a, b) => b.similarity_score - a.similarity_score);
  return candidates.slice(0, 5);
};

// --- AI extraction ---

const extractWithAI = async (apiKey: string, images: string[]) => {
  const userContent = [
    ...images.map((image) => ({
      type: "image_url",
      image_url: { url: toImageDataUrl(image) },
    })),
    {
      type: "text",
      text: "Extraia todos os dados de contato e informações relevantes dessas imagens/conversas.",
    },
  ];

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Você é um assistente que extrai dados de contato de screenshots de conversas e documentos (CNH, RG, etc).
Analise TODAS as imagens e consolide as informações.
Se houver conflito, mantenha o dado mais completo.
Responda APENAS com JSON válido no formato:
{
  "name": "nome completo ou null",
  "phone": "telefone com DDD ou null",
  "email": "email ou null",
  "city": "cidade ou null",
  "birthdate": "data de nascimento no formato YYYY-MM-DD ou null",
  "cpf": "CPF ou null",
  "employer": "empregador ou null",
  "position": "cargo ou null",
  "salary": salário numérico ou null,
  "interest": "interesse identificado ou null",
  "budget_range": "faixa de orçamento ou null",
  "notes": "resumo consolidado, incluindo CNH, CPF e demais dados relevantes",
  "source": "facebook",
  "confidence": "high/medium/low"
}
Se for uma CNH, extraia obrigatoriamente: nome completo, data de nascimento, CPF, cidade.
Para interesse, use se possível: "Quero comprar uma moto", "Quero trocar minha moto", "Quero vender minha moto", "Preciso de dinheiro".
Para budget_range, use: "Até R$ 15 mil", "R$ 15 a 30 mil", "R$ 30 a 50 mil", "Acima de R$ 50 mil".`,
        },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1200,
    }),
  });

  if (!aiResponse.ok) {
    const raw = await aiResponse.text();
    console.error("[extract-lead-from-image] AI API error:", aiResponse.status, raw);
    
    let errorMessage = "Erro ao processar imagem com IA";
    try {
      const parsed = JSON.parse(raw);
      // Handle nested error structures from AI gateway
      if (typeof parsed?.error === "string") {
        errorMessage = parsed.error;
      } else if (typeof parsed?.error?.message === "string") {
        errorMessage = parsed.error.message;
      } else if (typeof parsed?.error?.metadata?.raw === "string") {
        try {
          const innerParsed = JSON.parse(parsed.error.metadata.raw);
          errorMessage = innerParsed?.error?.message || errorMessage;
        } catch { /* ignore */ }
      } else if (typeof parsed?.message === "string") {
        errorMessage = parsed.message;
      }
    } catch { /* ignore */ }
    
    // Map common AI errors to user-friendly messages
    if (errorMessage.includes("Unable to process input image")) {
      errorMessage = "A IA não conseguiu processar esta imagem. Tente com outra foto mais nítida.";
    }
    
    const err: any = new Error(errorMessage);
    err.status = aiResponse.status;
    err.raw = raw;
    throw err;
  }

  const aiData = await aiResponse.json();
  const content = aiData?.choices?.[0]?.message?.content;

  let parsedContent: any = {};
  if (typeof content === "string") {
    parsedContent = JSON.parse(content || "{}");
  } else if (content && typeof content === "object") {
    parsedContent = content;
  }

  return normalizeExtracted(parsedContent);
};

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Configuração de backend incompleta" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Validate token by getting user
    const { data: { user }, error: userError } = await createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser(token);
    const userId = user?.id;

    if (userError || !userId) {
      console.error("[extract-lead-from-image] invalid token", userError);
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "extract_only";

    const rawImages = Array.isArray(body?.image_base64_list)
      ? body.image_base64_list
      : typeof body?.image_base64 === "string"
        ? [body.image_base64]
        : [];

    const imageList = rawImages
      .filter((img: unknown): img is string => typeof img === "string" && img.trim().length > 0)
      .slice(0, MAX_IMAGES_PER_REQUEST);

    console.log("[extract-lead-from-image] request received", JSON.stringify({ userId, action, images: imageList.length }));

    if (rawImages.length > MAX_IMAGES_PER_REQUEST) {
      return jsonResponse({ error: `Máximo de ${MAX_IMAGES_PER_REQUEST} imagens por envio` }, 400);
    }

    if (!imageList.length) {
      return jsonResponse({ error: "Pelo menos uma imagem é obrigatória" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "Serviço de IA não configurado" }, 500);
    }

    const extracted = await extractWithAI(LOVABLE_API_KEY, imageList);
    console.log("[extract-lead-from-image] extraction complete", JSON.stringify({ userId, hasName: Boolean(extracted.name), hasPhone: Boolean(extracted.phone), hasEmail: Boolean(extracted.email) }));

    // Find similar candidates for deduplication
    const similar_candidates = await findSimilarCandidates(supabase, extracted);

    if (action === "extract_only") {
      return jsonResponse({
        extracted,
        similar_candidates,
        images_processed: imageList.length,
      });
    }

    if (action === "create_new") {
      // Force create a new lead, ignoring duplicates
      if (!extracted.name) {
        return jsonResponse({ error: "Nome é obrigatório" }, 400);
      }
      const { data: newClient, error: insertError } = await supabase
        .from("clients")
        .insert({
          name: extracted.name,
          phone: extracted.phone || null,
          email: extracted.email || null,
          city: extracted.city || null,
          interest: extracted.interest || null,
          budget_range: extracted.budget_range || null,
          notes: extracted.notes || null,
          source: extracted.source || "facebook",
          birthdate: extracted.birthdate || null,
          employer: extracted.employer || null,
          position: extracted.position || null,
          salary: extracted.salary || null,
          status: "lead",
          temperature: "warm",
          pipeline_stage: "new",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return jsonResponse({ action: "created", client: newClient, extracted, images_processed: imageList.length });
    }

    if (action === "merge") {
      const mergeTargetId = body?.merge_target_id;
      if (!mergeTargetId) {
        return jsonResponse({ error: "ID do lead para mesclar é obrigatório" }, 400);
      }

      const { data: existingClient, error: fetchError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", mergeTargetId)
        .single();

      if (fetchError || !existingClient) {
        return jsonResponse({ error: "Lead não encontrado para mesclar" }, 404);
      }

      const updates: Record<string, any> = {};
      
      // Handle explicit name update from client (name confrontation)
      const explicitNameUpdate = body?.update_name;
      if (typeof explicitNameUpdate === "string" && explicitNameUpdate.trim()) {
        updates.name = explicitNameUpdate.trim();
      }
      
      if (extracted.phone && !existingClient.phone) updates.phone = extracted.phone;
      if (extracted.city && !existingClient.city) updates.city = extracted.city;
      if (extracted.email && !existingClient.email) updates.email = extracted.email;
      if (extracted.interest && !existingClient.interest) updates.interest = extracted.interest;
      if (extracted.budget_range && !existingClient.budget_range) updates.budget_range = extracted.budget_range;
      if (extracted.birthdate && !existingClient.birthdate) updates.birthdate = extracted.birthdate;
      if (extracted.cpf && !existingClient.cpf) updates.cpf = extracted.cpf;
      if (extracted.employer && !existingClient.employer) updates.employer = extracted.employer;
      if (extracted.position && !existingClient.position) updates.position = extracted.position;
      if (extracted.salary && !existingClient.salary) updates.salary = extracted.salary;

      if (extracted.notes) {
        updates.notes =
          (existingClient.notes ? `${existingClient.notes}\n---\n` : "") +
          `[Fotos ${new Date().toLocaleDateString("pt-BR")} - ${imageList.length} imagem(ns)] ${extracted.notes}`;
      }

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase
          .from("clients")
          .update(updates)
          .eq("id", existingClient.id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: existingClient.id,
          type: "system",
          content: `Lead mesclado via captura de foto (${imageList.length} imagem(ns)). Score de similaridade usado.`,
          created_by: "ai-photo",
        });

        return jsonResponse({ action: "merged", client: data, extracted, images_processed: imageList.length });
      }

      return jsonResponse({ action: "already_exists", client: existingClient, extracted, images_processed: imageList.length });
    }

    // Legacy "create" action with auto-dedup
    if (action !== "create") {
      return jsonResponse({ error: "Ação inválida" }, 400);
    }

    if (!extracted.name) {
      return jsonResponse({ error: "Não foi possível identificar o nome nas imagens", extracted }, 400);
    }

    // Auto-merge if there's a very high similarity candidate (>= 85%)
    const topCandidate = similar_candidates[0];
    if (topCandidate && topCandidate.similarity_score >= 85) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("*")
        .eq("id", topCandidate.id)
        .single();

      if (existingClient) {
        const updates: Record<string, any> = {};
        if (extracted.city && !existingClient.city) updates.city = extracted.city;
        if (extracted.email && !existingClient.email) updates.email = extracted.email;
        if (extracted.interest && !existingClient.interest) updates.interest = extracted.interest;
        if (extracted.budget_range && !existingClient.budget_range) updates.budget_range = extracted.budget_range;
        if (extracted.birthdate && !existingClient.birthdate) updates.birthdate = extracted.birthdate;
        if (extracted.employer && !existingClient.employer) updates.employer = extracted.employer;
        if (extracted.position && !existingClient.position) updates.position = extracted.position;
        if (extracted.salary && !existingClient.salary) updates.salary = extracted.salary;
        if (extracted.notes) {
          updates.notes =
            (existingClient.notes ? `${existingClient.notes}\n---\n` : "") +
            `[Fotos ${new Date().toLocaleDateString("pt-BR")} - ${imageList.length} imagem(ns)] ${extracted.notes}`;
        }

        if (Object.keys(updates).length > 0) {
          const { data, error } = await supabase
            .from("clients")
            .update(updates)
            .eq("id", existingClient.id)
            .select()
            .single();
          if (error) throw error;
          return jsonResponse({ action: "updated", client: data, extracted, similar_candidates, images_processed: imageList.length });
        }
        return jsonResponse({ action: "already_exists", client: existingClient, extracted, similar_candidates, images_processed: imageList.length });
      }
    }

    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert({
        name: extracted.name,
        phone: extracted.phone || null,
        email: extracted.email || null,
        city: extracted.city || null,
        interest: extracted.interest || null,
        budget_range: extracted.budget_range || null,
        notes: extracted.notes || null,
        source: extracted.source || "facebook",
        birthdate: extracted.birthdate || null,
        employer: extracted.employer || null,
        position: extracted.position || null,
        salary: extracted.salary || null,
        status: "lead",
        temperature: "warm",
        pipeline_stage: "new",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return jsonResponse({ action: "created", client: newClient, extracted, similar_candidates, images_processed: imageList.length });
  } catch (error: any) {
    console.error("Error in extract-lead-from-image:", error);

    if (error?.status === 429) {
      return jsonResponse({ error: "Muitas requisições agora. Aguarde alguns segundos." }, 429);
    }
    if (error?.status === 402) {
      return jsonResponse({ error: "Limite de uso de IA atingido." }, 402);
    }
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Resposta inválida da IA. Tente com imagens mais nítidas." }, 500);
    }
    return jsonResponse({ error: error?.message || "Erro interno ao processar imagens" }, 500);
  }
});
