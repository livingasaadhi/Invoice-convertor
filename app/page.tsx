"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

import UploadDropzone from "./components/UploadDropzone";
import AmountDisplay from "./components/AmountDisplay";
import CurrencySelector from "./components/CurrencySelector";
import ConvertButton from "./components/ConvertButton";
import DownloadButton from "./components/DownloadButton";

// Supported currencies for symbol swapping
const currencies: Record<string, { symbol: string }> = {
  USD: { symbol: "$" },
  EUR: { symbol: "€" },
  GBP: { symbol: "£" },
  AED: { symbol: "د.إ" },
  SGD: { symbol: "S$" },
  AUD: { symbol: "A$" },
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

    const meta = currencies[selectedCurrency];
    if (!meta) {
      setError("Unsupported currency selected.");
      setIsConverting(false);
      return;
    }

    setConvertedSymbol(meta.symbol);
    setConvertedAmount(detectedAmount);
    setIsConverting(false);
  }, [detectedAmount, selectedCurrency]);

  const handleDownload = useCallback(async () => {
    if (!convertedAmount || !selectedCurrency || !uploadedFile || !detectedAmount) return;

    const meta = currencies[selectedCurrency];
    if (!meta) return;

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("toCurrency", selectedCurrency);

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

      let fileName = `${uploadedFile.name?.replace(/\.pdf$/i, "") || "invoice"}-updated-${selectedCurrency}.pdf`;
      const disposition = res.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const matches = /filename="?([^"]+)"?/.exec(disposition);
        if (matches != null && matches[1]) {
          fileName = matches[1];
        }
      }

      if (!fileName.toLowerCase().endsWith('.pdf')) {
        fileName += '.pdf';
      }

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.setAttribute("download", fileName);
      a.type = "application/pdf";
      document.body.appendChild(a);
      a.click();

      // Delay cleanup to ensure the browser successfully processes the download
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5000);
    } catch {
      setError("Failed to download the converted invoice.");
    }
  }, [convertedAmount, selectedCurrency, uploadedFile, detectedAmount]);

  const canConvert = !!uploadedFile && !!selectedCurrency;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#F8FAFC] px-4 py-8">
      <div className="w-full max-w-5xl">
        {/* ── Header / Logo ── */}
        <motion.header
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="mb-8 text-center flex flex-col items-center"
        >
          {/* Logo */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E5E7EB]">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute -ml-2 -mt-1"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute bottom-2 right-2 bg-white rounded-full"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            </div>
          </div>
          <h1 className="text-[28px] sm:text-[36px] font-bold text-[#111827] leading-tight mb-3">
            Change currency symbols on your invoices instantly.
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[#6B7280] max-w-lg mx-auto">
            Upload a PDF invoice, choose a new currency symbol, and download the updated version in seconds.
          </p>
        </motion.header>

        {/* ── Main Layout (Two Column) ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="rounded-[16px] border border-[#E5E7EB] bg-[#FFFFFF] p-6 sm:p-8 lg:p-10 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">

            {/* ── Left Column: Input Phase ── */}
            <div className="flex flex-col space-y-8">
              <motion.div variants={itemVariants}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4F46E5]/10 text-[12px] font-bold text-[#4F46E5]">1</span>
                  <h2 className="text-[16px] font-semibold text-[#111827]">Upload invoice</h2>
                </div>
                <UploadDropzone
                  onFileUpload={handleFileUpload}
                  onAmountDetected={(amount) => setDetectedAmount(amount)}
                  onError={(msg) => setError(msg)}
                  uploadedFile={uploadedFile}
                  onRemoveFile={handleRemoveFile}
                />
              </motion.div>

              <motion.hr variants={itemVariants} className="border-[#E5E7EB]" />

              <motion.div variants={itemVariants}>
                <AmountDisplay
                  label="Detected amount"
                  amount={detectedAmount}
                  currencySymbol="₹"
                  placeholder="Waiting for invoice upload"
                />
              </motion.div>
            </div>

            {/* ── Right Column: Conversion Phase ── */}
            <div className="relative flex flex-col space-y-8 lg:min-h-[400px]">
              {/* Desktop Divider line */}
              <div className="absolute -left-8 top-0 bottom-0 hidden w-px bg-[#E5E7EB] lg:block" />

              <motion.div variants={itemVariants}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4F46E5]/10 text-[12px] font-bold text-[#4F46E5]">2</span>
                  <h2 className="text-[16px] font-semibold text-[#111827]">Symbol settings</h2>
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
                    <div className="rounded-[12px] bg-red-50 px-4 py-3 text-[14px] text-red-600 ring-1 ring-red-500/10">
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
                    <hr className="mb-6 border-[#E5E7EB]" />
                    <div className="mb-6 flex-1 rounded-[16px] bg-[#F8FAFC] p-6 ring-1 ring-[#E5E7EB]">
                      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-3 py-1 text-[12px] font-medium text-[#10B981]">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        Update successful
                      </div>
                      <AmountDisplay
                        label="Updated amount"
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
          className="mt-6 text-center text-[12px] text-[#6B7280]"
        >
          © 2026 RupeeSwitch
        </motion.p>
      </div>
    </div>
  );
}
