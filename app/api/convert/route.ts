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

// Currency word replacements: INR word → target currency word
// Each entry is [searchRegex, replacementForEachCurrency]
const CURRENCY_WORDS: Record<string, Record<string, string>> = {
  USD: {
    "Indian Rupees": "Dollars", "Indian rupees": "Dollars", "indian rupees": "dollars", "INDIAN RUPEES": "DOLLARS",
    "Indian Rupee": "Dollar", "Indian rupee": "Dollar", "indian rupee": "dollar", "INDIAN RUPEE": "DOLLAR",
    "Rupees": "Dollars", "rupees": "dollars", "RUPEES": "DOLLARS",
    "Rupee": "Dollar", "rupee": "dollar", "RUPEE": "DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",
    "INR": "USD",
  },
  EUR: {
    "Indian Rupees": "Euros", "Indian rupees": "Euros", "indian rupees": "euros", "INDIAN RUPEES": "EUROS",
    "Indian Rupee": "Euro", "Indian rupee": "Euro", "indian rupee": "euro", "INDIAN RUPEE": "EURO",
    "Rupees": "Euros", "rupees": "euros", "RUPEES": "EUROS",
    "Rupee": "Euro", "rupee": "euro", "RUPEE": "EURO",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",
    "INR": "EUR",
  },
  GBP: {
    "Indian Rupees": "Pounds", "Indian rupees": "Pounds", "indian rupees": "pounds", "INDIAN RUPEES": "POUNDS",
    "Indian Rupee": "Pound", "Indian rupee": "Pound", "indian rupee": "pound", "INDIAN RUPEE": "POUND",
    "Rupees": "Pounds", "rupees": "pounds", "RUPEES": "POUNDS",
    "Rupee": "Pound", "rupee": "pound", "RUPEE": "POUND",
    "Paise": "Pence", "paise": "pence", "PAISE": "PENCE",
    "Paisa": "Penny", "paisa": "penny", "PAISA": "PENNY",
    "INR": "GBP",
  },
  AED: {
    "Indian Rupees": "Dirhams", "Indian rupees": "Dirhams", "indian rupees": "dirhams", "INDIAN RUPEES": "DIRHAMS",
    "Indian Rupee": "Dirham", "Indian rupee": "Dirham", "indian rupee": "dirham", "INDIAN RUPEE": "DIRHAM",
    "Rupees": "Dirhams", "rupees": "dirhams", "RUPEES": "DIRHAMS",
    "Rupee": "Dirham", "rupee": "dirham", "RUPEE": "DIRHAM",
    "Paise": "Fils", "paise": "fils", "PAISE": "FILS",
    "Paisa": "Fil", "paisa": "fil", "PAISA": "FIL",
    "INR": "AED",
  },
  SGD: {
    "Indian Rupees": "Dollars", "Indian rupees": "Dollars", "indian rupees": "dollars", "INDIAN RUPEES": "DOLLARS",
    "Indian Rupee": "Dollar", "Indian rupee": "Dollar", "indian rupee": "dollar", "INDIAN RUPEE": "DOLLAR",
    "Rupees": "Dollars", "rupees": "dollars", "RUPEES": "DOLLARS",
    "Rupee": "Dollar", "rupee": "dollar", "RUPEE": "DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",
    "INR": "SGD",
  },
  AUD: {
    "Indian Rupees": "Dollars", "Indian rupees": "Dollars", "indian rupees": "dollars", "INDIAN RUPEES": "DOLLARS",
    "Indian Rupee": "Dollar", "Indian rupee": "Dollar", "indian rupee": "dollar", "INDIAN RUPEE": "DOLLAR",
    "Rupees": "Dollars", "rupees": "dollars", "RUPEES": "DOLLARS",
    "Rupee": "Dollar", "rupee": "dollar", "RUPEE": "DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",
    "INR": "AUD",
  },
}

// Regex patterns for finding currency amounts
const AMOUNT_PATTERNS = [
  /[₹]\s?[\d,]+(?:\.\d{1,2})?/,
  /INR\s?[\d,]+(?:\.\d{1,2})?/i,
  /Rs\.?\s?[\d,]+(?:\.\d{1,2})?/i,
  /Rupees\s?[\d,]+(?:\.\d{1,2})?/i,
]

// Plain numbers that look like currency (4+ digit numbers with commas)
const PLAIN_NUMBER_PATTERN = /^[\d,]+\.\d{2}$/

interface TextItem {
  str: string
  width: number
  height: number
  transform: number[] // [scaleX, skewY, skewX, scaleY, x, y]
  fontName: string
}

interface MergedGroup {
  text: string
  items: TextItem[]
  x: number
  y: number
  totalWidth: number
  fontSize: number
  fontName: string
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
    fontName: items[0].fontName,
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
        fontName: item.fontName,
      }
    }
  }
  groups.push(current)
  return groups
}

/**
 * Try multiple regex patterns to find INR amounts in merged text groups
 */
interface ReplacementOp {
  text: string
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  fontName: string
}

function getMatchBounds(group: MergedGroup, matchIndex: number, matchLength: number) {
  const charBounds: { x: number; w: number }[] = []

  let accumulatedX = group.x
  for (const item of group.items) {
    const text = item.str
    const itemW = item.width
    if (text.length === 0) continue

    const charW = itemW / text.length
    for (let i = 0; i < text.length; i++) {
      charBounds.push({
        x: accumulatedX + i * charW,
        w: charW
      })
    }
    accumulatedX += itemW
  }

  if (matchIndex < 0 || matchIndex >= charBounds.length) return null

  const startChar = charBounds[matchIndex]
  const endChar = charBounds[Math.min(matchIndex + matchLength - 1, charBounds.length - 1)]

  return {
    x: startChar.x,
    w: (endChar.x + endChar.w) - startChar.x
  }
}

// Calculate the rendered width of text in a specific font and size
function estimateTextWidth(text: string, fontSize: number): number {
  // Rough estimate for Helvetica: avg char width is ~0.5 * fontSize
  return text.length * (fontSize * 0.5)
}

/**
 * Try multiple regex patterns to find INR amounts in merged text groups
 */
function findAmountGroups(groups: MergedGroup[], symbol: string): ReplacementOp[] {
  const ops: ReplacementOp[] = []

  for (const group of groups) {
    let matchedAmount: number | null = null
    let matchedString = ""

    // Try INR-specific patterns first
    for (const pattern of AMOUNT_PATTERNS) {
      const match = group.text.match(pattern)
      if (match) {
        const cleaned = match[0].replace(/[^\d.]/g, "")
        const num = parseFloat(cleaned)
        if (!isNaN(num) && num >= 0) {
          matchedAmount = num
          matchedString = match[0]
          break
        }
      }
    }

    // If no prefix match, try plain number pattern (for numbers ≥ 100)
    if (matchedAmount === null) {
      const plainMatch = group.text.trim().match(PLAIN_NUMBER_PATTERN)
      if (plainMatch) {
        const num = parseFloat(plainMatch[0].replace(/,/g, ""))
        if (!isNaN(num) && num >= 100) {
          matchedAmount = num
          matchedString = plainMatch[0]
        }
      }
    }

    if (matchedAmount !== null) {
      const formattedConverted = matchedAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      const convertedText = `${symbol}${formattedConverted}`
      const startIndex = group.text.indexOf(matchedString)
      const bounds = getMatchBounds(group, startIndex, matchedString.length)

      if (bounds) {
        ops.push({
          text: convertedText,
          x: bounds.x,
          y: group.y,
          w: bounds.w,
          h: group.fontSize,
          fontSize: group.fontSize,
          fontName: group.fontName,
        })
      }
    }
  }

  return ops
}

/**
 * Find text groups containing INR-related words, replace the words within the whole string,
 * and redraw the entire string to avoid shifting/spacing artifacts
 */
function findWordGroups(groups: MergedGroup[], toCurrency: string): ReplacementOp[] {
  const ops: ReplacementOp[] = []
  const wordMap = CURRENCY_WORDS[toCurrency]
  if (!wordMap) return ops

  for (const group of groups) {
    let newText = group.text
    let hasMatch = false

    // Replace longer words first to avoid partial matches (e.g. "Rupees" before "Rupee")
    const sortedWords = Object.keys(wordMap).sort((a, b) => b.length - a.length)

    for (const word of sortedWords) {
      if (newText.includes(word)) {
        newText = newText.split(word).join(wordMap[word])
        hasMatch = true
      }
    }

    if (hasMatch) {
      // Issue a single replacement op for the entire line to guarantee seamless spacing
      ops.push({
        text: newText,
        x: group.x,
        y: group.y,
        w: group.totalWidth, // Mask the entire original line
        h: group.fontSize,
        fontSize: group.fontSize,
        fontName: group.fontName
      })
    }
  }

  return ops
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const toCurrency = formData.get("toCurrency") as string

    if (!file || !toCurrency) {
      return NextResponse.json(
        { error: "Missing file or currency" },
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
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    const fontBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
    const pages = pdfDoc.getPages()

    let totalReplacements = 0

    // Step 3: For each page, merge items, find amounts, overlay converted values
    for (const pageData of pagesWithItems) {
      if (pageData.pageIndex >= pages.length) continue
      const page = pages[pageData.pageIndex]

      // Merge adjacent items into groups
      const groups = mergeItemsIntoGroups(pageData.items)

      // Find all replacements for this page
      const amountOps = findAmountGroups(groups, symbol)
      const wordOps = findWordGroups(groups, toCurrency)
      const allOps = [...amountOps, ...wordOps]

      // Apply each replacement using its precise substring bounds
      for (const op of allOps) {
        page.drawRectangle({
          x: op.x - 1,
          y: op.y - 1, // tighter descender margin
          width: op.w + 2,
          height: op.h + 1, // tightly bound to exactly font height
          color: rgb(1, 1, 1),
        })

        const isBold = op.fontName.toLowerCase().includes('bold') || op.fontSize >= 14
        const isItalic = op.fontName.toLowerCase().includes('italic') || op.fontName.toLowerCase().includes('oblique')

        let useFont = font
        if (isBold && isItalic) useFont = fontBoldOblique
        else if (isBold) useFont = fontBold
        else if (isItalic) useFont = fontOblique

        // Draw the text
        page.drawText(op.text, {
          x: op.x,
          y: op.y,
          size: op.fontSize,
          font: useFont,
          color: rgb(0, 0, 0),
        })

        totalReplacements++
      }
    }

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
