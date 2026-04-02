export const WELCOME_MESSAGE =
  "E aí! Tudo bem? 👊\n\nAqui é o Lucas da Arsenal Motors. Tô aqui pra te ajudar, seja pra comprar, trocar ou o que precisar!\n\nMe conta, o que tá procurando?";

export const CHAT_STORAGE_KEY = "arsenal-chat-session-id";

export const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

// Rate limiting: min 1.5s between messages
export const MIN_MESSAGE_INTERVAL_MS = 1500;

// Human-like delay config
export const HUMAN_DELAY_MIN_MS = 1000;
export const HUMAN_DELAY_MAX_MS = 3500;

// Max bubbles per response
export const MAX_BUBBLES = 5;
