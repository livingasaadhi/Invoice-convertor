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
          relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center
          transition-colors duration-300 ease-out
          ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/80 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
              : "border-gray-200 bg-gray-50 hover:border-indigo-400 hover:bg-gray-100/50"
          }
        `}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform group-hover:scale-110">
          {isUploading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 className="h-6 w-6 text-indigo-500" />
            </motion.div>
          ) : (
            <UploadCloud
              className={`h-7 w-7 transition-colors ${
                isDragging ? "text-indigo-500" : "text-gray-400"
              }`}
            />
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800">
          {isUploading ? "Reading invoice data…" : "Drag & drop your PDF here"}
        </p>
        <p className="mt-1.5 text-xs text-gray-500 font-medium">
          {isUploading ? "Please wait a moment" : "or click here to browse files"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />

        {/* Shimmer effect inside dropzone */}
        {!isUploading && !isDragging && (
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(45deg,transparent_25%,rgba(99,102,241,0.03)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] bg-[position:200%_0,0_0] bg-no-repeat transition-[background-position_0s_ease] hover:bg-[position:-200%_0,0_0] hover:duration-[1500ms]" />
        )}
      </motion.div>

      {/* Uploaded file chip */}
      <AnimatePresence>
        {uploadedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="group flex items-center gap-3 rounded-xl bg-indigo-50/80 px-4 py-3 ring-1 ring-indigo-100/50 shadow-sm"
          >
            <div className="flex bg-white p-2 rounded-lg shadow-sm">
              <FileText className="h-5 w-5 shrink-0 text-indigo-500" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {uploadedFile.name}
              </p>
              <p className="text-xs font-medium text-gray-500">
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: "#fee2e2" }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFile();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-red-500"
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
