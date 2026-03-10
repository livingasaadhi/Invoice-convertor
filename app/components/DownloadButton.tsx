import { motion } from "framer-motion";
import { DownloadCloud } from "lucide-react";

interface DownloadButtonProps {
  onClick: () => void;
}

export default function DownloadButton({ onClick }: DownloadButtonProps) {
  return (
    <motion.button
      whileHover={{ y: 2, boxShadow: "4px 4px 0px #000" }}
      whileTap={{ y: 4, boxShadow: "2px 2px 0px #000" }}
      type="button"
      onClick={onClick}
      className="w-full rounded-[12px] bg-black px-6 py-4 text-[16px] font-bold text-white border-2 border-black shadow-[6px_6px_0px_#000] transition-all duration-100 ease-out"
      style={{ minHeight: 50 }}
    >
      <span className="flex items-center justify-center gap-2">
        <DownloadCloud className="h-5 w-5 text-white" strokeWidth={2} />
        Download updated invoice
      </span>
    </motion.button>
  );
}
