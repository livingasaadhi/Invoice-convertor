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

  const handleUpload = useCallback(async (file: File) => {
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
  }, [onAmountDetected, onError]);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        onError("Please upload a PDF file.");
        return;
      }
      onFileUpload(file);
      handleUpload(file);
    },
    [onFileUpload, onError, handleUpload]
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
    <div>
      <AnimatePresence mode="popLayout">
        {!uploadedFile ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-[14px] border-2 border-black p-6 text-center
              transition-all duration-200 ease-out flex flex-col items-center justify-center min-h-[160px]
              shadow-[4px_4px_0px_#000]
              ${isDragging ? "bg-[#B9A8D8]" : "bg-[#C7B8EA] hover:bg-[#B9A8D8]"}
            `}
          >
            <div className="mb-3">
              {isUploading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <Loader2 className="h-10 w-10 text-black" strokeWidth={2} />
                </motion.div>
              ) : (
                <UploadCloud className="h-10 w-10 text-black" strokeWidth={2} />
              )}
            </div>
            <p className="text-[16px] font-bold text-black">
              {isUploading ? "Reading invoice data…" : "Drag and drop your invoice PDF"}
            </p>
            <p className="mt-1 text-[14px] font-medium text-black/60">
              {isUploading ? "Please wait a moment" : "or click to upload"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              onChange={handleChange}
              className="hidden"
            />
          </motion.div>
        ) : (
          <motion.div
            key="uploaded"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="flex items-center gap-3 rounded-[14px] bg-white px-4 py-4 border-2 border-black shadow-[4px_4px_0px_#000]"
          >
            <div className="flex bg-[#C7B8EA] p-2.5 rounded-[10px] border-2 border-black">
              <FileText className="h-6 w-6 shrink-0 text-black" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold text-black">
                {uploadedFile.name}
              </p>
              <p className="text-[13px] font-medium text-gray-500">
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFile();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border-2 border-black bg-white text-black transition-colors hover:bg-red-100 hover:text-red-600"
              title="Remove file"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
