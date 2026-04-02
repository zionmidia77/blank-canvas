import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, UserCheck, Camera, Loader2, Mic, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import consultantAvatar from "@/assets/consultant-avatar.png";

// Extracted components
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatBubble from "@/components/chat/ChatBubble";
import SuggestionChips from "@/components/chat/SuggestionChips";
import VehicleCarousel from "@/components/chat/VehicleCarousel";
import { WELCOME_MESSAGE, CHAT_URL, CHAT_STORAGE_KEY, MIN_MESSAGE_INTERVAL_MS } from "@/components/chat/ChatConstants";
import { getOrCreateSessionId, playNotificationSound, formatDuration } from "@/components/chat/chatUtils";
import { splitIntoBubbles, calculateTypingDelay, calculateBubbleDelay, getRealisticOnlineStatus, getThinkingPhrase, shouldShowThinking } from "@/components/chat/humanBehavior";
import type { ChatMessage, StockVehicle } from "@/components/chat/types";

const ChatFunnel = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const [conversationSaved, setConversationSaved] = useState(false);
  const [isTransferred, setIsTransferred] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [pendingVehicles, setPendingVehicles] = useState<StockVehicle[] | null>(null);
  const pendingVehiclesRef = useRef<StockVehicle[] | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<string[] | null>(null);
  const pendingPhotosRef = useRef<string[] | null>(null);
  const [isRestoringChat, setIsRestoringChat] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [typingStatus, setTypingStatus] = useState<string | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const scrollToBottom = useCallback(() => {
    setTimeout(
      () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      100
    );
  }, []);

  // Save conversation to DB (using upsert to avoid duplicates)
  const saveConversation = useCallback(async (msgs: ChatMessage[], cId?: string | null, status = "active") => {
    const serialized = msgs.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));

    try {
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("chat_conversations")
          .update({
            messages: serialized as any,
            client_id: cId || clientId || null,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Use upsert with session_id to prevent race condition duplicates
        await supabase
          .from("chat_conversations")
          .upsert({
            session_id: sessionId,
            messages: serialized as any,
            client_id: cId || clientId || null,
            status,
          }, { onConflict: "session_id" });
        setConversationSaved(true);
      }
    } catch (err) {
      console.error("Error saving conversation:", err);
    }
  }, [sessionId, clientId]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    const newId = crypto.randomUUID();
    try { localStorage.setItem(CHAT_STORAGE_KEY, newId); } catch {}
    setSessionId(newId);
    setClientId(null);
    setClientName(null);
    setIsTransferred(false);
    setMessageCount(0);
    setShowSuggestions(true);
    setConversationSaved(false);
    const welcome: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, []);

  // Restore conversation from DB or show welcome
  useEffect(() => {
    const restoreChat = async () => {
      try {
        const { data } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle();

        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          const restored: ChatMessage[] = (data.messages as any[]).map((m, i) => ({
            id: `restored-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.timestamp || data.created_at),
          }));
          setMessages(restored);
          setClientId(data.client_id || null);
          if (data.client_id) {
            supabase.from("clients").select("name").eq("id", data.client_id).maybeSingle().then(({ data: c }) => {
              if (c?.name) setClientName(c.name.split(" ")[0]);
            });
          }
          setIsTransferred(data.status === "transferred");
          setConversationSaved(true);
          setShowSuggestions(false);
          setMessageCount(restored.filter(m => m.role === "user").length);
          scrollToBottom();
        } else {
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: WELCOME_MESSAGE,
            timestamp: new Date(),
          }]);
        }
      } catch (err) {
        console.error("Error restoring chat:", err);
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: WELCOME_MESSAGE,
          timestamp: new Date(),
        }]);
      } finally {
        setIsRestoringChat(false);
      }
    };

    restoreChat();
  }, [sessionId, scrollToBottom]);

  // Realtime subscription — listen for admin replies
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          if (!newData || !Array.isArray(newData.messages)) return;

          const dbMessages = newData.messages as any[];
          const lastDbMsg = dbMessages[dbMessages.length - 1];
          if (lastDbMsg?.role === 'assistant' && lastDbMsg?.content?.startsWith('[Vendedor]')) {
            const adminMsg: ChatMessage = {
              id: `admin-${Date.now()}`,
              role: 'assistant',
              content: lastDbMsg.content.replace('[Vendedor] ', ''),
              timestamp: new Date(lastDbMsg.timestamp || new Date()),
            };

            setMessages(prev => {
              if (prev.some(m => m.content === adminMsg.content && m.role === 'assistant')) return prev;
              return [...prev, adminMsg];
            });
            playNotificationSound();
            // Tab notification when not focused
            if (document.hidden) {
              const originalTitle = document.title;
              document.title = "💬 Nova mensagem — Arsenal Motors";
              const restore = () => { document.title = originalTitle; document.removeEventListener("visibilitychange", restore); };
              document.addEventListener("visibilitychange", restore);
            }
            scrollToBottom();
          }

          if (newData.status === 'attended') {
            setIsTransferred(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, scrollToBottom]);

  // Handle transfer to human
  const handleTransfer = useCallback(async () => {
    setIsTransferred(true);
    const transferMsg: ChatMessage = {
      id: `system-${Date.now()}`,
      role: "assistant",
      content: "Entendi seu perfil! 🤝 Vou passar pro meu gerente finalizar tudo pra você. Ele já tá por dentro da nossa conversa. Aguarda um minutinho...",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, transferMsg]);
    await saveConversation([...messages, transferMsg], clientId, "transferred");

    if (clientId) {
      await supabase.from("interactions").insert({
        client_id: clientId,
        type: "system" as const,
        content: "Lead transferido do chat para o gerente",
        created_by: "ai-consultant",
      });
    }

    toast.success("Conversa transferida para o gerente!");
    scrollToBottom();
  }, [messages, clientId, saveConversation, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || isTransferred) return;

      // Rate limiting
      const now = Date.now();
      if (now - lastMessageTimeRef.current < MIN_MESSAGE_INTERVAL_MS) {
        toast.error("Calma! Aguarde um momento antes de enviar outra mensagem.");
        return;
      }
      lastMessageTimeRef.current = now;

      let latestClientId = clientId;

      setShowSuggestions(false);
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputValue("");
      setIsLoading(true);
      setMessageCount(prev => prev + 1);
      scrollToBottom();

      const apiMessages = newMessages
        .filter((m) => m.id !== "welcome" || m.role === "user")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      if (messages[0]?.id === "welcome") {
        apiMessages.unshift({ role: "assistant", content: messages[0].content });
      }

      let assistantSoFar = "";
      const assistantId = `assistant-${Date.now()}`;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return prev.map((m) => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { id: assistantId, role: "assistant" as const, content: assistantSoFar, timestamp: new Date() }];
        });
        scrollToBottom();
      };

      // Human-like delay — proportional to message count
      const showThinking = shouldShowThinking(messageCount, false);
      if (showThinking) {
        setTypingStatus(getThinkingPhrase());
      }
      const humanDelay = calculateTypingDelay(text, messageCount < 3);
      await new Promise(resolve => setTimeout(resolve, humanDelay));

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            context: { ...(clientId ? { clientId } : {}), sessionId },
          }),
        });

        if (!resp.ok || !resp.body) {
          const errorData = await resp.json().catch(() => ({}));
          if (resp.status === 429) toast.error("Muitas mensagens! Aguarde um momento.");
          else if (resp.status === 402) toast.error("Serviço temporariamente indisponível.");
          else toast.error(errorData.error || "Erro ao enviar mensagem");
          throw new Error(errorData.error || "Failed");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") { streamDone = true; break; }

            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.metadata) {
                if (parsed.metadata.client_id) {
                  const newClientId = parsed.metadata.client_id;
                  latestClientId = newClientId;
                  setClientId(newClientId);
                  // Use client_name from metadata if available, otherwise fetch
                  if (parsed.metadata.client_name) {
                    setClientName(parsed.metadata.client_name.split(" ")[0]);
                  } else {
                    supabase.from("clients").select("name").eq("id", newClientId).maybeSingle().then(({ data: c }) => {
                      if (c?.name) setClientName(c.name.split(" ")[0]);
                    });
                  }
                  saveConversation(newMessages, newClientId);
                } else if (parsed.metadata.client_name) {
                  // Name updated without new client_id (e.g. update_lead with name)
                  setClientName(parsed.metadata.client_name.split(" ")[0]);
                }
                if (parsed.metadata.vehicles?.length) {
                  setPendingVehicles(parsed.metadata.vehicles);
                  pendingVehiclesRef.current = parsed.metadata.vehicles;
                }
                if (parsed.metadata.individual_photos?.length) {
                  setPendingPhotos(parsed.metadata.individual_photos);
                  pendingPhotosRef.current = parsed.metadata.individual_photos;
                }
                continue;
              }

              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.error("Chat error:", e);
        if (!assistantSoFar) {
          upsertAssistant("Ops, tive um probleminha aqui. Pode mandar de novo? 😅");
        }
      } finally {
        setTypingStatus(undefined);
        
        // Split the completed response into multiple bubbles for human-like delivery
        const fullText = assistantSoFar;
        const bubbles = splitIntoBubbles(fullText);
        
        if (bubbles.length > 1) {
          // Remove the streaming message and replace with individual bubbles
          setMessages(prev => prev.filter(m => m.id !== assistantId));
          
          for (let bi = 0; bi < bubbles.length; bi++) {
            if (bi > 0) {
              // Show typing indicator between bubbles
              setIsLoading(true);
              setTypingStatus(undefined);
              const delay = calculateBubbleDelay(bi, bubbles[bi]);
              await new Promise(r => setTimeout(r, delay));
            }
            
            const bubbleMsg: ChatMessage = {
              id: `${assistantId}-bubble-${bi}`,
              role: "assistant",
              content: bubbles[bi],
              timestamp: new Date(),
            };
            
            // Attach vehicles to the last bubble
            const vehiclesToAttach = pendingVehiclesRef.current;
            if (bi === bubbles.length - 1 && vehiclesToAttach && vehiclesToAttach.length > 0) {
              bubbleMsg.vehicles = vehiclesToAttach;
              setPendingVehicles(null);
              pendingVehiclesRef.current = null;
            }
            
            setMessages(prev => [...prev, bubbleMsg]);
            setIsLoading(false);
            scrollToBottom();
            
            if (bi < bubbles.length - 1) {
              playNotificationSound();
            }
          }
        }
        
        setIsLoading(false);
        inputRef.current?.focus();
        playNotificationSound();

        const vehiclesToAttach = pendingVehiclesRef.current;
        const photosToAttach = pendingPhotosRef.current;
        setMessages(prev => {
          let updated = [...prev];
          // Only attach vehicles if not already attached via multi-bubble
          if (vehiclesToAttach && vehiclesToAttach.length > 0) {
            updated = updated.map((m, i) =>
              i === updated.length - 1 && m.role === "assistant" ? { ...m, vehicles: vehiclesToAttach } : m
            );
            setPendingVehicles(null);
            pendingVehiclesRef.current = null;
          }
          if (photosToAttach && photosToAttach.length > 0) {
            const photoMessages: ChatMessage[] = photosToAttach.map((url, i) => ({
              id: `photo-${Date.now()}-${i}`,
              role: "assistant" as const,
              content: "",
              timestamp: new Date(),
              photos: [url],
            }));
            updated = [...updated, ...photoMessages];
            setPendingPhotos(null);
            pendingPhotosRef.current = null;
          }
          saveConversation(updated, latestClientId);
          return updated;
        });
      }
    },
    [messages, isLoading, isTransferred, clientId, scrollToBottom, saveConversation]
  );

  // Auto-send message from catalog param
  const vehicleParamSent = useRef(false);
  useEffect(() => {
    if (vehicleParamSent.current || isRestoringChat || isLoading) return;
    const vehicleName = searchParams.get("veiculo") || searchParams.get("moto");
    if (vehicleName && messages.length >= 1 && !messages.some(m => m.role === "user")) {
      vehicleParamSent.current = true;
      sendMessage(`Tenho interesse no ${vehicleName.trim()}`);
    }
  }, [isRestoringChat, isLoading, searchParams, messages, sendMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (text: string) => sendMessage(text);

  // Document photo handler
  const processDocumentFile = useCallback(async (file: File) => {
    setIsAnalyzingDoc(true);
    setUploadProgress("Enviando...");

    const thumbnailUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

    const userMsg: ChatMessage = {
      id: `user-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: `📷 Enviei: ${file.name}`,
      timestamp: new Date(),
      thumbnail: thumbnailUrl,
    };
    setMessages(prev => [...prev, userMsg]);
    setMessageCount(prev => prev + 1);
    scrollToBottom();

    try {
      setUploadProgress("Processando imagem...");
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadProgress("Analisando documento...");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ image_base64: base64, client_id: clientId }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao analisar documento");
      }

      const result = await resp.json();
      const docLabels: Record<string, string> = {
        cnh: "CNH (Carteira de Habilitação)",
        income_proof: "Comprovante de Renda",
        address_proof: "Comprovante de Residência",
        identity: "Documento de Identidade",
      };

      let responseContent = "";

      if (result.document_type === "not_document") {
        let pendingHint = "";
        if (clientId) {
          const { data: cl } = await supabase.from("clients").select("financing_docs").eq("id", clientId).maybeSingle();
          const docs = cl?.financing_docs as Record<string, boolean> | null;
          if (docs) {
            const pending: string[] = [];
            if (!docs.cnh) pending.push("📸 **CNH** (frente e verso) — ou RG + CPF se não tiver CNH");
            if (!docs.pay_stub) pending.push("💰 **Holerite/Contracheque** — foto do seu comprovante de renda");
            if (!docs.proof_of_residence) pending.push("🏠 **Comprovante de residência** — conta de luz, água ou telefone recente");
            if (pending.length > 0) pendingHint = "\n\nO que eu preciso agora:\n" + pending.join("\n");
          }
        }
        if (!pendingHint) {
          pendingHint = "\n\nO que eu preciso:\n📸 **CNH** (frente e verso)\n💰 **Holerite** (comprovante de renda)\n🏠 **Comprovante de residência** (conta de luz, água...)";
        }
        responseContent = `Eii, essa foto não é um documento que eu consigo analisar 😅\n\nTira uma foto bem nítida de um desses documentos e manda pra mim:${pendingHint}\n\n💡 **Dica:** tira a foto num lugar com boa luz, sem reflexo, e com o documento inteiro aparecendo!`;
      } else if (result.document_type === "other") {
        responseContent = `Recebi a foto, mas esse documento não é o que eu preciso pro financiamento 🤔\n\nPreciso de um desses:\n📸 **CNH** — sua carteira de motorista (frente e verso)\n💰 **Holerite** — seu contracheque ou comprovante de renda\n🏠 **Comprovante de residência** — conta de luz, água ou telefone\n\nManda a foto de um desses que eu analiso na hora! 📷`;
      } else {
        const label = docLabels[result.document_type] || "Documento";
        responseContent = `✅ **${label}** recebido e analisado!\n\n`;
        responseContent += `${result.summary || ""}\n\n`;

        if (result.extracted_data) {
          const ext = result.extracted_data;
          const details: string[] = [];
          if (ext.full_name) details.push(`👤 **Nome:** ${ext.full_name}`);
          if (ext.cpf) details.push(`🔢 **CPF:** ${ext.cpf}`);
          if (ext.cnh_number) details.push(`🪪 **CNH:** ${ext.cnh_number}`);
          if (ext.cnh_category) details.push(`📋 **Categoria:** ${ext.cnh_category}`);
          if (ext.cnh_expiry) details.push(`📅 **Validade:** ${ext.cnh_expiry}`);
          if (ext.employer) details.push(`🏢 **Empregador:** ${ext.employer}`);
          if (ext.employer_cnpj) details.push(`🔢 **CNPJ:** ${ext.employer_cnpj}`);
          if (ext.position) details.push(`💼 **Cargo:** ${ext.position}`);
          if (ext.salary) details.push(`💰 **Salário bruto:** R$ ${Number(ext.salary).toLocaleString("pt-BR")}`);
          if (ext.salary_net) details.push(`💵 **Salário líquido:** R$ ${Number(ext.salary_net).toLocaleString("pt-BR")}`);
          if (ext.employer_address) details.push(`📍 **End. empresa:** ${ext.employer_address}`);
          if (ext.employer_phone) details.push(`📞 **Tel. empresa:** ${ext.employer_phone}`);
          if (ext.admission_date) details.push(`📅 **Admissão:** ${ext.admission_date}`);
          if (ext.income_period) details.push(`📋 **Referência:** ${ext.income_period}`);
          if (ext.city) details.push(`📍 **Cidade:** ${ext.city}`);
          if (details.length > 0) responseContent += details.join("\n") + "\n\n";
        }

        if (result.issues?.length > 0) {
          responseContent += `⚠️ **Atenção:** ${result.issues.join(", ")}\n\n`;
        }

        if (result.document_type === "cnh") {
          responseContent += "Agora manda seu **comprovante de renda** (holerite ou contracheque) pra eu adiantar a análise de crédito! 📋";
        } else if (result.document_type === "income_proof") {
          responseContent += "Massa! Agora só falta o **comprovante de residência** e ficamos prontos! 🏠";

          if (result.extracted_data?.employer_cnpj && clientId) {
            try {
              const cleanCnpj = result.extracted_data.employer_cnpj.replace(/[^\d]/g, "");
              if (cleanCnpj.length === 14) {
                const verifyResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
                if (verifyResp.ok) {
                  const cnpjData = await verifyResp.json();
                  const isActive = cnpjData.descricao_situacao_cadastral === "ATIVA";
                  responseContent += `\n\n${isActive ? "✅" : "⚠️"} **Empresa ${isActive ? "verificada" : "com pendência"} na Receita Federal**`;
                  if (cnpjData.razao_social) responseContent += `\n🏛️ ${cnpjData.razao_social}`;
                  if (cnpjData.cnae_fiscal_descricao) responseContent += `\n🏭 ${cnpjData.cnae_fiscal_descricao}`;
                  if (cnpjData.descricao_situacao_cadastral) responseContent += `\n📊 Situação: ${cnpjData.descricao_situacao_cadastral}`;

                  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-employer`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                    },
                    body: JSON.stringify({ image_base64: "data:image/png;base64,iVBOR", client_id: clientId }),
                  }).catch(() => {});
                }
              }
            } catch (verifyErr) {
              console.error("Auto CNPJ verification error:", verifyErr);
            }
          }
        } else if (result.document_type === "address_proof") {
          responseContent += "Perfeito! Documentação ficando completa! 🎯";
        }

        if (clientId) {
          const { data: client } = await supabase.from("clients").select("financing_docs").eq("id", clientId).maybeSingle();
          const docs = client?.financing_docs as Record<string, boolean> | null;
          if (docs?.cnh && docs?.pay_stub && docs?.proof_of_residence) {
            responseContent += "\n\n🎉 **Documentação completa!** Vou encaminhar pra análise de crédito!";
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setMessages(prev => { saveConversation(prev); return prev; });
      playNotificationSound();
    } catch (err) {
      console.error("Document analysis error:", err);
      const errorMsg: ChatMessage = {
        id: `assistant-doc-err-${Date.now()}`,
        role: "assistant",
        content: "Ops, não consegui analisar esse documento agora. Tenta de novo com uma foto mais nítida! 📸",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      toast.error("Erro ao analisar documento");
    } finally {
      setIsAnalyzingDoc(false);
      setUploadProgress(null);
      scrollToBottom();
    }
  }, [clientId, scrollToBottom, saveConversation]);

  const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (isLoading || isTransferred) return;

    const fileList = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const validFiles = fileList.filter(file => {
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name);
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isImage && !isPdf) { toast.error(`"${file.name}" não é uma imagem ou PDF`); return false; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`"${file.name}" é muito grande (máx 10MB)`); return false; }
      return true;
    });
    if (!validFiles.length) return;

    for (const file of validFiles) {
      await processDocumentFile(file);
    }
  }, [isLoading, isTransferred, processDocumentFile]);

  // Audio recording
  const startRecording = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (SpeechRecognition) {
        stream.getTracks().forEach(t => t.stop());
        const recognition = new SpeechRecognition();
        recognition.lang = "pt-BR";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let finalTranscript = "";

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
          }
        };

        recognition.onend = () => {
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          setRecordingDuration(0);
          setIsRecording(false);
          const text = finalTranscript.trim();
          if (text) sendMessage(text);
          else toast.error("Não consegui entender o áudio. Tente novamente.");
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed") toast.error("Permita o acesso ao microfone para enviar áudios");
          else if (event.error !== "aborted") toast.error("Erro no reconhecimento de voz. Tente novamente.");
          setIsRecording(false);
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          setRecordingDuration(0);
        };

        mediaRecorderRef.current = recognition as any;
        recognition.start();
      } else {
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          setRecordingDuration(0);
          setIsRecording(false);

          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          if (blob.size < 1000) { toast.error("Áudio muito curto. Tente novamente."); return; }

          setIsTranscribing(true);
          try {
            const fileReader = new FileReader();
            const audioBase64 = await new Promise<string>((resolve, reject) => {
              fileReader.onload = () => resolve(fileReader.result as string);
              fileReader.onerror = reject;
              fileReader.readAsDataURL(blob);
            });

            const resp = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ audio_base64: audioBase64 }),
              }
            );

            if (!resp.ok) throw new Error("Transcription failed");
            const result = await resp.json();
            const text = result.text?.trim();
            if (text) sendMessage(text);
            else toast.error("Não consegui entender o áudio. Tente novamente.");
          } catch (err) {
            console.error("Transcription error:", err);
            toast.error("Erro ao transcrever áudio. Tente novamente.");
          } finally {
            setIsTranscribing(false);
          }
        };

        mediaRecorderRef.current = recorder as any;
        recorder.start();
      }

      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Permita o acesso ao microfone para enviar áudios");
    }
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try { (mediaRecorderRef.current as any).stop(); } catch {}
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try { (mediaRecorderRef.current as any).abort(); } catch {}
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const showTransferButton = messageCount >= 4 && !isTransferred;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative">
          <Avatar className="h-10 w-10 border-2 border-primary/40 glow-red">
            <AvatarImage src={consultantAvatar} alt="Consultor Arsenal" />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">L</AvatarFallback>
          </Avatar>
          {(() => {
            const status = getRealisticOnlineStatus();
            return <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${status.online ? "bg-emerald-500" : "bg-muted-foreground"}`} />;
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground text-sm">
            {isLoading && clientName
              ? `Lucas digitando...`
              : clientName
              ? `Lucas está atendendo ${clientName}`
              : "Lucas — Arsenal Motors"}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {(() => {
              const status = getRealisticOnlineStatus();
              return (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${status.online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                  {isLoading ? "digitando..." : status.lastSeen}
                </>
              );
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isRestoringChat && messages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewConversation}
              className="rounded-full h-8 w-8 text-muted-foreground hover:text-primary"
              title="Nova conversa"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          {showTransferButton && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTransfer}
                className="text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Falar com gerente
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {isRestoringChat ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando conversa...</p>
          </div>
        ) : (
          <>
            {conversationSaved && messages.length > 1 && messages[0]?.id?.startsWith("restored") && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-4">
                <div className="bg-secondary/80 text-muted-foreground text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-border/50">
                  <RotateCcw className="w-3 h-3" />
                  Conversa anterior restaurada
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
              {messages.map((msg, idx) => {
                const isRead = msg.role === "user" ? messages.slice(idx + 1).some(m => m.role === "assistant") : undefined;
                return (
                  <div key={msg.id}>
                    <ChatBubble msg={msg} isRead={isRead} />
                    {msg.vehicles && msg.vehicles.length > 0 && <VehicleCarousel vehicles={msg.vehicles} />}
                  </div>
                );
              })}
            </AnimatePresence>
          </>
        )}

        <AnimatePresence>{isLoading && <TypingIndicator statusText={typingStatus} flickering />}</AnimatePresence>

        <AnimatePresence>
          {isAnalyzingDoc && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-end gap-2.5 mb-4"
            >
              <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
                <AvatarImage src={consultantAvatar} alt="Consultor" />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
              </Avatar>
              <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{uploadProgress || "Analisando documento..."}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showSuggestions && messages.length === 1 && !isLoading && !isRestoringChat && (
          <SuggestionChips onSelect={handleSuggestion} />
        )}

        {isTransferred && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center my-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2 rounded-full flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              Gerente vai te atender em breve
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        {isTransferred ? (
          <div className="text-center text-sm text-muted-foreground py-2">
            O gerente já recebeu sua conversa e vai te responder em breve! 👊
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              className="hidden"
              onChange={handleDocumentUpload}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isLoading || isAnalyzingDoc || isRecording || isTranscribing}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full shrink-0 h-11 w-11 text-muted-foreground hover:text-primary transition-colors relative"
              title="Enviar documento (CNH, holerite, comprovante)"
            >
              {isAnalyzingDoc ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[8px] absolute -bottom-1 text-primary font-medium">Analisando</span>
                </div>
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>

            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-destructive/10 border border-destructive/30">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
                <span className="text-sm font-medium text-destructive flex-1">
                  Gravando... {formatDuration(recordingDuration)}
                </span>
                <button type="button" onClick={cancelRecording} className="text-xs text-muted-foreground hover:text-foreground transition px-2">
                  Cancelar
                </button>
              </div>
            ) : isTranscribing ? (
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary border border-border/50">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Transcrevendo áudio...</span>
              </div>
            ) : (
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={isAnalyzingDoc ? "Analisando documento..." : "Digite ou envie um áudio..."}
                  rows={1}
                  disabled={isLoading || isAnalyzingDoc}
                  className="w-full resize-none rounded-2xl bg-secondary border border-border/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 placeholder:text-muted-foreground"
                  style={{ maxHeight: "120px" }}
                />
              </div>
            )}

            {isRecording ? (
              <Button
                type="button"
                size="icon"
                onClick={stopRecording}
                className="rounded-full shrink-0 h-11 w-11 bg-destructive hover:bg-destructive/90 transition-all"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : inputValue.trim() ? (
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || isAnalyzingDoc || isTranscribing}
                className="rounded-full shrink-0 h-11 w-11 glow-red transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                disabled={isLoading || isAnalyzingDoc || isTranscribing}
                onClick={startRecording}
                className="rounded-full shrink-0 h-11 w-11 bg-primary/80 hover:bg-primary transition-all"
                title="Gravar áudio"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </form>
        )}
        <p className="text-[9px] text-muted-foreground text-center mt-2 opacity-50">
          Arsenal Motors
        </p>
      </div>

      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatFunnel;
