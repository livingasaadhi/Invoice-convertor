"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

import UploadDropzone from "./components/UploadDropzone";
import AmountDisplay from "./components/AmountDisplay";
import CurrencySelector from "./components/CurrencySelector";
import ConvertButton from "./components/ConvertButton";
import DownloadButton from "./components/DownloadButton";

// Demo exchange rates (INR → target)
const exchangeRates: Record<string, { symbol: string; rate: number }> = {
  USD: { symbol: "$", rate: 0.01207 },
  EUR: { symbol: "€", rate: 0.01108 },
  GBP: { symbol: "£", rate: 0.00953 },
  AED: { symbol: "د.إ", rate: 0.04433 },
  SGD: { symbol: "S$", rate: 0.01613 },
  AUD: { symbol: "A$", rate: 0.01845 },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [convertedSymbol, setConvertedSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((file: File) => {
    setUploadedFile(file);
    setError(null);
    setConvertedAmount(null);
    setConvertedSymbol("");
    setDetectedAmount(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    setDetectedAmount(null);
    setConvertedAmount(null);
    setConvertedSymbol("");
    setError(null);
  }, []);

  const handleConvert = useCallback(async () => {
    if (!detectedAmount || !selectedCurrency) return;

    setIsConverting(true);
    setConvertedAmount(null);
    setError(null);

    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));

    const meta = exchangeRates[selectedCurrency];
    if (!meta) {
      setError("Unsupported currency selected.");
      setIsConverting(false);
      return;
    }

    setConvertedSymbol(meta.symbol);
    setConvertedAmount(detectedAmount * meta.rate);
    setIsConverting(false);
  }, [detectedAmount, selectedCurrency]);

  const handleDownload = useCallback(async () => {
    if (!convertedAmount || !selectedCurrency || !uploadedFile || !detectedAmount) return;

    const meta = exchangeRates[selectedCurrency];
    if (!meta) return;

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("toCurrency", selectedCurrency);
      formData.append("exchangeRate", String(meta.rate));

      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("Failed to generate the converted PDF.");
        return;
      }

      // Trigger browser download as PDF
      const data = await res.arrayBuffer();
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const fileName =
        (uploadedFile.name?.replace(/\.pdf$/i, "") || "invoice") +
        `-converted-${selectedCurrency}.pdf`;

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = fileName;
      a.type = "application/pdf";
      document.body.appendChild(a);
      a.click();

      // Delay cleanup so the browser has time to start the download
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch {
      setError("Failed to download the converted invoice.");
    }
  }, [convertedAmount, selectedCurrency, uploadedFile, detectedAmount]);

  const canConvert = !!uploadedFile && !!selectedCurrency;

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#fafafa] px-4 py-8 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-5xl">
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-xl shadow-indigo-500/20 ring-1 ring-white/50">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Invoice Currency Converter
          </h1>
          <p className="mt-2 text-sm md:text-base font-medium text-gray-500">
            Upload an INR invoice and convert it seamlessly to another currency.
          </p>
        </motion.header>

        {/* ── Main Layout ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="rounded-[24px] border border-gray-100 bg-white/70 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-xl sm:p-8 lg:p-10 ring-1 ring-gray-900/5"
        >
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            
            {/* ── Left Column: Input Phase ── */}
            <div className="flex flex-col space-y-8">
              <motion.div variants={itemVariants}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">1</span>
                  <h2 className="text-lg font-semibold text-gray-900">Upload Invoice</h2>
                </div>
                <UploadDropzone
                  onFileUpload={handleFileUpload}
                  onAmountDetected={(amount) => setDetectedAmount(amount)}
                  onError={(msg) => setError(msg)}
                  uploadedFile={uploadedFile}
                  onRemoveFile={handleRemoveFile}
                />
              </motion.div>

              <motion.hr variants={itemVariants} className="border-gray-100" />

              <motion.div variants={itemVariants}>
                <AmountDisplay
                  label="Detected Amount"
                  amount={detectedAmount}
                  currencySymbol="₹"
                  placeholder="Waiting for invoice upload"
                />
              </motion.div>
            </div>

            {/* ── Right Column: Conversion Phase ── */}
            <div className="relative flex flex-col space-y-8">
              {/* Desktop Divider line */}
              <div className="absolute -left-8 top-0 bottom-0 hidden w-px bg-gray-100 lg:block" />

              <motion.div variants={itemVariants}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">2</span>
                  <h2 className="text-lg font-semibold text-gray-900">Convert Settings</h2>
                </div>
                <CurrencySelector
                  value={selectedCurrency}
                  onChange={(v) => {
                    setSelectedCurrency(v);
                    setConvertedAmount(null);
                    setConvertedSymbol("");
                  }}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <ConvertButton
                  disabled={!canConvert}
                  isLoading={isConverting}
                  onClick={handleConvert}
                />
              </motion.div>

              <AnimatePresence mode="popLayout">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: "auto", scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <div className="rounded-xl bg-red-50 px-4 py-3.5 mt-2 text-sm font-medium text-red-600 ring-1 ring-red-500/10">
                      {error}
                    </div>
                  </motion.div>
                )}

                {convertedAmount !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="flex flex-col flex-1"
                  >
                    <hr className="mb-6 border-gray-100" />
                    <div className="mb-6 flex-1 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 shadow-sm ring-1 ring-emerald-500/20">
                      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-bold tracking-wide text-emerald-800 backdrop-blur-sm ring-1 ring-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                        Conversion Successful
                      </div>
                      <AmountDisplay
                        label="Converted Amount"
                        amount={convertedAmount}
                        currencySymbol={convertedSymbol}
                        isResult
                      />
                    </div>

                    <div className="mt-auto">
                      <DownloadButton onClick={handleDownload} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center text-xs font-medium text-gray-400"
        >
          © 2026 Invoice Currency Converter
        </motion.p>
      </div>
    </div>
  );
}
