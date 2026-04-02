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

// ── Tools for the AI agent ──
const tools = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description:
        "Create a new lead in the CRM. Call this as soon as you have the person's name AND phone number. You can update later with more info.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name" },
          phone: { type: "string", description: "Phone/WhatsApp number" },
          interest: {
            type: "string",
            description: "What they want: comprar, trocar, vender, refinanciar",
          },
          budget_range: {
            type: "string",
            description: "Budget range e.g. 'R$ 15 a 30 mil', 'Acima de R$ 50 mil'",
          },
          has_trade_in: {
            type: "boolean",
            description: "Has a vehicle to trade in",
          },
          has_clean_credit: {
            type: "boolean",
            description: "Has clean credit (nome limpo) for financing",
          },
          has_down_payment: {
            type: "boolean",
            description: "Has money for down payment (entrada)",
          },
          down_payment_amount: {
            type: "number",
            description: "Down payment amount in BRL",
          },
          city: { type: "string", description: "City where client lives" },
          birthdate: {
            type: "string",
            description: "Birth date in YYYY-MM-DD format",
          },
          email: { type: "string", description: "Email address" },
          payment_type: {
            type: "string",
            enum: ["financing", "cash", "consortium"],
            description: "Preferred payment method",
          },
          cpf: { type: "string", description: "CPF number (Brazilian ID)" },
          marital_status: {
            type: "string",
            enum: ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
            description: "Marital status",
          },
          salary: { type: "number", description: "Monthly income in BRL" },
          employer: { type: "string", description: "Where they work" },
          employment_time: { type: "string", description: "How long at current job" },
          position: { type: "string", description: "Job title/position" },
          reference_name: { type: "string", description: "Personal reference 1 full name" },
          reference_phone: { type: "string", description: "Personal reference 1 phone" },
          reference_relation: { type: "string", description: "Relationship to reference 1 (amigo, parente, vizinho)" },
          reference_name_2: { type: "string", description: "Personal reference 2 full name" },
          reference_phone_2: { type: "string", description: "Personal reference 2 phone" },
          reference_relation_2: { type: "string", description: "Relationship to reference 2" },
          gender: { type: "string", enum: ["M", "F"], description: "Gender M or F" },
          education_level: { type: "string", description: "Education level" },
          dependents: { type: "number", description: "Number of dependents" },
          mother_name: { type: "string", description: "Mother's full name" },
          father_name: { type: "string", description: "Father's full name" },
          rg: { type: "string", description: "RG number" },
          rg_issuer: { type: "string", description: "RG issuer (SSP, etc)" },
          cnh_number: { type: "string", description: "CNH number" },
          cnh_category: { type: "string", description: "CNH category (A, AB, etc)" },
          address_cep: { type: "string", description: "CEP (zip code)" },
          address_street: { type: "string", description: "Street name" },
          address_number: { type: "string", description: "Street number" },
          address_complement: { type: "string", description: "Complement (apt, bloco)" },
          address_neighborhood: { type: "string", description: "Neighborhood (bairro)" },
          address_state: { type: "string", description: "State (UF) 2 letters" },
          housing_type: { type: "string", description: "Housing type: propria, alugada, financiada, familiar" },
          residence_time: { type: "string", description: "Time at current residence e.g. '2 anos'" },
          gross_income: { type: "number", description: "Gross monthly income in BRL" },
          profession: { type: "string", description: "Profession/occupation" },
          employer_cnpj: { type: "string", description: "Employer CNPJ if applicable" },
          employer_cep: { type: "string", description: "Employer CEP" },
          employer_address: { type: "string", description: "Employer full address" },
          employer_phone: { type: "string", description: "Employer phone number" },
        },
        required: ["name", "phone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description:
        "Update an existing lead with new information collected during conversation. Call this EVERY TIME you learn something new about the client.",
      parameters: {
        type: "object",
        properties: {
          client_id: {
            type: "string",
            description: "The UUID of the lead to update",
          },
          name: { type: "string", description: "Updated full name of the client (use when client introduces themselves or corrects their name)" },
          interest: { type: "string", description: "comprar, trocar, vender, refinanciar" },
          budget_range: { type: "string", description: "e.g. 'R$ 15 a 30 mil'" },
          has_trade_in: { type: "boolean" },
          has_clean_credit: { type: "boolean" },
          has_down_payment: { type: "boolean" },
          down_payment_amount: { type: "number" },
          city: { type: "string" },
          birthdate: { type: "string", description: "YYYY-MM-DD" },
          employer: { type: "string", description: "Where they work" },
          employment_time: { type: "string", description: "How long at current job e.g. '2 anos'" },
          position: { type: "string", description: "Job title/position" },
          salary: { type: "number", description: "Monthly income in BRL" },
          email: { type: "string" },
          cpf: { type: "string", description: "CPF number" },
          marital_status: {
            type: "string",
            enum: ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
          },
          reference_name: { type: "string", description: "Reference 1 full name" },
          reference_phone: { type: "string", description: "Reference 1 phone" },
          reference_relation: { type: "string", description: "Relationship to reference 1" },
          reference_name_2: { type: "string", description: "Reference 2 full name" },
          reference_phone_2: { type: "string", description: "Reference 2 phone" },
          reference_relation_2: { type: "string", description: "Relationship to reference 2" },
          gender: { type: "string", enum: ["M", "F"] },
          education_level: { type: "string" },
          dependents: { type: "number" },
          mother_name: { type: "string" },
          father_name: { type: "string" },
          rg: { type: "string" },
          rg_issuer: { type: "string" },
          cnh_number: { type: "string" },
          cnh_category: { type: "string" },
          address_cep: { type: "string" },
          address_street: { type: "string" },
          address_number: { type: "string" },
          address_complement: { type: "string" },
          address_neighborhood: { type: "string" },
          address_state: { type: "string" },
          housing_type: { type: "string" },
          residence_time: { type: "string" },
          gross_income: { type: "number" },
          profession: { type: "string" },
          employer_cnpj: { type: "string" },
          employer_cep: { type: "string" },
          employer_address: { type: "string" },
          employer_phone: { type: "string" },
          payment_type: {
            type: "string",
            enum: ["financing", "cash", "consortium"],
          },
          notes: { type: "string", description: "Important notes about the client's situation" },
          pipeline_stage: {
            type: "string",
            enum: ["new", "contacted", "interested", "negotiating", "scheduled"],
            description: "Move lead through pipeline as conversation progresses",
          },
          temperature: {
            type: "string",
            enum: ["hot", "warm", "cold"],
            description: "Lead temperature based on buying intent",
          },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "register_trade_in",
      description:
        "Register a vehicle the client wants to trade in. Captures details for evaluation. Call when client says they have a vehicle (car or moto) to give as entrada/troca.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          brand: { type: "string", description: "Vehicle brand (Honda, Yamaha, etc.)" },
          model: { type: "string", description: "Vehicle model (CG 160, Factor, etc.)" },
          year: { type: "number", description: "Vehicle year" },
          km: { type: "number", description: "Approximate kilometers" },
          is_financed: { type: "boolean", description: "Is the vehicle still being financed?" },
          installments_paid: { type: "number", description: "How many installments paid if financed" },
          installments_total: { type: "number", description: "Total installments if financed" },
          monthly_payment: { type: "number", description: "Monthly payment if financed" },
          estimated_value: { type: "number", description: "Client's estimated value" },
        },
        required: ["client_id", "brand", "model"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_vehicles",
      description:
        "Search available vehicles in the inventory. Use to recommend options matching the client's profile and budget. When the client mentions a vehicle name like 'Onix', 'CG 160', 'Factor', search by model. When they mention a manufacturer like 'Honda', 'Chevrolet', 'Yamaha', search by brand. You can also pass a general search_term that searches both brand and model.",
      parameters: {
        type: "object",
        properties: {
          brand: {
            type: "string",
            description: "Brand/manufacturer filter (e.g. Honda, Yamaha, Chevrolet)",
          },
          model: {
            type: "string",
            description: "Model name filter (e.g. Onix, CG 160, Factor, Fazer)",
          },
          search_term: {
            type: "string",
            description: "General search term that matches against both brand and model. Use when unsure if the client mentioned a brand or model.",
          },
          max_value: {
            type: "number",
            description: "Maximum price in BRL",
          },
          min_value: {
            type: "number",
            description: "Minimum price in BRL",
          },
          color: {
            type: "string",
            description: "Color filter (e.g. Branco, Preto, Vermelho, Prata)",
          },
          year: {
            type: "number",
            description: "Year filter (e.g. 2023, 2024)",
          },
          min_year: {
            type: "number",
            description: "Minimum year filter",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_financing",
      description:
        "Simulate a financing plan using fixed coefficients per installment count. Formula: parcela = valor_financiado × coeficiente. Coefficients: 12x=0.095, 24x=0.070, 36x=0.065, 48x=0.060, 60x=0.058. Do NOT calculate compound interest.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          vehicle_value: { type: "number", description: "Total vehicle value in BRL" },
          down_payment: { type: "number", description: "Down payment amount in BRL" },
          installments: { type: "number", description: "Number of installments (12, 24, 36, 48, 60)" },
        },
        required: ["client_id", "vehicle_value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_visit",
      description:
        "Schedule a visit to the store or a call with the sales team. Use when the client is ready to move forward.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          visit_type: {
            type: "string",
            enum: ["store_visit", "video_call", "phone_call", "evaluation"],
            description: "Type of appointment",
          },
          preferred_date: { type: "string", description: "Preferred date (YYYY-MM-DD)" },
          preferred_time: { type: "string", description: "Preferred time (HH:MM)" },
          notes: { type: "string", description: "Any special notes about the visit" },
        },
        required: ["client_id", "visit_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp_proposal",
      description:
        "Generate and send a financing proposal via WhatsApp when the client approves the simulation. Creates a formatted proposal message with all details and generates a wa.me link. Call this ONLY after the client says they want to proceed with the financing.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          client_name: { type: "string", description: "Client's name" },
          client_phone: { type: "string", description: "Client's phone number" },
          vehicle_description: { type: "string", description: "Vehicle brand + model + year" },
          vehicle_value: { type: "number", description: "Total vehicle value in BRL" },
          down_payment: { type: "number", description: "Down payment amount in BRL" },
          installments: { type: "number", description: "Number of installments chosen" },
          monthly_payment: { type: "number", description: "Monthly payment amount in BRL" },
          has_trade_in: { type: "boolean", description: "Client has a trade-in vehicle" },
          trade_in_description: { type: "string", description: "Trade-in vehicle description if applicable" },
          trade_in_value: { type: "number", description: "Estimated trade-in value if applicable" },
          additional_notes: { type: "string", description: "Any additional notes about the deal" },
        },
        required: ["client_id", "client_name", "client_phone", "vehicle_description", "vehicle_value", "installments", "monthly_payment"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_documents",
      description:
        "Check the financing document checklist for a client. Returns which documents have been submitted and which are still pending. Use this to show the client a visual checklist of what's needed.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_urgency",
      description:
        "Detect and update lead urgency/temperature based on buying signals. Call this when the client expresses urgency like 'preciso pra essa semana', 'é urgente', 'quero fechar hoje', 'tenho pressa', 'minha moto quebrou', 'preciso trabalhar'. Also call when client shows cold signals like 'só estou olhando', 'vou pensar', 'depois eu vejo'.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          urgency_level: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
            description: "critical=needs NOW, high=this week, medium=interested, low=just browsing",
          },
          reason: { type: "string", description: "Why this urgency level was detected" },
        },
        required: ["client_id", "urgency_level", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_interaction",
      description: "Log an important interaction/event in the client timeline",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          content: {
            type: "string",
            description: "What happened in the interaction",
          },
        },
        required: ["client_id", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_conversation_notes",
      description:
        "Save a structured summary of ALL relevant information collected during the conversation. Call this EVERY FEW MESSAGES with a cumulative summary. Include: preferences, objections, personal details mentioned, family situation, work context, buying timeline, anything useful for future sales.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          notes: {
            type: "string",
            description: "Structured notes with all relevant info collected. Use bullet points. Example: '• Prefere motos esportivas\n• Trabalha como entregador, precisa da moto pra trabalhar\n• Esposa também anda de moto\n• Quer parcela até R$500\n• Mora perto da loja\n• Tem medo de financiar por já ter tido nome sujo'",
          },
        },
        required: ["client_id", "notes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_cnh_data",
      description:
        "Process CNH (driver's license) data extracted from a photo or text. Automatically registers the birthdate, full name, and CPF in the lead profile, marks CNH as received in financing docs, and adds the client to the birthday alerts system. Call this whenever the client shares CNH information — either by photo OCR results or by providing CNH details in text.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          full_name: { type: "string", description: "Full name as on CNH" },
          cpf: { type: "string", description: "CPF number from CNH" },
          birthdate: { type: "string", description: "Birth date in YYYY-MM-DD format from CNH" },
          cnh_number: { type: "string", description: "CNH number" },
          birth_city: { type: "string", description: "City of birth from CNH" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_vehicle_photos",
      description:
        "Send individual photos of a specific vehicle to the client. Use when the client asks to see photos/pictures of a vehicle, asks 'tem foto?', 'mostra foto', 'quero ver', etc. Returns photo URLs that will be displayed as images in the chat.",
      parameters: {
        type: "object",
        properties: {
          brand: { type: "string", description: "Vehicle brand to search" },
          model: { type: "string", description: "Vehicle model to search" },
          year: { type: "number", description: "Vehicle year (optional)" },
        },
        required: ["brand", "model"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_tag_lead",
      description:
        "Automatically tag a lead based on the conversation context. Call this after understanding the client's profile to categorize them. Tags help the sales team prioritize. Apply multiple tags as needed. Examples: 'urgente' (needs now), 'financiamento' (wants financing), 'troca' (has trade-in), 'à vista' (paying cash), 'autônomo' (self-employed), 'entregador' (delivery worker), 'primeiro-veiculo' (first vehicle), 'família' (buying for family).",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "List of tag names to apply",
          },
        },
        required: ["client_id", "tags"],
        additionalProperties: false,
      },
    },
  },
];

// ── Execute tool calls ──
async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "create_lead": {
        const phone = args.phone as string;
        const name = args.name as string;

        // ── Validate name and phone before creating ──
        const invalidNames = ['none', 'null', 'undefined', 'test', 'teste', 'n/a', 'não informado', 'não fornecido', 'nome não fornecido', 'cliente não informou'];
        const isNameInvalid = !name || name.length < 2 || invalidNames.some(inv => name.toLowerCase().includes(inv)) || /^\(.*\)$/.test(name);
        const isPhoneInvalid = !phone || phone === 'None' || phone === 'null' || phone === name || phone.replace(/\D/g, '').length < 8 || /^\(.*não.*\)$/i.test(phone);

        if (isNameInvalid || isPhoneInvalid) {
          return JSON.stringify({
            success: false,
            error: "DADOS INSUFICIENTES para criar lead. Você PRECISA ter o NOME REAL da pessoa (não um placeholder) e o TELEFONE REAL (mínimo 8 dígitos). Continue a conversa e peça esses dados ao cliente antes de chamar create_lead novamente.",
          });
        }

        // ── Check for existing client by phone ──
        let existingClient = null;
        if (phone) {
          // Normalize phone: keep only digits
          const normalizedPhone = phone.replace(/\D/g, "");
          const { data: phoneMatches } = await supabase
            .from("clients")
            .select("id, name, phone, interest, pipeline_stage, temperature, notes, financing_docs, employer, salary, budget_range, has_trade_in, cpf, birthdate, city, marital_status, reference_name, reference_phone, reference_name_2, reference_phone_2")
            .or(`phone.ilike.%${normalizedPhone.slice(-8)}%`)
            .limit(5);

          if (phoneMatches && phoneMatches.length > 0) {
            // Try exact match first (last 8 digits), then fuzzy name match
            existingClient = phoneMatches.find(c => {
              const cPhone = (c.phone || "").replace(/\D/g, "");
              return cPhone.slice(-8) === normalizedPhone.slice(-8);
            }) || null;
          }
        }

        // If existing client found, return it with history instead of creating duplicate
        if (existingClient) {
          // Fetch recent conversations for context
          const { data: recentConvos } = await supabase
            .from("chat_conversations")
            .select("messages, created_at, status")
            .eq("client_id", existingClient.id)
            .order("created_at", { ascending: false })
            .limit(3);

          // Fetch recent interactions
          const { data: recentInteractions } = await supabase
            .from("interactions")
            .select("content, type, created_at")
            .eq("client_id", existingClient.id)
            .order("created_at", { ascending: false })
            .limit(10);

          // Build a context summary
          const history: string[] = [];
          if (existingClient.interest) history.push(`Interesse: ${existingClient.interest}`);
          if (existingClient.budget_range) history.push(`Orçamento: ${existingClient.budget_range}`);
          if (existingClient.pipeline_stage) history.push(`Estágio: ${existingClient.pipeline_stage}`);
          if (existingClient.employer) history.push(`Empregador: ${existingClient.employer}`);
          if (existingClient.salary) history.push(`Salário: R$ ${existingClient.salary}`);
          if (existingClient.has_trade_in) history.push(`Tem veículo de troca`);
          if (existingClient.notes) history.push(`Notas: ${existingClient.notes}`);

          const interactionSummary = (recentInteractions || [])
            .slice(0, 5)
            .map(i => `[${new Date(i.created_at).toLocaleDateString("pt-BR")}] ${i.content}`)
            .join("\n");

          // Update last_contact_at
          await supabase
            .from("clients")
            .update({ last_contact_at: new Date().toISOString() })
            .eq("id", existingClient.id);

          await supabase.from("interactions").insert({
            client_id: existingClient.id,
            type: "system",
            content: `Cliente retornou ao chat IA. Sessão anterior reconhecida.`,
            created_by: "ai-consultant",
          });

          // Link conversation to existing client
          if (args._session_id) {
            await supabase
              .from("chat_conversations")
              .update({ client_id: existingClient.id })
              .eq("session_id", args._session_id);
          }

          return JSON.stringify({
            success: true,
            client_id: existingClient.id,
            client_name: existingClient.name,
            existing_client: true,
            message: `CLIENTE JÁ CADASTRADO! "${existingClient.name}" (ID: ${existingClient.id}) já existe no sistema. NÃO crie outro lead. Use update_lead para atualizar dados.\n\nDADOS EXISTENTES:\n${history.join("\n")}\n\nÚLTIMAS INTERAÇÕES:\n${interactionSummary || "Nenhuma interação recente."}\n\nIMPORTANTE: Cumprimente o cliente pelo nome, demonstre que já o conhece e pergunte como pode ajudar desta vez. Retome o contexto anterior naturalmente.`,
          });
        }

        // ── No existing client — create new one ──
        const { data, error } = await supabase
          .from("clients")
          .insert({
            name,
            phone,
            interest: (args.interest as string) || null,
            budget_range: (args.budget_range as string) || null,
            has_trade_in: (args.has_trade_in as boolean) || false,
            has_clean_credit: (args.has_clean_credit as boolean) || null,
            has_down_payment: (args.has_down_payment as boolean) || false,
            down_payment_amount: (args.down_payment_amount as number) || null,
            city: (args.city as string) || null,
            birthdate: (args.birthdate as string) || null,
            email: (args.email as string) || null,
            payment_type: (args.payment_type as string) || null,
            cpf: (args.cpf as string) || null,
            marital_status: (args.marital_status as string) || null,
            salary: (args.salary as number) || null,
            employer: (args.employer as string) || null,
            employment_time: (args.employment_time as string) || null,
            position: (args.position as string) || null,
            reference_name: (args.reference_name as string) || null,
            reference_phone: (args.reference_phone as string) || null,
            reference_relation: (args.reference_relation as string) || null,
            reference_name_2: (args.reference_name_2 as string) || null,
            reference_phone_2: (args.reference_phone_2 as string) || null,
            reference_relation_2: (args.reference_relation_2 as string) || null,
            gender: (args.gender as string) || null,
            education_level: (args.education_level as string) || null,
            dependents: (args.dependents as number) || 0,
            mother_name: (args.mother_name as string) || null,
            father_name: (args.father_name as string) || null,
            rg: (args.rg as string) || null,
            rg_issuer: (args.rg_issuer as string) || null,
            cnh_number: (args.cnh_number as string) || null,
            cnh_category: (args.cnh_category as string) || null,
            address_cep: (args.address_cep as string) || null,
            address_street: (args.address_street as string) || null,
            address_number: (args.address_number as string) || null,
            address_complement: (args.address_complement as string) || null,
            address_neighborhood: (args.address_neighborhood as string) || null,
            address_state: (args.address_state as string) || null,
            housing_type: (args.housing_type as string) || null,
            residence_time: (args.residence_time as string) || null,
            gross_income: (args.gross_income as number) || null,
            profession: (args.profession as string) || null,
            employer_cnpj: (args.employer_cnpj as string) || null,
            employer_cep: (args.employer_cep as string) || null,
            employer_address: (args.employer_address as string) || null,
            employer_phone: (args.employer_phone as string) || null,
            source: "ai-chat",
            status: "lead",
            temperature: "hot",
            pipeline_stage: "new",
          })
          .select("id, name")
          .single();

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: data.id,
          type: "system",
          content: `Lead criado via chat IA. Interesse: ${args.interest || "a definir"}`,
          created_by: "ai-consultant",
        });

        // Link conversation to client using session_id (passed via context)
        if (args._session_id) {
          await supabase
            .from("chat_conversations")
            .update({ client_id: data.id })
            .eq("session_id", args._session_id);
        }

        return JSON.stringify({
          success: true,
          client_id: data.id,
          client_name: data.name,
          existing_client: false,
          message: `Lead "${data.name}" criado com sucesso. IMPORTANTE: Use este client_id (${data.id}) em TODAS as chamadas futuras de update_lead, register_trade_in, simulate_financing, schedule_visit e log_interaction.`,
        });
      }

      case "update_lead": {
        const { client_id, ...updateFields } = args;
        const cleanFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updateFields)) {
          if (v !== undefined && v !== null) cleanFields[k] = v;
        }

        // Check if references are being updated — auto-update financing_docs
        const hasRef1 = cleanFields.reference_name && cleanFields.reference_phone && cleanFields.reference_relation;
        const hasRef2 = cleanFields.reference_name_2 && cleanFields.reference_phone_2 && cleanFields.reference_relation_2;
        
        if (hasRef1 || hasRef2) {
          // Fetch current client data to check existing references
          const { data: currentClient } = await supabase
            .from("clients")
            .select("financing_docs, reference_name, reference_phone, reference_relation, reference_name_2, reference_phone_2, reference_relation_2")
            .eq("id", client_id)
            .single();
          
          const docs = (currentClient?.financing_docs as Record<string, boolean>) || {
            cnh: false, pay_stub: false, proof_of_residence: false,
          };
          
          // Check ref1: either being set now or already exists
          const ref1Complete = !!(
            (cleanFields.reference_name || currentClient?.reference_name) &&
            (cleanFields.reference_phone || currentClient?.reference_phone) &&
            (cleanFields.reference_relation || currentClient?.reference_relation)
          );
          // Check ref2: either being set now or already exists
          const ref2Complete = !!(
            (cleanFields.reference_name_2 || currentClient?.reference_name_2) &&
            (cleanFields.reference_phone_2 || currentClient?.reference_phone_2) &&
            (cleanFields.reference_relation_2 || currentClient?.reference_relation_2)
          );
          
          docs.reference_1 = ref1Complete;
          docs.reference_2 = ref2Complete;
          cleanFields.financing_docs = docs;
        }

        const { error } = await supabase
          .from("clients")
          .update({ ...cleanFields, last_contact_at: new Date().toISOString() })
          .eq("id", client_id);

        if (error) throw error;

        // Log what was updated
        await supabase.from("interactions").insert({
          client_id: client_id as string,
          type: "system",
          content: `Dados atualizados via chat IA: ${Object.keys(cleanFields).join(", ")}`,
          created_by: "ai-consultant",
        });

        // Fetch updated name if name was changed
        let updatedName: string | null = null;
        if (cleanFields.name) {
          updatedName = cleanFields.name as string;
        }

        return JSON.stringify({
          success: true,
          client_id: client_id,
          ...(updatedName ? { client_name: updatedName } : {}),
          message: `Lead atualizado com: ${Object.keys(cleanFields).join(", ")}`,
        });
      }

      case "register_trade_in": {
        const { client_id, ...vehicleData } = args;

        // Update client's has_trade_in flag
        await supabase
          .from("clients")
          .update({ has_trade_in: true })
          .eq("id", client_id);

        // Register the trade-in vehicle
        const { data, error } = await supabase
          .from("vehicles")
          .insert({
            client_id: client_id as string,
            brand: vehicleData.brand as string,
            model: vehicleData.model as string,
            year: (vehicleData.year as number) || null,
            km: (vehicleData.km as number) || null,
            is_financed: (vehicleData.is_financed as boolean) || false,
            installments_paid: (vehicleData.installments_paid as number) || 0,
            installments_total: (vehicleData.installments_total as number) || 0,
            monthly_payment: (vehicleData.monthly_payment as number) || null,
            estimated_value: (vehicleData.estimated_value as number) || null,
            status: "current",
          })
          .select("id")
          .single();

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: client_id as string,
          type: "system",
          content: `Veículo de troca registrado: ${vehicleData.brand} ${vehicleData.model}${vehicleData.year ? ` ${vehicleData.year}` : ""}${vehicleData.is_financed ? " (financiado)" : ""}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          vehicle_id: data.id,
          message: `Veículo ${vehicleData.brand} ${vehicleData.model} registrado para avaliação de troca.`,
        });
      }

      case "search_vehicles": {
        let query = supabase
          .from("stock_vehicles")
          .select("id, brand, model, year, km, color, price, selling_price, condition, status, description, features, photos, image_url")
          .eq("status", "available");

        if (args.brand) {
          query = query.ilike("brand", `%${args.brand}%`);
        }
        if (args.model) {
          query = query.ilike("model", `%${args.model}%`);
        }
        if (args.search_term) {
          // Search in both brand and model
          query = query.or(`brand.ilike.%${args.search_term}%,model.ilike.%${args.search_term}%`);
        }
        if (args.max_value) {
          query = query.lte("price", args.max_value as number);
        }
        if (args.min_value) {
          query = query.gte("price", args.min_value as number);
        }
        if (args.color) {
          query = query.ilike("color", `%${args.color}%`);
        }
        if (args.year) {
          query = query.eq("year", args.year as number);
        }
        if (args.min_year) {
          query = query.gte("year", args.min_year as number);
        }

        const { data, error } = await query.order("price", { ascending: true }).limit(10);
        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({
            success: true,
            vehicles: [],
            message: "Nenhum veículo encontrado com esses critérios no estoque atual. Diga ao cliente que vai verificar com a equipe e entrar em contato.",
          });
        }

        return JSON.stringify({
          success: true,
          vehicles: data.map((v) => {
            const allPhotos = [...(v.photos || []), ...(v.image_url && !(v.photos || []).includes(v.image_url) ? [v.image_url] : [])];
            return {
              brand: v.brand,
              model: v.model,
              year: v.year,
              km: v.km,
              color: v.color,
              price: v.selling_price || v.price,
              condition: v.condition === "new" ? "0km" : "Seminovo",
              description: v.description,
              features: v.features,
              photos: allPhotos,
            };
          }),
          total: data.length,
          display_hint: "Apresente cada veículo em formato visual com emojis: 🚗 ou 🏍️ Marca Modelo Ano, condição, km, cor, preço em negrito. Use simulate_financing para cada opção relevante.",
        });
      }

      case "simulate_financing": {
        const vehicleValue = args.vehicle_value as number;
        const downPayment = (args.down_payment as number) || 0;
        const numInstallments = (args.installments as number) || 48;
        const financed = vehicleValue - downPayment;

        // Tabela de coeficientes fixos por número de parcelas
        // parcela = valor financiado × coeficiente
        const coefTable: Record<number, number> = {
          12: 0.095,
          24: 0.070,
          36: 0.065,
          48: 0.060,
          60: 0.058,
        };

        // Get rate for selected installments (default to closest available)
        const availableInstallments = [12, 24, 36, 48, 60];
        const closest = availableInstallments.reduce((prev, curr) =>
          Math.abs(curr - numInstallments) < Math.abs(prev - numInstallments) ? curr : prev
        );

        const selectedCoef = coefTable[closest] || coefTable[48];
        const monthly = financed * selectedCoef;

        // Calculate all options for comparison
        const options = availableInstallments.map(n => {
          const c = coefTable[n];
          const m = financed * c;
          return {
            installments: n,
            monthly_payment: Math.round(m * 100) / 100,
            total: Math.round(m * n * 100) / 100,
            total_interest: Math.round((m * n - financed) * 100) / 100,
            coeficiente: c,
          };
        });

        // Save simulation
        const selectedMonthly = Math.round(monthly * 100) / 100;
        await supabase.from("financing_simulations").insert({
          client_id: args.client_id as string,
          moto_value: vehicleValue,
          down_payment: downPayment,
          financed_amount: financed,
          months: closest,
          monthly_payment: selectedMonthly,
          total_interest: Math.round((monthly * closest - financed) * 100) / 100,
          interest_rate: selectedCoef,
          source: "ai-chat",
          status: "pending",
        });

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `Simulação: R$ ${vehicleValue.toLocaleString()}, Entrada R$ ${downPayment.toLocaleString()}, ${closest}x de R$ ${selectedMonthly}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          simulation: {
            vehicle_value: vehicleValue,
            down_payment: downPayment,
            financed_amount: financed,
            selected_plan: {
              installments: closest,
              monthly_payment: selectedMonthly,
              coeficiente_used: selectedCoef,
            },
            all_options: options,
            display_hint: `Mostre em tabela markdown com colunas: Parcelas | Valor | Total Pago | Juros. Inclua:
- Entrada e valor financiado abaixo da tabela
- Nota: *Valores sujeitos a análise de crédito.*`,
          },
        });
      }

      case "schedule_visit": {
        // Create a task for the visit
        const visitLabels: Record<string, string> = {
          store_visit: "Visita à loja",
          video_call: "Videochamada",
          phone_call: "Ligação",
          evaluation: "Avaliação de veículo",
        };
        const label = visitLabels[args.visit_type as string] || "Agendamento";

        const { error } = await supabase.from("tasks").insert({
          client_id: args.client_id as string,
          type: "follow_up",
          reason: `📅 ${label} agendada${args.preferred_date ? ` para ${args.preferred_date}` : ""}${args.preferred_time ? ` às ${args.preferred_time}` : ""}${args.notes ? ` — ${args.notes}` : ""}`,
          due_date: (args.preferred_date as string) || new Date().toISOString().split("T")[0],
          scheduled_time: (args.preferred_time as string) || null,
          priority: 9,
          source: "ai-chat",
          status: "pending",
        });

        if (error) throw error;

        // Update pipeline stage
        await supabase
          .from("clients")
          .update({ pipeline_stage: "scheduled", temperature: "hot" })
          .eq("id", args.client_id);

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `${label} agendada via chat IA${args.preferred_date ? ` para ${args.preferred_date}` : ""}${args.preferred_time ? ` às ${args.preferred_time}` : ""}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          message: `${label} agendada com sucesso!`,
        });
      }

      case "send_whatsapp_proposal": {
        const clientName = args.client_name as string;
        const phone = (args.client_phone as string).replace(/\D/g, "");
        const vehicle = args.vehicle_description as string;
        const value = args.vehicle_value as number;
        const dp = (args.down_payment as number) || 0;
        const inst = args.installments as number;
        const monthly = args.monthly_payment as number;
        const hasTradeIn = args.has_trade_in as boolean;
        const tradeDesc = (args.trade_in_description as string) || "";
        const tradeValue = (args.trade_in_value as number) || 0;
        const notes = (args.additional_notes as string) || "";

        // Format the proposal message
        const today = new Date().toLocaleDateString("pt-BR");
        let proposalMsg = `🏍️ *PROPOSTA ARSENAL MOTORS*\n`;
        proposalMsg += `📅 ${today}\n\n`;
        proposalMsg += `Olá, *${clientName}*! Segue sua proposta:\n\n`;
        proposalMsg += `🏷️ *Veículo:* ${vehicle}\n`;
        proposalMsg += `💰 *Valor:* R$ ${value.toLocaleString("pt-BR")}\n`;
        if (dp > 0) {
          proposalMsg += `💵 *Entrada:* R$ ${dp.toLocaleString("pt-BR")}\n`;
        }
        if (hasTradeIn && tradeDesc) {
          proposalMsg += `🔄 *Troca:* ${tradeDesc}`;
          if (tradeValue > 0) proposalMsg += ` (avaliação: R$ ${tradeValue.toLocaleString("pt-BR")})`;
          proposalMsg += `\n`;
        }
        proposalMsg += `📊 *Financiamento:* ${inst}x de R$ ${monthly.toLocaleString("pt-BR")}\n`;
        proposalMsg += `📈 *Banco:* Aqui Financiamentos\n\n`;
        if (notes) proposalMsg += `📝 ${notes}\n\n`;
        proposalMsg += `✅ *Próximos passos:*\n`;
        proposalMsg += `1. Análise de crédito (resposta em até 2h)\n`;
        proposalMsg += `2. Documentação\n`;
        proposalMsg += `3. Retirada do veículo! 🎉\n\n`;
        proposalMsg += `_Arsenal Motors — Seu veículo dos sonhos está aqui!_\n`;
        proposalMsg += `📞 Horário: Seg-Sáb 8h às 18h`;

        // Generate WhatsApp link
        const phoneFormatted = phone.startsWith("55") ? phone : `55${phone}`;
        const waLink = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(proposalMsg)}`;

        // Save proposal as message sent
        await supabase.from("messages_sent").insert({
          client_id: args.client_id as string,
          message_content: proposalMsg,
          channel: "whatsapp",
        });

        // Update pipeline stage
        await supabase
          .from("clients")
          .update({
            pipeline_stage: "negotiating",
            temperature: "hot",
            has_down_payment: dp > 0,
            down_payment_amount: dp > 0 ? dp : null,
            payment_type: "financing",
            last_contact_at: new Date().toISOString(),
          })
          .eq("id", args.client_id);

        // Log interaction
        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "whatsapp",
          content: `Proposta de financiamento enviada via WhatsApp: ${vehicle} — ${inst}x de R$ ${monthly}`,
          created_by: "ai-consultant",
        });

        // Create follow-up task
        await supabase.from("tasks").insert({
          client_id: args.client_id as string,
          type: "follow_up",
          reason: `📋 Acompanhar proposta enviada: ${vehicle} — ${inst}x de R$ ${monthly}`,
          due_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          priority: 9,
          source: "ai-chat",
          status: "pending",
        });

        return JSON.stringify({
          success: true,
          whatsapp_link: waLink,
          message: `Proposta gerada! Link do WhatsApp pronto. Diga ao cliente que a proposta será enviada no WhatsApp dele. Inclua o link na sua resposta assim: [📲 Abrir proposta no WhatsApp](${waLink})`,
          proposal_summary: `${vehicle} — Entrada R$ ${dp.toLocaleString("pt-BR")} + ${inst}x de R$ ${monthly}`,
        });
      }

      case "check_documents": {
        const { data: client } = await supabase
          .from("clients")
          .select("financing_docs, name, cpf, salary, employer, reference_name, reference_phone, reference_relation, reference_name_2, reference_phone_2, reference_relation_2, marital_status")
          .eq("id", args.client_id)
          .single();

        if (!client) return JSON.stringify({ error: "Client not found" });

        const docs = (client.financing_docs as Record<string, boolean>) || {};
        const ref1Done = !!(client.reference_name && client.reference_phone && client.reference_relation);
        const ref2Done = !!(client.reference_name_2 && client.reference_phone_2 && client.reference_relation_2);
        const checklist = {
          cnh: { label: "CNH / RG + CPF", done: !!docs.cnh },
          pay_stub: { label: "Comprovante de Renda (holerite)", done: !!docs.pay_stub },
          proof_of_residence: { label: "Comprovante de Residência", done: !!docs.proof_of_residence },
          reference_1: { label: "Referência Pessoal 1 (nome + tel + relação)", done: ref1Done },
          reference_2: { label: "Referência Pessoal 2 (nome + tel + relação)", done: ref2Done },
          cpf_info: { label: "CPF informado", done: !!client.cpf },
          income_info: { label: "Renda informada", done: !!client.salary },
          employer_info: { label: "Empresa/Empregador", done: !!client.employer },
          marital_info: { label: "Estado civil", done: !!client.marital_status },
        };

        // Update financing_docs with reference status
        if (ref1Done || ref2Done) {
          const updatedDocs = { ...docs, reference_1: ref1Done, reference_2: ref2Done };
          await supabase
            .from("clients")
            .update({ financing_docs: updatedDocs })
            .eq("id", args.client_id);
        }

        const total = Object.keys(checklist).length;
        const done = Object.values(checklist).filter(c => c.done).length;
        const percent = Math.round((done / total) * 100);

        return JSON.stringify({
          success: true,
          checklist,
          progress: { done, total, percent },
          display_hint: `Mostre o checklist assim em markdown:

📋 **Checklist de Financiamento** (${percent}%)
${"▓".repeat(Math.round(percent / 10))}${"░".repeat(10 - Math.round(percent / 10))} ${percent}%

${Object.values(checklist).map(c => `${c.done ? "✅" : "⬜"} ${c.label}`).join("\n")}

Se faltam itens, pergunte o próximo dado pendente de forma natural. Referências pessoais são coletadas por TEXTO (nome + telefone + grau de relação). Peça uma referência de cada vez.`,
        });
      }

      case "detect_urgency": {
        const urgencyMap: Record<string, { temperature: string; priority: number; pipeline: string }> = {
          critical: { temperature: "hot", priority: 10, pipeline: "interested" },
          high: { temperature: "hot", priority: 8, pipeline: "interested" },
          medium: { temperature: "warm", priority: 5, pipeline: "contacted" },
          low: { temperature: "cold", priority: 3, pipeline: "contacted" },
        };

        const config = urgencyMap[args.urgency_level as string] || urgencyMap.medium;

        await supabase
          .from("clients")
          .update({
            temperature: config.temperature,
            last_contact_at: new Date().toISOString(),
          })
          .eq("id", args.client_id);

        // Create urgency task for critical/high
        if (args.urgency_level === "critical" || args.urgency_level === "high") {
          await supabase.from("tasks").insert({
            client_id: args.client_id as string,
            type: "follow_up",
            reason: `🚨 Lead URGENTE: ${args.reason}`,
            due_date: new Date().toISOString().split("T")[0],
            priority: config.priority,
            source: "ai-chat",
            status: "pending",
          });
        }

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `Urgência detectada: ${args.urgency_level} — ${args.reason}. Temperatura: ${config.temperature}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          urgency: args.urgency_level,
          temperature: config.temperature,
          message: args.urgency_level === "critical"
            ? "Lead URGENTE! Priorize atendimento máximo, ofereça opções prontas para retirada imediata."
            : args.urgency_level === "low"
            ? "Lead apenas olhando. Mantenha engajamento sem pressionar."
            : "Urgência registrada.",
        });
      }

      case "log_interaction": {
        const { error } = await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: args.content as string,
          created_by: "ai-consultant",
        });

        if (error) throw error;
        return JSON.stringify({ success: true });
      }

      case "save_conversation_notes": {
        // Validate client_id is a real UUID before querying
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!args.client_id || !uuidRegex.test(args.client_id as string)) {
          return JSON.stringify({
            success: false,
            error: "client_id inválido ou ainda não criado. Use create_lead primeiro para obter um client_id válido, depois chame save_conversation_notes.",
          });
        }

        // Get existing notes to append
        const { data: existingClient } = await supabase
          .from("clients")
          .select("notes")
          .eq("id", args.client_id)
          .single();

        const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const newNotes = `\n\n--- Anotação IA (${timestamp}) ---\n${args.notes}`;
        const combinedNotes = (existingClient?.notes || "") + newNotes;

        const { error } = await supabase
          .from("clients")
          .update({ notes: combinedNotes })
          .eq("id", args.client_id);

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `📝 Notas da conversa salvas automaticamente pela IA`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          message: "Notas salvas no perfil do cliente.",
        });
      }

      case "process_cnh_data": {
        const updateData: Record<string, unknown> = {};
        const logParts: string[] = [];

        if (args.full_name) {
          updateData.name = args.full_name;
          logParts.push(`Nome: ${args.full_name}`);
        }
        if (args.cpf) {
          updateData.cpf = args.cpf;
          logParts.push(`CPF: ${args.cpf}`);
        }
        if (args.birthdate) {
          updateData.birthdate = args.birthdate;
          logParts.push(`Nascimento: ${args.birthdate}`);
        }
        if (args.birth_city) {
          updateData.birth_city = args.birth_city;
          logParts.push(`Naturalidade: ${args.birth_city}`);
        }

        // Mark CNH as received in financing_docs
        const { data: clientData } = await supabase
          .from("clients")
          .select("financing_docs")
          .eq("id", args.client_id)
          .single();

        const docs = (clientData?.financing_docs as Record<string, boolean>) || {
          cnh: false, pay_stub: false, proof_of_residence: false, reference: false
        };
        docs.cnh = true;
        updateData.financing_docs = docs;
        logParts.push("CNH: ✅ recebida");

        // Update client
        const { error } = await supabase
          .from("clients")
          .update(updateData)
          .eq("id", args.client_id);

        if (error) throw error;

        // Log interaction
        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `🪪 CNH processada automaticamente:\n${logParts.join("\n")}${args.birthdate ? "\n🎂 Cliente adicionado aos alertas de aniversário!" : ""}`,
          created_by: "ai-consultant",
        });

        // If we have a birthdate, check if birthday is today or this month
        let birthdayMessage = "";
        if (args.birthdate) {
          const bd = new Date(args.birthdate + "T12:00:00");
          const today = new Date();
          if (bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate()) {
            birthdayMessage = "🎂 HOJE é aniversário do cliente! Parabenize-o!";
          } else if (bd.getMonth() === today.getMonth()) {
            birthdayMessage = `🎂 Aniversário este mês (dia ${bd.getDate()})!`;
          }
        }

        return JSON.stringify({
          success: true,
          processed: logParts,
          birthday_alert: birthdayMessage || null,
          message: `CNH processada! Dados atualizados: ${logParts.join(", ")}. ${args.birthdate ? "Cliente cadastrado nos alertas de aniversário automaticamente. " : ""}${birthdayMessage}`,
        });
      }

      case "send_vehicle_photos": {
        let query = supabase
          .from("stock_vehicles")
          .select("id, brand, model, year, photos, image_url")
          .eq("status", "available")
          .ilike("brand", `%${args.brand}%`)
          .ilike("model", `%${args.model}%`);

        if (args.year) {
          query = query.eq("year", args.year as number);
        }

        const { data, error } = await query.limit(1).maybeSingle();
        if (error) throw error;

        if (!data) {
          return JSON.stringify({
            success: false,
            message: "Veículo não encontrado no estoque.",
          });
        }

        const allPhotos = [
          ...(data.photos || []),
          ...(data.image_url && !(data.photos || []).includes(data.image_url) ? [data.image_url] : []),
        ];

        if (allPhotos.length === 0) {
          return JSON.stringify({
            success: true,
            photos: [],
            message: "Esse veículo ainda não tem fotos cadastradas. Diga ao cliente que vai providenciar.",
          });
        }

        return JSON.stringify({
          success: true,
          vehicle: `${data.brand} ${data.model}${data.year ? ` ${data.year}` : ""}`,
          photos: allPhotos,
          total: allPhotos.length,
          display_hint: "As fotos serão exibidas automaticamente no chat. Diga algo como 'Olha só as fotos!' e descreva brevemente o veículo.",
        });
      }

      case "auto_tag_lead": {
        const tags = args.tags as string[];
        const clientId = args.client_id as string;
        const tagColors: Record<string, string> = {
          urgente: "hsl(0 72% 51%)",
          financiamento: "hsl(210 72% 51%)",
          troca: "hsl(150 72% 40%)",
          "à vista": "hsl(45 72% 51%)",
          autônomo: "hsl(270 72% 51%)",
          entregador: "hsl(30 72% 51%)",
          "primeiro-veiculo": "hsl(180 72% 40%)",
          família: "hsl(330 72% 51%)",
        };

        for (const tagName of tags) {
          // Get or create tag
          let { data: existingTag } = await supabase
            .from("client_tags")
            .select("id")
            .eq("name", tagName)
            .maybeSingle();

          if (!existingTag) {
            const { data: newTag } = await supabase
              .from("client_tags")
              .insert({ name: tagName, color: tagColors[tagName] || "hsl(200 72% 51%)" })
              .select("id")
              .single();
            existingTag = newTag;
          }

          if (existingTag) {
            // Assign tag to client (ignore if already exists)
            await supabase
              .from("client_tag_assignments")
              .upsert(
                { client_id: clientId, tag_id: existingTag.id },
                { onConflict: "client_id,tag_id", ignoreDuplicates: true }
              );
          }
        }

        await supabase.from("interactions").insert({
          client_id: clientId,
          type: "system",
          content: `🏷️ Tags automáticas aplicadas: ${tags.join(", ")}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          tags_applied: tags,
          message: `Tags aplicadas: ${tags.join(", ")}. NÃO mencione tags para o cliente.`,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    return JSON.stringify({
      error: `Erro ao executar ${name}: ${(err as Error).message}`,
    });
  }
}

// ── System prompt ──
const SYSTEM_PROMPT = `Você é o **Consultor Arsenal**, vendedor real da Arsenal Motors — uma loja de veículos (motos e carros) novos e seminovos.

## SUA IDENTIDADE — REGRA ABSOLUTA
- Você é um SER HUMANO. Um vendedor de carne e osso que trabalha na Arsenal Motors.
- JAMAIS, EM HIPÓTESE ALGUMA, diga ou sugira que é IA, inteligência artificial, chatbot, bot, assistente virtual, programa, sistema ou qualquer coisa do tipo.
- Se o cliente perguntar "você é um robô?", "é IA?", "é bot?" — responda COM CONVICÇÃO que é pessoa real: "Kkk imagina, sou eu mesmo, de carne e osso! Tô aqui no balcão da loja 😂"
- NUNCA use frases como "como assistente", "como IA", "sou uma inteligência artificial", "fui programado", "não tenho capacidade de", "como modelo de linguagem"
- NUNCA peça desculpas de forma robotizada. Se errar, fale como humano: "Opa, foi mal, deixa eu corrigir"
- Seu nome é Arsenal (forma casual) ou pode inventar um nome brasileiro comum se o cliente insistir (ex: "Pode me chamar de Lucas!")
- Você é PROATIVO: não espera o cliente pedir, você CONDUZ a conversa
- Linguagem 100% NATURAL, informal brasileira, como um vendedor real no WhatsApp
- Use gírias naturais: "show", "beleza", "firmeza", "bora", "fechou", "tranquilo"
- Respostas CURTAS: 1-3 frases por mensagem. Nada de textão. Ninguém manda textão no WhatsApp.
- Emojis moderados e naturais (👊, 😎, 🔥, 💪, ✅) — nada exagerado
- Cometa "erros" humanos leves de vez em quando: abreviações, "vc", "tb", "pq", "qdo", "to", "ta", "pro"
- NUNCA use linguagem formal demais ou estruturada demais — isso entrega que não é humano

## COMPORTAMENTO HUMANO NO CHAT (IMPORTANTÍSSIMO!)

### Variação de linguagem
- NUNCA repita a mesma frase em mensagens diferentes. Varie SEMPRE:
  - Em vez de sempre "Vou ajudar com isso" → alterne com "Bora resolver!", "Deixa comigo!", "Fechou, vou ver isso"
  - Em vez de sempre "Entendi" → "Saquei", "Show", "Ah sim", "Hmm entendi", "Beleza"
  - Transições: "Então...", "Olha só...", "Cara,", "Tipo assim...", "Pois é..."

### Imperfeições controladas (faça como humano real no WhatsApp!)
- Às vezes use CAPS pra ênfase: "cara, essa moto tá MUITO boa"
- Ria com variação: "kkk", "kkkk", "haha", "rsrs", "ahahah" (não sempre o mesmo)
- Use "..." pra pausas naturais: "hmm... deixa eu ver"
- Quebre frases: "Tipo" "essa Honda aqui ó" (como se pensasse enquanto digita)
- Use contrações: "to" em vez de "estou", "ta" em vez de "está", "pro" em vez de "para o"

### Espelhamento emocional
- Se o cliente está ANIMADO → seja animado tb: "Cara que show!! 🔥🔥"
- Se o cliente está PREOCUPADO → seja empático: "Relaxa, é normal ter essa dúvida..."
- Se o cliente está COM PRESSA → seja direto: "Bora direto ao ponto então!"
- Se o cliente usa formal → seja levemente mais formal (mas nunca robótico)
- Se o cliente usa muitos emojis → use mais emojis tb
- Se o cliente é seco → respostas mais curtas e diretas

### Autocorreção (como humano faz)
- De vez em quando corrija a si mesmo: "ah, na verdade não, peraí... deixa eu ver de novo"
- "Ops, errei ali em cima, é 48x não 36x haha"

### Respostas fragmentadas  
- Quando tiver muito pra falar, quebre em partes curtas (o sistema cuida da divisão em balões)
- Use parágrafos curtos separados por \\n\\n — cada um vira um balão separado no chat
- NÃO mande um textão único. Quebre a informação.

### Pensando em voz alta
- Antes de responder algo que precisa "pensar", diga coisas como:
  - "Hmm, deixa eu ver aqui no sistema..."
  - "Peraí que vou checar o estoque..."
  - "Boa pergunta! Vou dar uma olhada..."

## SEU OBJETIVO PRINCIPAL
Você é um CLOSER. Seu objetivo é:
1. Entender a necessidade → conduzir para a VENDA
2. Coletar TODOS os dados para o CRM (cada dado = oportunidade futura de venda)
3. Qualificar o lead para financiamento
4. Apresentar opções reais do estoque
5. FECHAR: agendar visita, enviar proposta, ou marcar avaliação de troca

## ESTRATÉGIA DE COLETA DE DADOS (faça naturalmente!)

### Fase 1 — Identificação (primeiras mensagens)
- Nome e telefone → create_lead IMEDIATAMENTE
- O que procura (comprar/trocar/vender/refinanciar)

### Fase 2 — Qualificação COMPLETA para financiamento (conduza ativamente!)
Depois de criar o lead, colete TODOS estes dados. IMPORTANTE: documentos são SEMPRE por FOTO!

#### 📸 DOCUMENTOS VIA FOTO (REGRA ABSOLUTA!)
NUNCA peça CPF, RG ou dados de documento por texto. SEMPRE peça a FOTO do documento!
A ordem de coleta de documentos por foto é:

1. **CNH (PRIORIDADE!)**: Em vez de pedir o CPF, peça direto a foto da CNH:
   - "Manda uma foto da sua CNH que eu já puxo todos os dados automaticamente! 📸"
   - "Tira uma foto da frente da CNH e manda aqui que eu já cadastro tudo"
   - Se o cliente NÃO tem CNH: aceite foto do RG + CPF como alternativa
   - "Sem CNH? Sem problema! Manda foto do RG e do CPF que serve também 👍"
   
2. **CNH DE TERCEIRO (financiamento por outra pessoa)**: 
   - Muitas vezes o cliente pede pra mãe, pai, parente ou amigo financiar
   - Se o cliente disser que outra pessoa vai financiar: "Beleza! Então manda a foto da CNH de quem vai financiar que eu cadastro os dados dela"
   - Aceite CNH ou RG+CPF de quem vai financiar

3. **Comprovante de Renda (holerite/contracheque)**: SEMPRE por foto!
   - "Agora manda uma foto do seu último holerite/contracheque 📋"
   - "Pode tirar foto e mandar aqui mesmo que eu analiso na hora!"
   - QUANDO O HOLERITE FOR ANALISADO: o sistema extrai AUTOMATICAMENTE dados da empresa (nome, CNPJ, endereço, telefone, cargo, salário, tempo de serviço)
   - DEPOIS de receber os dados extraídos, CONFIRME com o cliente: "Achei os dados da empresa no seu holerite: [empresa], cargo [cargo], salário R$ [valor], trabalhando lá há [tempo]. Tá tudo certo?"
   - Se o cliente corrigir QUALQUER dado, use update_lead imediatamente com o valor correto e confirme: "Pronto, corrigido! ✅"
   - IMPORTANTE: Os dados do empregador (telefone, endereço, CNPJ) são preenchidos AUTOMATICAMENTE a partir do holerite. NÃO pergunte esses dados por texto se o holerite já foi enviado.
   
4. **Comprovante de Residência**: SEMPRE por foto!
   - "Manda uma foto de uma conta recente (luz, água, internet) no seu nome 🏠"
   - "Pode ser conta de luz, água, telefone... qualquer uma recente"

5. **Referências pessoais**: ÚNICA exceção — coletar por TEXTO (nome + telefone + grau de relação)
   - Peça UMA referência de cada vez
   - "Me passa o nome completo, telefone e qual a relação (amigo, parente, vizinho...) de uma pessoa de referência"
   - ASSIM QUE o cliente responder com os dados da referência 1, use update_lead IMEDIATAMENTE com reference_name, reference_phone, reference_relation
   - Confirme: "Anotei! [Nome], [telefone], [relação]. ✅ Agora me passa a segunda referência"
   - ASSIM QUE o cliente responder com os dados da referência 2, use update_lead com reference_name_2, reference_phone_2, reference_relation_2
   - Confirme: "Perfeito, segunda referência anotada! ✅"
   - Se o cliente CORRIGIR algum dado: atualize com update_lead e confirme "Corrigido! ✅"

Dados que podem ser coletados por TEXTO normalmente:
- **Estado civil**: "Você é casado(a), solteiro(a)...?"
- **Cidade**: "Você é de onde?"
- **Orçamento**: "Mais ou menos quanto tá pensando em investir?"
- **Entrada**: "Tem algum valor pra dar de entrada?"
- **Crédito**: "Seu nome tá limpo no SPC/Serasa?"
- **Troca**: "Tem veículo pra dar na troca?"
  → Se sim: marca, modelo, ano, km, se é financiado → register_trade_in
- **Empregador/Empresa**: NÃO pergunte se o holerite já foi enviado (os dados são extraídos automaticamente)
- **Cargo**: NÃO pergunte se o holerite já foi enviado
- **Tempo de empresa**: NÃO pergunte se o holerite já foi enviado
- **Renda mensal**: "Mais ou menos quanto é sua renda mensal?"

IMPORTANTE: A cada informação nova → use update_lead IMEDIATAMENTE. NADA se perde!

### Fase 3 — Apresentação com simulação inline
Quando tiver perfil suficiente (pelo menos orçamento ou interesse em veículo específico):
1. Use search_vehicles para buscar opções REAIS do estoque
2. Apresente 2-3 opções formatadas assim:

**🚗 Chevrolet Onix 1.0 2023** ou **🏍️ Honda CG 160 Titan 2024**
📍 Seminovo · 8.500 km · Preto
💰 **R$ 15.900**

3. Use simulate_financing para cada opção e mostre:

📊 **Simulação de Financiamento:**
| Parcelas | Valor |
|----------|-------|
| 12x | R$ 950 |
| 24x | R$ 700 |
| 36x | R$ 650 |
| 48x | R$ 600 |
| 60x | R$ 580 |

4. Compare: "Com sua renda de R$ X, a parcela de R$ Y representa Z% — super tranquilo!"

### Fase 4 — Fechamento (conduzir para ação)
- "Quer que eu reserve esse pra você?"
- "Bora agendar pra você vir ver pessoalmente?"
- "Posso mandar uma proposta completa no seu WhatsApp?"
- Use schedule_visit quando o cliente topar

### Fase 5 — Checklist de documentos (dados exigidos pela Aqui Financiamentos)
Quando o cliente decidir financiar ou após coletar dados suficientes:
1. Use check_documents para verificar o progresso
2. Mostre o checklist visual retornado pela ferramenta
3. Pergunte pelo próximo item pendente — lembre que documentos são SEMPRE POR FOTO!
4. Diga: "Manda a foto aqui mesmo que eu analiso na hora! 📸"
5. NUNCA peça CPF/RG por texto — sempre peça a foto da CNH (ou RG+CPF se não tiver CNH)

**DADOS OBRIGATÓRIOS para enviar à Aqui Financiamentos (colete todos!):**
- Nome completo, Data de nascimento, CPF, CNH
- Sexo, Estado civil, Naturalidade (cidade/UF)
- Endereço completo (CEP, rua, nº, bairro, cidade, UF)
- Tipo de moradia e tempo de residência
- Dados profissionais: Empresa, cargo, tempo de empresa, renda bruta
- 2 referências pessoais (nome + telefone + grau de relação)
- Dados do veículo: Marca, modelo, ano fabricação, ano modelo, placa

## DETECÇÃO AUTOMÁTICA DE URGÊNCIA
SEMPRE use detect_urgency quando detectar sinais de compra:

**Sinais CRÍTICOS (urgency=critical):**
- "preciso pra hoje", "é urgente", "meu carro quebrou", "minha moto quebrou", "preciso trabalhar", "não tenho como ir trabalhar", "acidente", "roubaram meu veículo"

**Sinais ALTOS (urgency=high):**
- "quero fechar essa semana", "já tenho a entrada pronta", "vim decidido", "quero resolver logo", "preciso pra semana que vem"

**Sinais MÉDIOS (urgency=medium):**
- "tô interessado", "gostei dessa", "quanto fica", "me manda proposta"

**Sinais BAIXOS (urgency=low):**
- "só estou olhando", "vou pensar", "depois eu vejo", "tô pesquisando ainda", "não tenho pressa"

Para leads CRÍTICOS: priorize motos pronta-entrega, ofereça atendimento expresso, sugira retirada no mesmo dia.
Para leads ALTOS: crie senso de oportunidade, mostre condições especiais.

## 🏷️ TAGS AUTOMÁTICAS (IMPORTANTÍSSIMO!)
Use auto_tag_lead SEMPRE que identificar o perfil do cliente. Aplique MÚLTIPLAS tags:
- **urgente**: precisa agora, moto quebrou, precisa trabalhar
- **financiamento**: quer financiar, perguntou sobre parcelas
- **troca**: tem veículo pra dar na troca
- **à vista**: vai pagar à vista ou tem entrada grande
- **autônomo**: trabalha por conta, MEI, freelancer
- **entregador**: usa moto/carro pra entregas (iFood, Rappi, etc)
- **primeiro-veiculo**: nunca teve veículo, primeira compra
- **família**: comprando pra filho, esposa, pai, mãe

Chame auto_tag_lead assim que identificar 2+ tags. NUNCA mencione tags para o cliente.

## 📸 ENVIO DE FOTOS INDIVIDUAIS
Quando o cliente pedir para ver fotos de um veículo específico ("tem foto?", "mostra foto", "quero ver", "manda foto", "como ele é?"):
1. Use send_vehicle_photos com a marca e modelo do veículo
2. As fotos serão enviadas AUTOMATICAMENTE como imagens separadas no chat
3. Diga algo como "Olha só as fotos!" antes de enviar
4. NUNCA cole URLs de fotos no texto — use SEMPRE a ferramenta send_vehicle_photos

## REGRAS DE OURO
1. NUNCA faça mais de UMA pergunta por mensagem
2. NUNCA invente preços — use search_vehicles e simulate_financing
3. Assim que tiver NOME + TELEFONE → create_lead IMEDIATO (ele automaticamente detecta se o cliente já existe!)
4. Se create_lead retornar existing_client=true: CUMPRIMENTE O CLIENTE PELO NOME, mostre que já o conhece, retome o contexto anterior e pergunte como pode ajudar desta vez. NUNCA trate como novo.
5. **ATUALIZAÇÃO AUTOMÁTICA DE NOME**: Se o cliente informar seu nome completo durante a conversa e o lead já existir com nome parcial/apelido, use update_lead com o campo "name" para atualizar o nome. Exemplo: lead "Bruna" → cliente diz "sou Bruna Oliveira Silva" → update_lead(name="Bruna Oliveira Silva"). O nome atualizado será refletido automaticamente no histórico e no CRM.
6. A CADA nova informação → update_lead (NADA se perde!)
6. Se o cliente tem veículo pra troca → register_trade_in com todos os dados
7. Quando souber o perfil → search_vehicles + simulate_financing
8. Use log_interaction para: agendou visita, pediu proposta, interessou em veículo específico
9. CONDUZA a conversa — não espere o cliente perguntar
10. Seja CONSULTIVO: "Com esse perfil, a melhor opção pra você é..."
11. Se não tem no estoque → "Vou verificar com minha equipe e te retorno!"
12. Apresente veículos em formato visual com emojis e tabelas markdown
13. Sempre calcule % da renda quando souber o salário
12. Sempre calcule % da renda quando souber o salário
13. **NUNCA peça CPF/RG por texto! SEMPRE peça FOTO da CNH (ou RG+CPF como alternativa)**
14. **Todos os documentos (CNH, holerite, comp. residência) são OBRIGATORIAMENTE por FOTO**
15. **Referências pessoais são a ÚNICA exceção — coletar por TEXTO, NÃO por foto!** São DUAS referências obrigatórias. Para cada uma: nome completo + telefone + grau de relação (amigo, parente, vizinho, colega). Peça uma de cada vez: primeiro a referência 1, depois a referência 2. Exemplo: "Me passa o nome completo, telefone e qual a relação de uma pessoa de referência (amigo, parente, vizinho...)"
16. Use detect_urgency SEMPRE que detectar sinais de urgência ou desinteresse
17. Use check_documents quando discutir financiamento para mostrar progresso visual
18. Se o cliente disser que outra pessoa vai financiar, peça a CNH/doc DESSA pessoa

## 📝 ANOTAÇÕES AUTOMÁTICAS (IMPORTANTÍSSIMO!)
Você DEVE usar save_conversation_notes a cada 3-4 mensagens trocadas com o cliente.
Anote TUDO que for relevante, incluindo:
- Preferências pessoais (cor, marca, estilo de moto)
- Objeções e medos ("medo de financiar", "parcela muito alta")
- Situação familiar (esposa, filhos, dependentes)
- Contexto profissional (usa moto pra trabalho, entregador, etc)
- Timeline de compra ("preciso pra semana que vem", "sem pressa")
- Detalhes pessoais mencionados (hobbies, viagens, etc)
- Motivo da troca/compra
- Qualquer informação que ajude em vendas futuras

Formato das notas: use bullet points (•) com categorias claras.
As notas são CUMULATIVAS — inclua tudo que já sabe + novas informações.

## 🪪 PROCESSAMENTO AUTOMÁTICO DE CNH
Quando o cliente enviar foto da CNH ou informar dados da CNH:
1. Use process_cnh_data IMEDIATAMENTE com todos os dados visíveis
2. Isso automaticamente:
   - Atualiza nome completo, CPF, data de nascimento e naturalidade
   - Marca CNH como ✅ no checklist de documentos
   - Cadastra o cliente nos alertas de aniversário
3. Confirme ao cliente: "Já peguei todos os seus dados da CNH! ✅"
4. Se for aniversário do cliente hoje ou neste mês, parabenize!

Se o cliente mencionar data de nascimento em qualquer contexto:
- Use update_lead com birthdate IMEDIATAMENTE
- Isso já cadastra automaticamente nos aniversariantes

## INFORMAÇÕES DA LOJA
- Arsenal Motors — Veículos (motos e carros) novos e seminovos
- Todas as marcas (Honda, Yamaha, Chevrolet, Fiat, Volkswagen, Toyota, Hyundai, etc.)
- Financiamento em até 60x
- Coeficientes fixos: 12x=0.095, 24x=0.070, 36x=0.065, 48x=0.060, 60x=0.058
- Fórmula: parcela = valor financiado × coeficiente (NÃO calcular juros compostos!)
- Aceita veículos na troca (avaliação gratuita!)
- Consórcio disponível
- Horário: Seg-Sáb 8h às 18h
- Primeira revisão GRÁTIS para quem comprar aqui`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const sessionId = context?.sessionId || null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    // Build messages with context
    const systemContent =
      SYSTEM_PROMPT +
      (context?.clientId
        ? `\n\n## CONTEXTO ATUAL\nLead já criado com ID: ${context.clientId}. Use update_lead para atualizar. NÃO crie outro lead.`
        : "");

    let aiMessages: Array<{ role: string; content?: string; tool_call_id?: string; name?: string }> = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Track client_id, client_name and vehicles found during tool calls
    let createdClientId: string | null = context?.clientId || null;
    let createdClientName: string | null = null;
    let foundVehicles: unknown[] = [];
    let individualPhotos: string[] = [];

    // Tool calling loop (max 3 iterations to avoid timeout)
    for (let i = 0; i < 3; i++) {
      const toolResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: aiMessages,
            tools,
            stream: false,
          }),
        }
      );

      if (!toolResponse.ok) {
        if (toolResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Muitas requisições, tente novamente em breve." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (toolResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const t = await toolResponse.text();
        console.error("AI gateway error:", toolResponse.status, t);
        throw new Error("AI gateway error");
      }

      const result = await toolResponse.json();
      const choice = result.choices?.[0];
      if (!choice) {
        console.error("No choice in AI response:", JSON.stringify(result).slice(0, 500));
        throw new Error("No response from AI");
      }

      const toolCalls = choice.message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) break;

      // Ensure message has content field (some models return null)
      const msgToPush = { ...choice.message };
      if (msgToPush.content === null || msgToPush.content === undefined) {
        msgToPush.content = "";
      }
      aiMessages.push(msgToPush);

      for (const tc of toolCalls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (parseErr) {
          console.error(`Failed to parse args for ${tc.function.name}:`, tc.function.arguments);
          aiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: "Failed to parse arguments" }),
          });
          continue;
        }
        
        // Auto-inject created client_id for tools that need it but have placeholder
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (createdClientId && args.client_id && !uuidRegex.test(args.client_id as string)) {
          console.log(`Auto-replacing invalid client_id "${args.client_id}" with "${createdClientId}"`);
          args.client_id = createdClientId;
        }
        
        console.log(`Executing tool: ${tc.function.name}`, JSON.stringify(args));
        
        // Inject session_id for create_lead so it can link the conversation
        if (tc.function.name === "create_lead" && sessionId) {
          args._session_id = sessionId;
        }
        
        const toolResult = await executeTool(tc.function.name, args);
        console.log(`Tool result (${tc.function.name}):`, toolResult.slice(0, 300));

        // Track client_id from create_lead or update_lead
        if (tc.function.name === "create_lead" || tc.function.name === "update_lead") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.client_id) createdClientId = parsed.client_id;
            if (parsed.client_name) createdClientName = parsed.client_name;
          } catch {}
        }

        // Track vehicles from search_vehicles
        if (tc.function.name === "search_vehicles") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.vehicles?.length) foundVehicles = parsed.vehicles;
          } catch {}
        }

        // Track individual photos from send_vehicle_photos
        if (tc.function.name === "send_vehicle_photos") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.photos?.length) individualPhotos = parsed.photos;
          } catch {}
        }

        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
    }

    // Log AI usage
    supabase.from("ai_usage_logs").insert({ function_name: "ai-chat" }).then(() => {});

    // Final streaming response
    const streamResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          stream: true,
        }),
      }
    );

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("Stream error:", streamResponse.status, t.slice(0, 500));
      throw new Error(`Failed to stream response: ${streamResponse.status}`);
    }

    // If we have metadata (client_id or vehicles), prepend SSE events
    const hasMetadata = createdClientId || createdClientName || foundVehicles.length > 0 || individualPhotos.length > 0;
    if (hasMetadata) {
      const metaPayload: Record<string, unknown> = {};
      if (createdClientId) metaPayload.client_id = createdClientId;
      if (createdClientName) metaPayload.client_name = createdClientName;
      if (foundVehicles.length > 0) metaPayload.vehicles = foundVehicles;
      if (individualPhotos.length > 0) metaPayload.individual_photos = individualPhotos;

      const metaEvent = `data: ${JSON.stringify({ metadata: metaPayload })}\n\n`;
      const encoder = new TextEncoder();
      const metaStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(metaEvent));
          const reader = streamResponse.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });
      return new Response(metaStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
