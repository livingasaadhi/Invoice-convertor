import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

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
      whileHover={disabled || isLoading ? {} : { y: 2, boxShadow: "4px 4px 0px #000" }}
      whileTap={disabled || isLoading ? {} : { y: 4, boxShadow: "2px 2px 0px #000" }}
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`
        w-full rounded-[12px] px-6 py-4 text-[16px] font-bold
        transition-all duration-100 ease-out border-2 border-black
        ${disabled || isLoading
          ? "cursor-not-allowed bg-gray-200 text-gray-400 border-gray-300 shadow-none"
          : "bg-black text-white shadow-[6px_6px_0px_#000]"
        }
      `}
      style={{ minHeight: 50 }}
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
          <>Convert invoice</>
        )}
      </span>
    </motion.button>
  );
}
