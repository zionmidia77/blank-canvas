import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import consultantAvatar from "@/assets/consultant-avatar.png";
import ReadReceipt from "./ReadReceipt";
import type { ChatMessage } from "./types";

interface ChatBubbleProps {
  msg: ChatMessage;
  isRead?: boolean;
}

const ChatBubble = ({ msg, isRead }: ChatBubbleProps) => {
  const isUser = msg.role === "user";
  const isPhotoOnly = !isUser && msg.photos && msg.photos.length > 0 && !msg.content;
  const isDocUpload = isUser && msg.content.startsWith("📷");
  const time = msg.timestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Photo-only message (individual photo sent by AI)
  if (isPhotoOnly) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex mb-3 items-end gap-2.5"
      >
        <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
          <AvatarImage src={consultantAvatar} alt="Consultor" />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
        </Avatar>
        <div className="max-w-[82%] rounded-2xl rounded-bl-sm overflow-hidden border border-border/40">
          <img
            src={msg.photos![0]}
            alt="Foto do veículo"
            className="w-full max-w-[300px] h-auto rounded-2xl rounded-bl-sm object-cover"
            loading="lazy"
          />
          <p className="text-[10px] text-muted-foreground px-3 py-1 bg-card/80">{time}</p>
        </div>
      </motion.div>
    );
  }

  // Document upload with thumbnail preview
  if (isDocUpload && msg.thumbnail) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex mb-3 justify-end"
      >
        <div className="max-w-[82%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm overflow-hidden">
          <img
            src={msg.thumbnail}
            alt="Documento enviado"
            className="w-full max-w-[250px] h-auto max-h-[200px] object-cover"
          />
          <div className="px-4 py-2">
            <p className="text-sm leading-relaxed">{msg.content}</p>
            <p className="text-[10px] text-primary-foreground/50 text-right mt-1 flex items-center justify-end gap-0.5">
              {time}
              {isRead !== undefined && <ReadReceipt read={!!isRead} />}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex mb-3 ${isUser ? "justify-end" : "items-end gap-2.5"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
          <AvatarImage src={consultantAvatar} alt="Consultor" />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[82%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5"
            : "glass-card px-4 py-3 rounded-2xl rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => {
                  const isWhatsApp = href?.includes("wa.me");
                  if (isWhatsApp) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline inline-flex items-center gap-2 mt-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.56 4.1 1.53 5.82L0 24l6.34-1.66A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.92 0-3.75-.52-5.35-1.46l-.38-.23-3.97 1.04 1.06-3.87-.25-.4A9.8 9.8 0 012.18 12c0-5.42 4.4-9.82 9.82-9.82S21.82 6.58 21.82 12 17.42 21.82 12 21.82z"/></svg>
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {children}
                    </a>
                  );
                },
              }}
            >{msg.content}</ReactMarkdown>
          </div>
        )}
        <p
          className={`text-[10px] mt-1 flex items-center ${
            isUser ? "text-primary-foreground/50 justify-end gap-0.5" : "text-muted-foreground"
          }`}
        >
          {time}
          {isUser && isRead !== undefined && <ReadReceipt read={!!isRead} />}
        </p>
      </div>
    </motion.div>
  );
};

export default ChatBubble;
