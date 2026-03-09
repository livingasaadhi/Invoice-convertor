import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RupeeSwitch | Invoice Converter",
  description:
    "Convert rupee invoices into global currencies instantly. Upload a PDF invoice, choose a currency, and download the converted version in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased text-[#111827] bg-[#F8FAFC]`}
      >
        {children}
      </body>
    </html>
  );
}
