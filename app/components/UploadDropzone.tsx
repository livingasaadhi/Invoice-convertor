"use client";

import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, X, Loader2 } from "lucide-react";

interface UploadDropzoneProps {
  onFileUpload: (file: File) => void;
  onAmountDetected: (amount: number) => void;
  onError: (message: string) => void;
  uploadedFile: File | null;
  onRemoveFile: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadDropzone({
  onFileUpload,
  onAmountDetected,
  onError,
  uploadedFile,
  onRemoveFile,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.amount) {
        onAmountDetected(data.amount);
      } else {
        onError("No INR amount found in the invoice.");
      }
    } catch {
      onError("Failed to connect to the server.");
    } finally {
      setIsUploading(false);
    }
  }

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        onError("Please upload a PDF file.");
        return;
      }
      onFileUpload(file);
      handleUpload(file);
    },
    [onFileUpload, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      {/* Drop area */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-[16px] border border-dashed p-10 text-center
          transition-colors duration-300 ease-out flex flex-col items-center justify-center min-h-[200px]
          ${
            isDragging
              ? "border-[#4F46E5] bg-[#F8FAFC]"
              : "border-[#E5E7EB] bg-[#F8FAFC] hover:border-[#D1D5DB]"
          }
        `}
      >
        <div className="mb-4 text-[#6B7280]">
          {isUploading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="h-8 w-8 text-[#4F46E5]" strokeWidth={1.5} />
            </motion.div>
          ) : (
            <UploadCloud className="h-8 w-8 transition-colors" strokeWidth={1.5} />
          )}
        </div>
        <p className="text-[16px] font-medium text-[#111827]">
          {isUploading ? "Reading invoice data…" : "Upload your invoice"}
        </p>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          {isUploading ? "Please wait a moment" : "Click to browse or drag and drop your PDF here"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />
      </motion.div>

      {/* Uploaded file chip */}
      <AnimatePresence>
        {uploadedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="group flex items-center gap-3 rounded-[12px] bg-[#F8FAFC] px-4 py-3 border border-[#E5E7EB]"
          >
            <div className="flex bg-[#FFFFFF] p-2 rounded-[8px] border border-[#E5E7EB]">
              <FileText className="h-5 w-5 shrink-0 text-[#6B7280]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[#111827]">
                {uploadedFile.name}
              </p>
              <p className="text-[12px] text-[#6B7280]">
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: "#FEE2E2" }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFile();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:text-red-500"
              title="Remove file"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
