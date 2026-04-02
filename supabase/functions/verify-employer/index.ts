import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, client_id } = await req.json();

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Imagem do holerite é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    // Step 1: Extract employer data from pay stub image
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Você é um especialista em análise de holerites e documentos trabalhistas brasileiros.
Analise a imagem do holerite/contracheque e extraia TODOS os dados possíveis.
Responda APENAS com JSON válido:
{
  "employer_name": "nome completo da empresa",
  "employer_cnpj": "CNPJ se visível",
  "employee_name": "nome do funcionário",
  "employee_cpf": "CPF se visível",
  "position": "cargo/função",
  "salary_gross": "salário bruto (número)",
  "salary_net": "salário líquido (número)",
  "admission_date": "data de admissão se visível",
  "department": "setor/departamento se visível",
  "reference_month": "mês/ano de referência",
  "employer_address": "endereço da empresa se visível",
  "confidence": "high/medium/low",
  "notes": "observações relevantes sobre o documento"
}
Se algum dado não for visível, use null.`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: "Extraia todos os dados deste holerite/contracheque." },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
    });

    if (!extractResponse.ok) {
      const errText = await extractResponse.text();
      console.error("AI extraction error:", extractResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao analisar holerite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractData = await extractResponse.json();
    const extractContent = extractData?.choices?.[0]?.message?.content;
    let extracted: any = {};
    try {
      extracted = typeof extractContent === "string" ? JSON.parse(extractContent) : extractContent || {};
    } catch {
      extracted = {};
    }

    // Step 2: If CNPJ was extracted, query BrasilAPI for real company data
    let verification: any = null;
    let cnpjData: any = null;

    if (extracted.employer_cnpj) {
      const cleanCnpj = extracted.employer_cnpj.replace(/[^\d]/g, "");
      if (cleanCnpj.length === 14) {
        try {
          const cnpjResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
            headers: { "User-Agent": "ArsenalCRM/1.0" },
          });
          if (cnpjResponse.ok) {
            cnpjData = await cnpjResponse.json();
            verification = {
              company_name: cnpjData.razao_social || null,
              trading_name: cnpjData.nome_fantasia || null,
              sector: cnpjData.cnae_fiscal_descricao || null,
              size: cnpjData.porte || null,
              status: cnpjData.descricao_situacao_cadastral?.toLowerCase() || null,
              founded_year: cnpjData.data_inicio_atividade ? cnpjData.data_inicio_atividade.substring(0, 4) : null,
              location: cnpjData.municipio ? `${cnpjData.municipio}/${cnpjData.uf}` : null,
              address: cnpjData.logradouro ? `${cnpjData.descricao_tipo_de_logradouro || ""} ${cnpjData.logradouro}, ${cnpjData.numero || "S/N"} - ${cnpjData.bairro || ""}, ${cnpjData.municipio || ""}/${cnpjData.uf || ""} - CEP ${cnpjData.cep || ""}`.trim() : null,
              description: cnpjData.cnae_fiscal_descricao || null,
              cnpj_validated: true,
              verified: cnpjData.descricao_situacao_cadastral === "ATIVA",
              legal_nature: cnpjData.natureza_juridica || null,
              share_capital: cnpjData.capital_social || null,
              source: "Receita Federal via BrasilAPI",
              risk_flags: cnpjData.descricao_situacao_cadastral !== "ATIVA"
                ? [`Situação cadastral: ${cnpjData.descricao_situacao_cadastral}`]
                : [],
              positive_flags: [
                ...(cnpjData.descricao_situacao_cadastral === "ATIVA" ? ["Empresa ativa na Receita Federal"] : []),
                ...(cnpjData.capital_social > 100000 ? ["Capital social acima de R$100k"] : []),
              ],
              reliability_score: cnpjData.descricao_situacao_cadastral === "ATIVA"
                ? (cnpjData.capital_social > 100000 ? 9 : 7)
                : 3,
            };
          } else {
            console.error("BrasilAPI CNPJ error:", cnpjResponse.status);
            verification = { cnpj_validated: false, error: "CNPJ não encontrado na Receita Federal", verified: false };
          }
        } catch (err) {
          console.error("BrasilAPI fetch error:", err);
          verification = { cnpj_validated: false, error: "Erro ao consultar Receita Federal", verified: false };
        }
      } else {
        verification = { cnpj_validated: false, error: "CNPJ extraído é inválido (não tem 14 dígitos)", verified: false };
      }
    } else if (extracted.employer_name) {
      // Fallback: no CNPJ found, use AI to verify by name
      const verifyPrompt = `Pesquise e verifique a empresa "${extracted.employer_name}"${extracted.employer_address ? ` localizada em ${extracted.employer_address}` : ""}.
Responda APENAS com JSON:
{
  "company_name": "nome oficial",
  "trading_name": "nome fantasia",
  "sector": "setor",
  "size": "porte",
  "status": "ativa/inativa/não encontrada",
  "location": "cidade/estado",
  "description": "breve descrição",
  "reliability_score": "1-10",
  "risk_flags": [],
  "positive_flags": [],
  "verified": true/false,
  "cnpj_validated": false,
  "source": "Análise por IA (CNPJ não disponível no holerite)"
}`;

      const verifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um analista de crédito brasileiro. Verifique empresas para fins de aprovação de financiamento." },
            { role: "user", content: verifyPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        }),
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const verifyContent = verifyData?.choices?.[0]?.message?.content;
        try {
          verification = typeof verifyContent === "string" ? JSON.parse(verifyContent) : verifyContent || null;
        } catch {
          verification = null;
        }
      }
    }

    // Step 3: Save verification to database if client_id provided
    if (client_id && verification) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        await sb.from("employer_verifications").insert({
          client_id,
          cnpj: extracted.employer_cnpj?.replace(/[^\d]/g, "") || null,
          employer_name: extracted.employer_name || null,
          company_name: verification.company_name || null,
          trading_name: verification.trading_name || null,
          sector: verification.sector || null,
          size: verification.size || null,
          status: verification.status || null,
          location: verification.location || null,
          address: verification.address || null,
          founded_year: verification.founded_year || null,
          legal_nature: verification.legal_nature || null,
          share_capital: verification.share_capital || null,
          reliability_score: verification.reliability_score ? Number(verification.reliability_score) : null,
          verified: verification.verified || false,
          cnpj_validated: verification.cnpj_validated || false,
          source: verification.source || null,
          risk_flags: verification.risk_flags || [],
          positive_flags: verification.positive_flags || [],
          extracted_data: extracted,
        });
        console.log("Verification saved for client:", client_id);
      } catch (saveErr) {
        console.error("Error saving verification:", saveErr);
      }
    }

    return new Response(
      JSON.stringify({ extracted, verification }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("verify-employer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
