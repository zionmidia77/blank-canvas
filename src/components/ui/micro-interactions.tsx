import React, { useState, useCallback, useRef } from "react";
import { motion, useAnimation, type HTMLMotionProps } from "framer-motion";

// ── Ripple Effect ──────────────────────────────────────────────

interface RippleProps {
  x: number;
  y: number;
  size: number;
}

export const RippleButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    className?: string;
  }
>(({ children, className, onClick, ...props }, ref) => {
  const [ripples, setRipples] = useState<(RippleProps & { id: number })[]>([]);
  const counter = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const id = counter.current++;
      setRipples((prev) => [...prev, { x, y, size, id }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
      onClick?.(e);
    },
    [onClick]
  );

  return (
    <button ref={ref} className={`relative overflow-hidden ${className || ""}`} onClick={handleClick} {...props}>
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full bg-foreground/10 animate-[ripple_0.6s_ease-out] pointer-events-none"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
          }}
        />
      ))}
    </button>
  );
});
RippleButton.displayName = "RippleButton";

// ── Interactive Card (hover scale + press) ─────────────────────

interface InteractiveCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hoverScale?: number;
  tapScale?: number;
}

export const InteractiveCard = ({
  children,
  className,
  hoverScale = 1.015,
  tapScale = 0.98,
  ...props
}: InteractiveCardProps) => (
  <motion.div
    whileHover={{ scale: hoverScale, y: -2, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
    whileTap={{ scale: tapScale, y: 0, transition: { duration: 0.1 } }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);

// ── Success Flash (green border flash on save) ─────────────────

export const useSuccessFlash = () => {
  const controls = useAnimation();

  const flash = useCallback(async () => {
    await controls.start({
      boxShadow: [
        "0 0 0 0 hsl(142 71% 45% / 0)",
        "0 0 0 4px hsl(142 71% 45% / 0.4)",
        "0 0 20px 4px hsl(142 71% 45% / 0.2)",
        "0 0 0 0 hsl(142 71% 45% / 0)",
      ],
      transition: { duration: 0.8, ease: "easeOut" },
    });
  }, [controls]);

  return { controls, flash };
};

// ── Error Shake ────────────────────────────────────────────────

export const useErrorShake = () => {
  const controls = useAnimation();

  const shake = useCallback(async () => {
    await controls.start({
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.5, ease: "easeOut" },
    });
  }, [controls]);

  return { controls, shake };
};

// ── Feedback Wrapper (combines flash + shake) ──────────────────

export const useFeedback = () => {
  const { controls: successControls, flash } = useSuccessFlash();
  const { controls: shakeControls, shake } = useErrorShake();

  const FeedbackContainer = useCallback(
    ({ children, className, ...props }: { children: React.ReactNode; className?: string }) => (
      <motion.div animate={successControls} className={className} {...props}>
        <motion.div animate={shakeControls}>
          {children}
        </motion.div>
      </motion.div>
    ),
    [successControls, shakeControls]
  );

  return { FeedbackContainer, flash, shake };
};

// ── CSS class helpers for non-Framer contexts ──────────────────

export const triggerSuccessFlash = (element: HTMLElement | null) => {
  if (!element) return;
  element.classList.remove("flash-success");
  void element.offsetWidth; // force reflow
  element.classList.add("flash-success");
  setTimeout(() => element.classList.remove("flash-success"), 800);
};

export const triggerErrorShake = (element: HTMLElement | null) => {
  if (!element) return;
  element.classList.remove("flash-error");
  void element.offsetWidth;
  element.classList.add("flash-error");
  setTimeout(() => element.classList.remove("flash-error"), 500);
};

// ── Press Animation Button ─────────────────────────────────────

interface MotionButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
}

export const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ children, className, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  )
);
MotionButton.displayName = "MotionButton";
