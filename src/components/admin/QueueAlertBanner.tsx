import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useOverdueLeads } from "@/hooks/useOverdueLeads";

const BANNER_DISMISSED_KEY = "queue-alert-dismissed";

const QueueAlertBanner = () => {
  const navigate = useNavigate();
  const overdueCount = useOverdueLeads();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state on new session (page load)
  useEffect(() => {
    const lastDismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
    if (lastDismissed) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString());
  };

  if (dismissed || overdueCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 md:mx-5 mt-4 bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">
            {overdueCount} {overdueCount === 1 ? "lead com ação atrasada" : "leads com ações atrasadas"}!
          </p>
          <p className="text-xs text-muted-foreground">
            Acesse a Fila Inteligente para atender agora.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1 rounded-full"
          onClick={() => navigate("/admin/queue")}
        >
          <Zap className="w-3.5 h-3.5" />
          Ir para fila
        </Button>
        <button onClick={handleDismiss} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default QueueAlertBanner;
