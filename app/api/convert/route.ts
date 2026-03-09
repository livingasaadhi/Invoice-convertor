import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  SGD: "S$",
  AUD: "A$",
}

interface TextItem {
  str: string
  width: number
  height: number
  transform: number[] // [scaleX, skewY, skewX, scaleY, x, y]
}

interface MergedGroup {
  text: string
  items: TextItem[]
  x: number
  y: number
  totalWidth: number
  fontSize: number
}

/**
 * Use the bundled pdfjs from pdf-parse to extract text items with positions
 */
async function getTextItemsWithPositions(buffer: Buffer) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFJS = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js")
  PDFJS.disableWorker = true

  const doc = await PDFJS.getDocument(buffer)
  const pages: { pageIndex: number; items: TextItem[] }[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    })
    pages.push({
      pageIndex: i - 1,
      items: textContent.items as TextItem[],
    })
  }

  doc.destroy()
  return pages
}

/**
 * Merge adjacent text items that are on the same Y line into groups,
 * so we can match amounts that are split across multiple items
 */
function mergeItemsIntoGroups(items: TextItem[]): MergedGroup[] {
  if (items.length === 0) return []

  const groups: MergedGroup[] = []
  let current: MergedGroup = {
    text: items[0].str,
    items: [items[0]],
    x: items[0].transform[4],
    y: items[0].transform[5],
    totalWidth: items[0].width,
    fontSize: Math.abs(items[0].transform[0]) || 12,
  }

  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    const itemY = item.transform[5]
    const itemX = item.transform[4]
    const prevEndX = current.x + current.totalWidth

    // Same line (Y within 2px) and roughly adjacent (gap < 20px)
    const sameY = Math.abs(itemY - current.y) < 2
    const adjacent = Math.abs(itemX - prevEndX) < 20

    if (sameY && adjacent) {
      current.text += item.str
      current.items.push(item)
      current.totalWidth = (itemX - current.x) + item.width
    } else {
      groups.push(current)
      current = {
        text: item.str,
        items: [item],
        x: item.transform[4],
        y: item.transform[5],
        totalWidth: item.width,
        fontSize: Math.abs(item.transform[0]) || 12,
      }
    }
  }
  groups.push(current)
  return groups
}

/**
 * Try multiple regex patterns to find INR amounts in merged text groups
 */
function findAmountGroups(groups: MergedGroup[], exchangeRate: number, symbol: string) {
  const patterns = [
    /[₹]\s?[\d,]+(?:\.\d{1,2})?/,
    /INR\s?[\d,]+(?:\.\d{1,2})?/i,
    /Rs\.?\s?[\d,]+(?:\.\d{1,2})?/i,
    /Rupees\s?[\d,]+(?:\.\d{1,2})?/i,
  ]

  // Also match plain numbers that look like currency (4+ digit numbers with commas)
  const plainNumberPattern = /^[\d,]+\.\d{2}$/

  const results: {
    group: MergedGroup
    convertedText: string
    originalAmount: number
  }[] = []

  for (const group of groups) {
    let matchedAmount: number | null = null

    // Try INR-specific patterns first
    for (const pattern of patterns) {
      const match = group.text.match(pattern)
      if (match) {
        const cleaned = match[0].replace(/[^\d.]/g, "")
        const num = parseFloat(cleaned)
        if (!isNaN(num) && num > 0) {
          matchedAmount = num
          break
        }
      }
    }

    // If no prefix match, try plain number pattern (for numbers ≥ 100)
    if (matchedAmount === null) {
      const plainMatch = group.text.trim().match(plainNumberPattern)
      if (plainMatch) {
        const num = parseFloat(plainMatch[0].replace(/,/g, ""))
        if (!isNaN(num) && num >= 100) {
          matchedAmount = num
        }
      }
    }

    if (matchedAmount !== null) {
      const converted = matchedAmount * exchangeRate
      const formattedConverted = converted.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      results.push({
        group,
        convertedText: `${symbol}${formattedConverted}`,
        originalAmount: matchedAmount,
      })
    }
  }

  return results
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const toCurrency = formData.get("toCurrency") as string
    const exchangeRate = parseFloat(formData.get("exchangeRate") as string)

    if (!file || !toCurrency || isNaN(exchangeRate)) {
      return NextResponse.json(
        { error: "Missing file, currency, or exchange rate" },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Step 1: Find text positions using pdfjs
    const pagesWithItems = await getTextItemsWithPositions(buffer)

    const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + " "

    // Step 2: Load the original PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const pages = pdfDoc.getPages()

    let totalReplacements = 0

    // Step 3: For each page, merge items, find amounts, overlay converted values
    for (const pageData of pagesWithItems) {
      if (pageData.pageIndex >= pages.length) continue
      const page = pages[pageData.pageIndex]

      // Log all text items for debugging
      console.log(`\n=== Page ${pageData.pageIndex + 1}: ${pageData.items.length} text items ===`)
      for (const item of pageData.items) {
        if (item.str.trim()) {
          console.log(`  [${item.transform[4].toFixed(1)}, ${item.transform[5].toFixed(1)}] w=${item.width.toFixed(1)} "${item.str}"`)
        }
      }

      // Merge adjacent items into groups
      const groups = mergeItemsIntoGroups(pageData.items)

      console.log(`\n=== Merged into ${groups.length} groups ===`)
      for (const g of groups) {
        if (g.text.trim()) {
          console.log(`  [${g.x.toFixed(1)}, ${g.y.toFixed(1)}] w=${g.totalWidth.toFixed(1)} fs=${g.fontSize.toFixed(1)} "${g.text}"`)
        }
      }

      // Find amounts in merged groups
      const amountGroups = findAmountGroups(groups, exchangeRate, symbol)

      console.log(`\n=== Found ${amountGroups.length} amounts to replace ===`)
      for (const ag of amountGroups) {
        console.log(`  "${ag.group.text}" → "${ag.convertedText}" (₹${ag.originalAmount})`)
      }

      // Replace each amount
      for (const { group, convertedText } of amountGroups) {
        // Draw tightly fitted white rectangle to cover the original text
        // without overlapping neighbors (e.g. "Balance Due")
        page.drawRectangle({
          x: group.x - 1,
          y: group.y - 1,
          width: group.totalWidth + 2,
          height: group.fontSize + 2,
          color: rgb(1, 1, 1),
        })

        // Draw converted amount on top of the fresh white bg
        const useFont = group.fontSize >= 14 ? fontBold : font
        page.drawText(convertedText, {
          x: group.x,
          y: group.y,
          size: group.fontSize,
          font: useFont,
          color: rgb(0, 0, 0),
        })

        totalReplacements++
      }
    }

    console.log(`\n>>> Total replacements: ${totalReplacements}`)

    // Step 4: Save and return modified PDF
    const pdfBytes = await pdfDoc.save()
    const safeName = (file.name || "invoice").replace(/\.pdf$/i, "")

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-converted-${toCurrency}.pdf"`,
      },
    })
  } catch (error) {
    console.error("PDF conversion error:", error)
    return NextResponse.json(
      { error: "Failed to generate converted PDF" },
      { status: 500 }
    )
  }
}
