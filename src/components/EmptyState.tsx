import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-float">
      <Icon className="w-7 h-7 text-primary" />
    </div>
    <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} className="mt-5 rounded-xl glow-red">
        {actionLabel}
      </Button>
    )}
  </motion.div>
);

export default EmptyState;
