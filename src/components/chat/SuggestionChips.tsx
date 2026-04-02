import { motion } from "framer-motion";

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

const suggestions = [
  "Quero comprar um veículo",
  "Quero trocar meu veículo",
  "Quero vender meu veículo",
  "Preciso de dinheiro",
];

const SuggestionChips = ({ onSelect }: SuggestionChipsProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5 }}
    className="flex flex-wrap gap-2 px-4 pb-3 pl-12"
  >
    {suggestions.map((s, i) => (
      <motion.button
        key={s}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6 + i * 0.08 }}
        onClick={() => onSelect(s)}
        className="text-xs px-3.5 py-2 rounded-full border border-primary/30 text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
      >
        {s}
      </motion.button>
    ))}
  </motion.div>
);

export default SuggestionChips;
