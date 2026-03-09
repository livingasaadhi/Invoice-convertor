import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface CurrencySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const currencies = [
  { code: "USD", label: "USD — US Dollar", flag: "🇺🇸" },
  { code: "EUR", label: "EUR — Euro", flag: "🇪🇺" },
  { code: "GBP", label: "GBP — British Pound", flag: "🇬🇧" },
  { code: "AED", label: "AED — UAE Dirham", flag: "🇦🇪" },
  { code: "SGD", label: "SGD — Singapore Dollar", flag: "🇸🇬" },
  { code: "AUD", label: "AUD — Australian Dollar", flag: "🇦🇺" },
];

export default function CurrencySelector({
  value,
  onChange,
}: CurrencySelectorProps) {
  return (
    <div>
      <h2 className="mb-2 text-[14px] font-medium text-[#6B7280]">
        Convert To
      </h2>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative"
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-[12px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3 pr-10 text-[16px] text-[#111827] transition-all hover:border-[#D1D5DB] focus:border-[#4F46E5] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
        >
          <option value="" disabled>
            Select a currency
          </option>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.label}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
          <ChevronDown className="h-5 w-5 text-[#9CA3AF]" strokeWidth={1.5} />
        </div>
      </motion.div>
    </div>
  );
}
