/**
 * Human-like behavior utilities for chat
 * Makes the AI chat feel like a real person on WhatsApp
 */

// Split a long message into multiple bubbles like a human would
export function splitIntoBubbles(text: string): string[] {
  // Don't split very short messages
  if (text.length < 100) return [text];

  // Split on double newlines first (paragraphs)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  if (paragraphs.length >= 2) {
    // Group small paragraphs together, keep large ones separate
    const bubbles: string[] = [];
    let current = "";
    
    for (const p of paragraphs) {
      // If paragraph has a table or checklist, keep it as its own bubble
      if (p.includes("|") || p.includes("✅") || p.includes("⬜") || p.includes("▓")) {
        if (current.trim()) {
          bubbles.push(current.trim());
          current = "";
        }
        bubbles.push(p.trim());
        continue;
      }
      
      // If adding this paragraph would make current > 200 chars, start new bubble
      if (current && (current.length + p.length > 200)) {
        bubbles.push(current.trim());
        current = p;
      } else {
        current = current ? current + "\n\n" + p : p;
      }
    }
    if (current.trim()) bubbles.push(current.trim());
    
    // Cap at 5 bubbles max
    if (bubbles.length > 5) {
      const merged: string[] = [];
      for (let i = 0; i < bubbles.length; i++) {
        if (i < 4) merged.push(bubbles[i]);
        else {
          merged[3] = (merged[3] || "") + "\n\n" + bubbles[i];
        }
      }
      return merged;
    }
    
    return bubbles.length > 1 ? bubbles : [text];
  }
  
  // Single paragraph but long — split on sentences
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  if (sentences.length <= 2) return [text];
  
  const bubbles: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && (current.length + s.length > 150)) {
      bubbles.push(current.trim());
      current = s;
    } else {
      current = current ? current + " " + s : s;
    }
  }
  if (current.trim()) bubbles.push(current.trim());
  
  return bubbles.length > 1 ? bubbles.slice(0, 4) : [text];
}

// Calculate human-like delay based on content
export function calculateTypingDelay(text: string, isFirst: boolean): number {
  const baseDelay = isFirst ? 1200 + Math.random() * 2000 : 600 + Math.random() * 1200;
  
  // Longer text = more typing time
  const charFactor = Math.min(text.length / 100, 2) * 500;
  
  // Add randomness to avoid being predictable
  const jitter = (Math.random() - 0.5) * 600;
  
  return Math.max(800, Math.min(baseDelay + charFactor + jitter, 4000));
}

// Calculate delay between multiple bubbles
export function calculateBubbleDelay(bubbleIndex: number, text: string): number {
  // First bubble has initial thinking delay, subsequent ones are faster
  if (bubbleIndex === 0) return 0; // handled by initial delay
  
  // 0.8-2s between bubbles, proportional to content
  const base = 800 + Math.random() * 800;
  const contentFactor = Math.min(text.length / 80, 1) * 400;
  return base + contentFactor;
}

// Realistic "last seen" based on business hours
export function getRealisticOnlineStatus(): { online: boolean; lastSeen: string } {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday
  
  // Business hours: Mon-Sat 8h-18h
  const isBusinessDay = day >= 1 && day <= 6;
  const isBusinessHours = hour >= 8 && hour < 18;
  
  if (isBusinessDay && isBusinessHours) {
    return { online: true, lastSeen: "online agora" };
  }
  
  // Outside business hours — show realistic last seen
  if (hour >= 18 && hour < 22) {
    return { online: false, lastSeen: "visto por último hoje às 18:00" };
  }
  
  if (hour >= 22 || hour < 8) {
    const yesterday = hour < 8;
    if (yesterday && day === 1) {
      return { online: false, lastSeen: "visto por último sábado às 18:00" };
    }
    return { online: false, lastSeen: `visto por último ${yesterday ? "ontem" : "hoje"} às 18:00` };
  }
  
  // Sunday
  if (day === 0) {
    return { online: false, lastSeen: "visto por último sábado às 18:00" };
  }
  
  return { online: true, lastSeen: "online agora" };
}

// "Thinking aloud" phrases to prepend occasionally
const THINKING_PHRASES = [
  "Hmm, deixa eu ver aqui...",
  "Peraí que vou verificar...",
  "Boa pergunta! Deixa eu checar...",
  "Vou dar uma olhada aqui...",
  "Deixa eu consultar aqui rapidão...",
  "Um momento, vou ver isso pra vc...",
];

export function getThinkingPhrase(): string {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
}

// Should we show a "thinking" bubble before the real response?
export function shouldShowThinking(messageCount: number, isSearching: boolean): boolean {
  if (isSearching) return true; // Always think when searching
  if (messageCount < 2) return false; // Don't think on first messages
  return Math.random() < 0.25; // 25% chance on regular messages
}
