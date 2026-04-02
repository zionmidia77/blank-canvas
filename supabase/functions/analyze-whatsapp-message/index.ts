import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, new_message } = await req.json();
    if (!client_id || !new_message) {
      return new Response(JSON.stringify({ error: "client_id e new_message são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("name, pipeline_stage, temperature, objection_type, deal_type, deal_value, last_contact_at, client_promise, client_promise_status, next_action, next_action_type, queue_reason, churn_risk, has_down_payment, has_clean_credit, interest, budget_range, down_payment_amount, credit_status, docs_status")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: memory } = await supabase
      .from("lead_memory")
      .select("summary, objections, interests, behavior_patterns, recommended_action")
      .eq("client_id", client_id)
      .maybeSingle();

    const { data: recentInteractions } = await supabase
      .from("interactions")
      .select("type, content, created_at")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(3);

    const systemPrompt = `Você é um analista de vendas especialista em motos e veículos da Arsenal Motors.
Sua função é analisar a ÚLTIMA MENSAGEM do cliente e retornar uma análise focada em RESPOSTA e CONVERSÃO.

REGRAS CRÍTICAS:
- Foque em CONVERSÃO. Toda sugestão deve avançar a venda.
- Mensagens sugeridas devem provocar RESPOSTA do cliente e avançar a conversa.
- Máximo 2 frases na mensagem sugerida.
- NUNCA sugira mensagens genéricas ou apenas educadas.
- NÃO sugira mudanças de pipeline ou substatus — isso não é sua responsabilidade.
- Foque apenas em: situação, estratégia, próxima ação, mensagem e objetivo.
- Responda APENAS com a tool call estruturada, sem texto adicional.`;

    const userPrompt = `CONTEXTO DO LEAD:
- Nome: ${client.name}
- Etapa: ${client.pipeline_stage}
- Temperatura: ${client.temperature}
- Objeção atual: ${client.objection_type || "nenhuma"}
- Tipo negócio: ${client.deal_type || "não definido"}
- Valor: R$ ${client.deal_value || "não definido"}
- Entrada: ${client.has_down_payment ? "sim" : "não"}${client.down_payment_amount ? ` (R$ ${client.down_payment_amount})` : ""}
- Crédito limpo: ${client.has_clean_credit ? "sim" : "não"}
- Status crédito: ${client.credit_status || "pendente"}
- Docs: ${client.docs_status || "incompleto"}
- Promessa: ${client.client_promise || "nenhuma"} (${client.client_promise_status || "n/a"})
- Próxima ação: ${client.next_action || "nenhuma"}
- Último contato: ${client.last_contact_at || "nunca"}
- Risco churn: ${client.churn_risk || 0}%
- Interesse: ${client.interest || "não informado"}
- Orçamento: ${client.budget_range || "não informado"}

MEMÓRIA IA:
${memory ? `- Resumo: ${memory.summary || "sem resumo"}
- Objeções conhecidas: ${(memory.objections || []).join(", ") || "nenhuma"}
- Interesses: ${(memory.interests || []).join(", ") || "nenhum"}
- Padrões: ${(memory.behavior_patterns || []).join(", ") || "nenhum"}` : "Sem memória prévia"}

ÚLTIMAS INTERAÇÕES:
${(recentInteractions || []).map(i => `[${i.type}] ${i.content?.slice(0, 150)}`).join("\n") || "Nenhuma"}

---

NOVA MENSAGEM DO CLIENTE:
"${new_message}"

Analise e retorne a avaliação estruturada usando a tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "whatsapp_analysis",
              description: "Retorna análise estruturada da mensagem do cliente",
              parameters: {
                type: "object",
                properties: {
                  situation: {
                    type: "string",
                    description: "Situação atual do lead em 1 frase curta (ex: 'Cliente negociando entrada menor')",
                  },
                  strategy: {
                    type: "string",
                    enum: ["pressionar_forte", "pressionar_medio", "pressionar_leve", "educar_medio", "educar_leve", "fechar_direto", "recuperar", "aguardar", "qualificar"],
                    description: "Estratégia recomendada",
                  },
                  priority: {
                    type: "string",
                    enum: ["urgente", "normal", "baixo"],
                    description: "Nível de prioridade",
                  },
                  response_objective: {
                    type: "string",
                    description: "Objetivo da resposta em 1 frase (ex: 'Puxar decisão sobre entrada')",
                  },
                  next_action: {
                    type: "string",
                    description: "Próxima ação sugerida (ex: 'Simular parcela com entrada menor')",
                  },
                  suggested_message: {
                    type: "string",
                    description: "Mensagem sugerida para enviar ao cliente. Máximo 2 frases. Deve ser conversional, focada em conversão, provocar resposta e avançar a negociação. NÃO seja genérico.",
                  },
                },
                required: ["situation", "strategy", "priority", "response_objective", "next_action", "suggested_message"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "whatsapp_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na análise de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save the pasted message as interaction
    await supabase.from("interactions").insert({
      client_id,
      type: "whatsapp",
      content: `📱 Mensagem do cliente: "${new_message}"`,
      created_by: "whatsapp_analyzer",
    });

    // Add timeline event with full analysis for restoration
    await supabase.from("lead_timeline_events").insert({
      client_id,
      event_type: "message_received",
      content: `Mensagem WhatsApp analisada: "${new_message.slice(0, 100)}"`,
      source: "whatsapp_analyzer",
      metadata: { analysis_result: analysis, original_message: new_message },
    });

    // Persist to lead_memory
    const { data: existingMemory } = await supabase
      .from("lead_memory")
      .select("id")
      .eq("client_id", client_id)
      .maybeSingle();

    const memoryUpdate = {
      recommended_message: analysis.suggested_message,
      recommended_action: analysis.next_action,
      last_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      summary: `[WhatsApp] ${analysis.situation}. Estratégia: ${analysis.strategy}. Prioridade: ${analysis.priority}.`,
    };

    if (existingMemory) {
      await supabase.from("lead_memory").update(memoryUpdate).eq("client_id", client_id);
    } else {
      await supabase.from("lead_memory").insert({ client_id, ...memoryUpdate });
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-whatsapp-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
