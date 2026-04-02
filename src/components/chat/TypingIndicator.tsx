import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import consultantAvatar from "@/assets/consultant-avatar.png";

interface TypingIndicatorProps {
  /** Optional text shown below dots, e.g. "Digitando..." */
  statusText?: string;
  /** Whether to simulate "stops and restarts" typing */
  flickering?: boolean;
}

const TypingIndicator = ({ statusText, flickering = true }: TypingIndicatorProps) => {
  const [visible, setVisible] = useState(true);

  // Simulate typing that stops and restarts (like a real person thinking)
  useEffect(() => {
    if (!flickering) return;
    
    const flicker = () => {
      // Pause for 400-800ms, then resume
      setVisible(false);
      const pauseTime = 400 + Math.random() * 400;
      setTimeout(() => setVisible(true), pauseTime);
    };

    // Random flicker every 2-4 seconds
    const interval = setInterval(() => {
      if (Math.random() < 0.4) flicker();
    }, 2000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [flickering]);

  return (
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
      <div className="glass-card px-4 py-3.5 rounded-2xl rounded-bl-sm">
        <motion.div 
          className="flex gap-1.5"
          animate={{ opacity: visible ? 1 : 0.3 }}
          transition={{ duration: 0.2 }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-muted-foreground"
              style={{
                animation: visible ? "typing-bounce 1.4s ease-in-out infinite" : "none",
                animationDelay: `${i * 0.2}s`,
                opacity: visible ? undefined : 0.3,
              }}
            />
          ))}
        </motion.div>
        {statusText && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-none">{statusText}</p>
        )}
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
