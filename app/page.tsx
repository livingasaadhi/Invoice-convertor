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
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
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

      const blob = await res.blob();
      const fileName = `${uploadedFile.name?.replace(/\.pdf$/i, "") || "invoice"}-converted-${selectedCurrency}.pdf`;

      // Use the native File System Access API for a real "Save As" dialog
      if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: "PDF Document",
              accept: { "application/pdf": [".pdf"] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (pickerError: unknown) {
          if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
        }
      }

      // Legacy fallback
      const pdfBlob = new Blob([await blob.arrayBuffer()], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 10000);
    } catch {
      setError("Failed to download the converted invoice.");
    }
  }, [convertedAmount, selectedCurrency, uploadedFile, detectedAmount]);

  const canConvert = !!uploadedFile && !!selectedCurrency && convertedAmount === null;

  return (
    <div className="flex flex-col items-center justify-center bg-[#F8FAFC] px-4 py-6 lg:py-0 lg:h-screen text-black">
      <div className="w-full max-w-5xl lg:flex lg:flex-col lg:justify-center">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="mb-6 text-center"
        >
          <img
            src="/logo.png"
            alt="RupeeSwitch"
            className="h-10 sm:h-12 w-auto mx-auto"
          />
          <p className="mt-2 text-[16px] font-medium text-gray-500">
            Instantly swap currency symbols on your invoices.
          </p>
        </motion.header>

        {/* ── Main Card ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="rounded-[14px] border-2 border-black bg-white p-6 lg:p-8 shadow-[6px_6px_0px_#000]"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">

            {/* ── Left Column: Upload & Detection ── */}
            <div className="flex flex-col gap-6">
              <motion.div variants={itemVariants}>
                <h2 className="mb-3 text-[18px] font-bold text-black">
                  Upload invoice
                </h2>
                <UploadDropzone
                  onFileUpload={handleFileUpload}
                  onAmountDetected={(amount) => setDetectedAmount(amount)}
                  onError={(msg) => setError(msg)}
                  uploadedFile={uploadedFile}
                  onRemoveFile={handleRemoveFile}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="rounded-[14px] border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000]">
                  <AmountDisplay
                    label="Detected amount"
                    amount={detectedAmount}
                    currencySymbol="₹"
                    placeholder="Waiting for invoice upload"
                  />
                </div>
              </motion.div>
            </div>

            {/* ── Right Column: Conversion ── */}
            <div className="relative flex flex-col gap-6">
              {/* Desktop Divider */}
              <div className="absolute -left-5 top-0 bottom-0 hidden w-[2px] bg-black lg:block" />

              <motion.div variants={itemVariants}>
                <h2 className="mb-3 text-[18px] font-bold text-black">
                  Symbol settings
                </h2>
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
                    <div className="rounded-[12px] bg-red-100 px-4 py-3 text-[14px] font-bold text-red-700 border-2 border-black shadow-[3px_3px_0px_#000]">
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
                    className="flex flex-col gap-4"
                  >
                    {/* Success Result Card */}
                    <div className="rounded-[14px] border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000]">
                      <div className="mb-3 inline-flex items-center gap-1.5 rounded-[8px] bg-green-100 border-2 border-black px-3 py-1 text-[12px] font-bold text-green-700">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                        Update successful
                      </div>
                      <AmountDisplay
                        label="Updated amount"
                        amount={convertedAmount}
                        currencySymbol={convertedSymbol}
                        isResult
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                      <DownloadButton onClick={handleDownload} />
                      <button
                        onClick={handleRemoveFile}
                        className="w-full rounded-[12px] border-2 border-black bg-white px-6 py-3 text-[16px] font-bold text-black shadow-[4px_4px_0px_#000] transition-all duration-100 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000]"
                      >
                        Start over
                      </button>
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
          className="mt-4 text-center text-[12px] font-medium text-gray-400"
        >
          © 2026 RupeeSwitch
        </motion.p>
      </div>
    </div>
  );
}
