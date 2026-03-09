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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
          className="w-full cursor-pointer appearance-none rounded-xl border-[1.5px] border-gray-200 bg-white px-4 py-3.5 pr-10 text-sm font-medium text-gray-800 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-300"
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
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:text-indigo-500" />
        </div>
      </motion.div>
    </div>
  );
}
