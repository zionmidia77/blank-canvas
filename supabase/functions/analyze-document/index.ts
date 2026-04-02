import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function buildSystemPrompt(): string {
  return `Você é um especialista em análise de documentos brasileiros para financiamento de veículos.
Analise a imagem e identifique o tipo de documento e extraia os dados relevantes.

Tipos de documentos suportados:
- CNH (Carteira Nacional de Habilitação)
- Comprovante de renda (holerite, contracheque, extrato bancário, declaração de IR)
- Comprovante de residência (conta de luz, água, telefone, etc)
- RG / CPF
- Outro documento

Para CNH, extraia OBRIGATORIAMENTE:
- Nome completo EXATAMENTE como aparece no documento (NUNCA abrevie ou use apenas primeiro nome)
- CPF
- Data de nascimento
- Número da CNH
- Categoria
- Validade

Para HOLERITE/CONTRACHEQUE, extraia TUDO que encontrar:
- Nome completo do funcionário
- CPF do funcionário
- Salário bruto e líquido
- Cargo/função
- Data de admissão (importante!)
- Nome da empresa/empregador
- CNPJ da empresa
- Endereço da empresa (se disponível no cabeçalho)
- Telefone da empresa (se disponível)
- Mês/ano de referência

Responda APENAS com JSON válido:
{
  "document_type": "cnh" | "income_proof" | "address_proof" | "identity" | "other" | "not_document",
  "confidence": "high" | "medium" | "low",
  "extracted_data": {
    "full_name": "nome completo EXATAMENTE como no documento ou null",
    "cpf": "CPF ou null",
    "rg": "RG ou null",
    "birth_date": "data nascimento YYYY-MM-DD ou null",
    "cnh_number": "número CNH ou null",
    "cnh_category": "categoria (A, B, AB, etc) ou null",
    "cnh_expiry": "validade YYYY-MM-DD ou null",
    "address": "endereço completo ou null",
    "city": "cidade ou null",
    "employer": "nome da empresa/empregador ou null",
    "employer_cnpj": "CNPJ da empresa ou null",
    "employer_address": "endereço da empresa ou null",
    "employer_phone": "telefone da empresa ou null",
    "employer_cep": "CEP da empresa ou null",
    "position": "cargo/função ou null",
    "salary": null ou número (salário bruto em reais),
    "salary_net": null ou número (salário líquido em reais),
    "admission_date": "data de admissão YYYY-MM-DD ou null",
    "income_period": "mês/ano referência ou null"
  },
  "summary": "Resumo breve do documento em 1-2 frases",
  "financing_relevant": true/false,
  "issues": ["lista de problemas encontrados, ex: documento vencido, ilegível, etc"] 
}

IMPORTANTE sobre full_name:
- Para CNH: o nome completo está no campo "NOME" do documento. Copie EXATAMENTE como aparece.
- NUNCA retorne apenas o primeiro nome. Se o documento mostra "BRUNA SILVA DOS SANTOS", retorne "BRUNA SILVA DOS SANTOS".
- Se não conseguir ler o nome completo com certeza, retorne null e adicione "Nome ilegível" em issues.

Se a imagem NÃO for um documento, retorne document_type: "not_document" com summary explicando o que vê.`;
}

function calculateEmploymentTime(admissionDate: string): string | null {
  try {
    const admission = new Date(admissionDate);
    const now = new Date();
    const diffMs = now.getTime() - admission.getTime();
    const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years > 0) {
      return `${years} ano${years > 1 ? 's' : ''}${months > 0 ? ` e ${months} mes${months > 1 ? 'es' : ''}` : ''}`;
    }
    return `${months} mes${months !== 1 ? 'es' : ''}`;
  } catch {
    return null;
  }
}

function buildClientUpdates(result: any): { updates: Record<string, any>; docUpdates: Record<string, boolean> } {
  const updates: Record<string, any> = {};
  const docUpdates: Record<string, boolean> = {};
  const ext = result.extracted_data || {};

  if (result.document_type === "cnh") {
    docUpdates.cnh = true;
    if (ext.full_name) updates.name = ext.full_name;
    if (ext.cpf) updates.cpf = ext.cpf;
    if (ext.birth_date) updates.birthdate = ext.birth_date;
    if (ext.city) updates.birth_city = ext.city;
    if (ext.cnh_number) updates.cnh_number = ext.cnh_number;
    if (ext.cnh_category) updates.cnh_category = ext.cnh_category;
  }

  if (result.document_type === "income_proof") {
    docUpdates.pay_stub = true;
    if (ext.employer) updates.employer = ext.employer;
    if (ext.position) updates.position = ext.position;
    if (ext.salary) {
      updates.salary = ext.salary;
      updates.gross_income = ext.salary;
    }
    if (ext.employer_cnpj) updates.employer_cnpj = ext.employer_cnpj;
    if (ext.employer_address) updates.employer_address = ext.employer_address;
    if (ext.employer_phone) updates.employer_phone = ext.employer_phone;
    if (ext.employer_cep) updates.employer_cep = ext.employer_cep;
    if (ext.cpf) updates.cpf = ext.cpf;
    if (ext.full_name) updates.name = ext.full_name;
    if (ext.admission_date) {
      const empTime = calculateEmploymentTime(ext.admission_date);
      if (empTime) updates.employment_time = empTime;
    }
  }

  if (result.document_type === "address_proof") {
    docUpdates.proof_of_residence = true;
    if (ext.city) updates.city = ext.city;
  }

  return { updates, docUpdates };
}

async function updateClientData(clientId: string, result: any): Promise<void> {
  const { updates, docUpdates } = buildClientUpdates(result);

  // Fetch current financing_docs to merge
  const { data: client } = await supabase
    .from("clients")
    .select("financing_docs, name")
    .eq("id", clientId)
    .single();

  const currentDocs = (client?.financing_docs as Record<string, boolean>) || {
    cnh: false, pay_stub: false, reference: false, proof_of_residence: false,
  };

  const mergedDocs = { ...currentDocs, ...docUpdates };
  const allComplete = mergedDocs.cnh && mergedDocs.pay_stub && mergedDocs.proof_of_residence;

  updates.financing_docs = mergedDocs;
  updates.financing_status = allComplete ? "complete" : "incomplete";
  updates.last_contact_at = new Date().toISOString();

  // Log what we're updating for debugging
  const ext = result.extracted_data || {};
  console.log(`[analyze-document] client_id=${clientId}, doc_type=${result.document_type}`);
  console.log(`[analyze-document] extracted full_name="${ext.full_name || 'NULL'}"`);
  console.log(`[analyze-document] current name="${client?.name || 'NULL'}"`);
  
  if (updates.name) {
    // Only update name if extracted name has more words (is more complete)
    const currentWords = (client?.name || "").trim().split(/\s+/).length;
    const newWords = updates.name.trim().split(/\s+/).length;
    if (newWords > currentWords) {
      console.log(`[analyze-document] Updating name: "${client?.name}" → "${updates.name}" (${currentWords} → ${newWords} words)`);
    } else if (newWords <= currentWords && currentWords > 1) {
      // Current name already has more words, don't overwrite with shorter name
      console.log(`[analyze-document] Keeping current name "${client?.name}" (${currentWords} words) over extracted "${updates.name}" (${newWords} words)`);
      delete updates.name;
    }
  }

  console.log(`[analyze-document] Final updates:`, JSON.stringify(updates));

  await supabase.from("clients").update(updates).eq("id", clientId);

  // Log interaction
  const nameInfo = ext.full_name ? ` Nome extraído: ${ext.full_name}.` : "";
  await supabase.from("interactions").insert({
    client_id: clientId,
    type: "system" as const,
    content: `📄 Documento analisado via chat: ${result.document_type} (${result.confidence}).${nameInfo} ${result.summary || ""}`,
    created_by: "ai-consultant",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, client_id } = await req.json();

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "Imagem é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "IA não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    console.log(`[analyze-document] Processing document for client_id=${client_id || "none"}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: "Analise este documento e extraia todas as informações relevantes para financiamento. IMPORTANTE: extraia o nome COMPLETO exatamente como aparece no documento." }
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      console.error(`[analyze-document] AI error: status=${aiResponse.status}`);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições, tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao analisar documento com IA");
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content;

    let result: any = {};
    if (typeof content === "string") {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(cleaned);
    } else if (content && typeof content === "object") {
      result = content;
    }

    console.log(`[analyze-document] AI result: doc_type=${result.document_type}, full_name="${result.extracted_data?.full_name || 'NULL'}"`);

    // Update client data if applicable
    if (client_id && result.document_type !== "not_document") {
      await updateClientData(client_id, result);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao analisar documento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
