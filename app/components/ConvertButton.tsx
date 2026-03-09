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
        w-full rounded-[12px] px-6 py-4 text-[16px] font-medium text-white
        transition-colors duration-200 ease-in-out
        ${
          disabled || isLoading
            ? "cursor-not-allowed bg-indigo-300"
            : "bg-[#4F46E5] hover:bg-[#4338CA]"
        }
      `}
    >
      <span className="flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="h-5 w-5 text-white" strokeWidth={2} />
            </motion.div>
            Converting…
          </>
        ) : (
          <>
            Convert invoice
          </>
        )}
      </span>
    </motion.button>
  );
}
