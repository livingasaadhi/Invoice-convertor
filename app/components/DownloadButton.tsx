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
      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_auto] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-[background-position,box-shadow] duration-500 hover:bg-[position:right_center] hover:shadow-indigo-500/40"
    >
      <span className="relative flex items-center justify-center gap-2">
        <motion.div
          animate={{ y: [0, 2, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <DownloadCloud className="h-5 w-5 text-white/90" />
        </motion.div>
        Download Converted Invoice
      </span>
    </motion.button>
  );
}
