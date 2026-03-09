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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
            className="flex items-baseline gap-1.5 pt-1"
          >
            <span
              className={`text-2xl font-bold ${
                isResult ? "text-emerald-500" : "text-indigo-500"
              }`}
            >
              {currencySymbol}
            </span>
            <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
              {formatAmount(amount, isResult ? 2 : 0)}
            </span>
          </motion.div>
        ) : (
          <motion.p
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-1 text-sm text-gray-400 italic"
          >
            {placeholder}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
