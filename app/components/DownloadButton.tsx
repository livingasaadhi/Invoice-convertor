import { motion } from "framer-motion";
import { DownloadCloud } from "lucide-react";

interface DownloadButtonProps {
  onClick: () => void;
}

export default function DownloadButton({ onClick }: DownloadButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      className="w-full rounded-[12px] bg-[#4F46E5] px-6 py-4 text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#4338CA]"
    >
      <span className="flex items-center justify-center gap-2">
        <DownloadCloud className="h-5 w-5 text-white" strokeWidth={2} />
        Download converted invoice
      </span>
    </motion.button>
  );
}
