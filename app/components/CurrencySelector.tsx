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
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-[12px] border-2 border-black bg-white px-4 py-3 pr-10 text-[16px] font-medium text-black shadow-[4px_4px_0px_#000] transition-all focus:outline-none focus:shadow-[6px_6px_0px_#000]"
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
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
        <ChevronDown className="h-5 w-5 text-black" strokeWidth={2} />
      </div>
    </div>
  );
}
