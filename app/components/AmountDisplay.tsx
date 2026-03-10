import { motion, AnimatePresence } from "framer-motion";

interface AmountDisplayProps {
  amount: number | null;
  currencySymbol?: string;
  label: string;
  isResult?: boolean;
  placeholder?: string;
}

function formatAmount(num: number, decimals: number = 0): string {
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function AmountDisplay({
  amount,
  currencySymbol = "₹",
  label,
  isResult = false,
  placeholder = "Waiting for invoice upload",
}: AmountDisplayProps) {
  return (
    <div>
      <h2 className="mb-2 text-[14px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </h2>
      <AnimatePresence mode="popLayout">
        {amount !== null ? (
          <motion.div
            key="amount"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex items-baseline gap-2 pt-1"
          >
            <span
              className={`text-[28px] font-bold ${isResult ? "text-[#22C55E]" : "text-black"
                }`}
            >
              {currencySymbol}
            </span>
            <span
              className={`text-[40px] font-bold tracking-tight tabular-nums ${isResult ? "text-[#22C55E]" : "text-black"
                }`}
            >
              {formatAmount(amount, isResult ? 2 : 0)}
            </span>
          </motion.div>
        ) : (
          <motion.p
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-2 text-[16px] text-gray-400"
          >
            {placeholder}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
