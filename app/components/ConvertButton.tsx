import { motion } from "framer-motion";
import { Loader2, ArrowRightLeft } from "lucide-react";

interface ConvertButtonProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export default function ConvertButton({
  disabled,
  isLoading,
  onClick,
}: ConvertButtonProps) {
  return (
    <motion.button
      whileHover={disabled || isLoading ? {} : { scale: 1.01 }}
      whileTap={disabled || isLoading ? {} : { scale: 0.98 }}
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`
        group relative w-full overflow-hidden rounded-xl px-6 py-4 text-sm font-semibold text-white shadow-lg
        transition-colors duration-300 ease-out
        ${
          disabled || isLoading
            ? "cursor-not-allowed bg-indigo-300 shadow-none"
            : "bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-500 hover:shadow-indigo-500/40"
        }
      `}
    >
      {/* Shimmer effect on hover */}
      {!disabled && !isLoading && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}

      <span className="relative flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="h-5 w-5 text-white/90" />
            </motion.div>
            Converting…
          </>
        ) : (
          <>
            <ArrowRightLeft className="h-5 w-5 text-white/90" />
            Convert Invoice
          </>
        )}
      </span>
    </motion.button>
  );
}
