import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { MessageCircle, Phone, Trash2, Eye } from "lucide-react";

interface SwipeableLeadCardProps {
  children: React.ReactNode;
  onWhatsApp?: () => void;
  onCall?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  disabled?: boolean;
}

const THRESHOLD = 80;

const SwipeableLeadCard = ({
  children,
  onWhatsApp,
  onCall,
  onDelete,
  onView,
  disabled = false,
}: SwipeableLeadCardProps) => {
  const x = useMotionValue(0);
  const [swiped, setSwiped] = useState<"left" | "right" | null>(null);

  // Right swipe reveals WhatsApp/Call (positive x)
  const rightBg = useTransform(x, [0, THRESHOLD], [0, 1]);
  // Left swipe reveals Delete/View (negative x)
  const leftBg = useTransform(x, [-THRESHOLD, 0], [1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (disabled) return;
    const offset = info.offset.x;

    if (offset > THRESHOLD && onWhatsApp) {
      onWhatsApp();
    } else if (offset < -THRESHOLD && onView) {
      onView();
    }
    // Always snap back
    setSwiped(null);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Left action (revealed on right swipe) - mobile only */}
      <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-center bg-green-500/20 rounded-l-2xl md:hidden">
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="w-5 h-5 text-green-500" />
          <span className="text-[9px] text-green-500 font-medium">WhatsApp</span>
        </div>
      </div>

      {/* Right action (revealed on left swipe) - mobile only */}
      <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-primary/20 rounded-r-2xl md:hidden">
        <div className="flex flex-col items-center gap-0.5">
          <Eye className="w-5 h-5 text-primary" />
          <span className="text-[9px] text-primary font-medium">Ver ficha</span>
        </div>
      </div>

      {/* Swipeable content */}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-card md:!transform-none"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableLeadCard;
