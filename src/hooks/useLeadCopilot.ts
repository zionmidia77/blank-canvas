import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`;

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 data URLs for display
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const useLeadCopilot = (clientId: string) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const qc = useQueryClient();

  const sendMessage = useCallback(async (input: string, imageFiles?: File[]) => {
    setIsLoading(true);

    // Convert images to base64
    let imageDataUrls: string[] = [];
    let imageBase64List: { data: string; media_type: string }[] = [];
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles.slice(0, 10)) {
        const dataUrl = await fileToBase64(file);
        imageDataUrls.push(dataUrl);
        // Extract base64 and mime
        const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
          imageBase64List.push({ data: match[2], media_type: match[1] });
        }
      }
    }

    const userMsg: CopilotMessage = {
      role: "user",
      content: input || (imageDataUrls.length > 0 ? `📷 ${imageDataUrls.length} imagem(ns) enviada(s)` : ""),
      images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
    };
    const allMessages = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      // Build messages for API (without images in history, only current)
      const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));

      const body: any = { client_id: clientId, messages: apiMessages };
      if (imageBase64List.length > 0) {
        body.images = imageBase64List;
      }

      const resp = await fetch(COPILOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 402) {
          throw new Error("Créditos de IA esgotados. Vá em Settings → Workspace → Usage para adicionar créditos.");
        }
        if (resp.status === 429) {
          throw new Error("Muitas requisições. Aguarde alguns segundos e tente novamente.");
        }
        throw new Error(err.error || "Falha ao conectar com a IA");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["lead-memory", clientId] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", clientId] });
    } catch (e) {
      console.error("Copilot error:", e);
      const msg = e instanceof Error ? e.message : "Erro ao processar. Tente novamente.";
      upsertAssistant(`⚠️ ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [messages, clientId, qc]);

  const pasteWhatsApp = useCallback(async (conversation: string) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: `📋 Conversa WhatsApp colada (${conversation.length} chars)` }]);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(COPILOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ client_id: clientId, whatsapp_paste: conversation }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 402) throw new Error("Créditos de IA esgotados. Vá em Settings → Workspace → Usage para adicionar créditos.");
        if (resp.status === 429) throw new Error("Muitas requisições. Aguarde alguns segundos e tente novamente.");
        throw new Error("Falha ao conectar com a IA");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["lead-memory", clientId] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", clientId] });
    } catch (e) {
      console.error("WhatsApp paste error:", e);
      const msg = e instanceof Error ? e.message : "Erro ao analisar conversa. Tente novamente.";
      upsertAssistant(`⚠️ ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, qc]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, pasteWhatsApp, clearMessages };
};

// Hook to fetch lead memory
export const useLeadMemory = (clientId: string) => {
  return useQuery({
    queryKey: ["lead-memory", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_memory")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

// Hook to fetch lead timeline
export const useLeadTimeline = (clientId: string) => {
  return useQuery({
    queryKey: ["lead-timeline", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_timeline_events")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};
