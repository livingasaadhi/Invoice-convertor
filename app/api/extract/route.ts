import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Import the core parser directly to bypass index.js test-mode bug
    // (pdf-parse index.js tries to load a test PDF when !module.parent is true)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse")
    const data = await pdfParse(buffer)
    const text: string = data.text

    // Log extracted text for debugging
    console.log("=== EXTRACTED PDF TEXT ===")
    console.log(text)
    console.log("=========================")

    // Broad set of regex patterns to match INR amounts in various formats:
    // ₹12,450  |  ₹ 12,450.00  |  INR 12,450  |  Rs. 12,450  |  Rs 12450
    // Rupees 12,450  |  Total: 12,450  |  Amount: 12,450.00
    const patterns = [
      /[₹]\s?[\d,]+(?:\.\d{1,2})?/g,                    // ₹12,450 or ₹ 12,450.00
      /INR\s?[\d,]+(?:\.\d{1,2})?/gi,                    // INR 12,450
      /Rs\.?\s?[\d,]+(?:\.\d{1,2})?/gi,                  // Rs. 12,450 or Rs 12450
      /Rupees\s?[\d,]+(?:\.\d{1,2})?/gi,                 // Rupees 12,450
      /(?:Total|Grand\s?Total|Amount|Net\s?Amount|Balance(?:\s?Due)?)\s*[:\-]?\s*[\d,]+(?:\.\d{1,2})?/gi,
    ]

    const allNumbers: number[] = []

    for (const regex of patterns) {
      const matches = text.match(regex)
      if (matches) {
        for (const match of matches) {
          // Strip everything except digits and dots
          const cleaned = match.replace(/[^\d.]/g, "")
          const num = parseFloat(cleaned)
          if (!isNaN(num) && num > 0) {
            allNumbers.push(num)
          }
        }
      }
    }

    // Deduplicate and sort descending
    const unique = [...new Set(allNumbers)].sort((a, b) => b - a)

    console.log("Detected amounts:", unique)

    if (unique.length === 0) {
      // Fallback: find any number that looks like a monetary amount (4+ digits)
      const fallbackRegex = /[\d,]+\.\d{2}/g
      const fallbackMatches = text.match(fallbackRegex)
      if (fallbackMatches) {
        const fallbackNums = fallbackMatches
          .map((m: string) => parseFloat(m.replace(/,/g, "")))
          .filter((n: number) => !isNaN(n) && n >= 100)
          .sort((a: number, b: number) => b - a)

        if (fallbackNums.length > 0) {
          console.log("Fallback amount:", fallbackNums[0])
          return NextResponse.json({ amount: fallbackNums[0], rawText: text })
        }
      }

      return NextResponse.json({ amount: null, rawText: text })
    }

    return NextResponse.json({ amount: unique[0], rawText: text })
  } catch (error) {
    console.error("PDF extraction error:", error)
    return NextResponse.json({ error: "PDF parsing failed" }, { status: 500 })
  }
}
