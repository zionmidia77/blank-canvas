import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  icon: React.ElementType;
  position: "bottom" | "top" | "left" | "right";
}

interface PageTourProps {
  tourKey: string;
  steps: TourStep[];
  delay?: number;
}

const PageTour = ({ tourKey, steps, delay = 800 }: PageTourProps) => {
  const storageKey = `arsenal-tour-${tourKey}`;
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const done = localStorage.getItem(storageKey);
    if (!done && steps.length > 0) {
      const timer = setTimeout(() => setActive(true), delay);
      return () => clearTimeout(timer);
    }
  }, [storageKey, steps.length, delay]);

  const updateTargetRect = useCallback(() => {
    if (!active || !steps[step]) return;
    const el = document.querySelector(steps[step].target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [active, step, steps]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [updateTargetRect]);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(storageKey, "true");
  }, [storageKey]);

  const next = useCallback(() => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else finish();
  }, [step, steps.length, finish]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, next, prev, finish]);

  if (!active || !steps[step]) return null;

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const padding = 8;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const pos = currentStep.position;
    const style: React.CSSProperties = { position: "fixed" };

    if (pos === "bottom") {
      style.top = targetRect.bottom + 12;
      style.left = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 160, window.innerWidth - 336));
    } else if (pos === "top") {
      style.bottom = window.innerHeight - targetRect.top + 12;
      style.left = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 160, window.innerWidth - 336));
    } else if (pos === "right") {
      style.top = Math.max(16, targetRect.top + targetRect.height / 2 - 80);
      style.left = targetRect.right + 12;
    } else {
      style.top = Math.max(16, targetRect.top + targetRect.height / 2 - 80);
      style.right = window.innerWidth - targetRect.left + 12;
    }
    return style;
  };

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999]"
          style={{ pointerEvents: "auto" }}
        >
          <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id={`tour-mask-${tourKey}`}>
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <rect
                    x={targetRect.left - padding}
                    y={targetRect.top - padding}
                    width={targetRect.width + padding * 2}
                    height={targetRect.height + padding * 2}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0" y="0" width="100%" height="100%"
              fill="hsl(var(--background) / 0.8)"
              mask={`url(#tour-mask-${tourKey})`}
              style={{ pointerEvents: "auto" }}
              onClick={finish}
            />
          </svg>

          {targetRect && (
            <motion.div
              layoutId={`tour-highlight-${tourKey}`}
              className="fixed rounded-xl border-2 border-primary shadow-[0_0_24px_hsl(var(--primary)/0.3)]"
              style={{
                top: targetRect.top - padding,
                left: targetRect.left - padding,
                width: targetRect.width + padding * 2,
                height: targetRect.height + padding * 2,
                pointerEvents: "none",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}

          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed w-[320px] bg-card border border-border/50 rounded-2xl shadow-xl p-5 z-[10000]"
            style={getTooltipStyle()}
          >
            <button
              onClick={finish}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {step + 1} de {steps.length}
              </span>
            </div>

            <h3 className="font-display font-bold text-sm mb-1">{currentStep.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{currentStep.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-2 text-xs">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" onClick={next} className="h-8 px-3 text-xs gap-1">
                  {step === steps.length - 1 ? "Concluir" : "Próximo"}
                  {step < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {step < steps.length - 1 && (
              <button onClick={finish} className="w-full mt-3 text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center">
                Pular tour
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default PageTour;
