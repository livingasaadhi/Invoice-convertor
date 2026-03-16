import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "USD ",
  EUR: "EUR ",
  GBP: "GBP ",
  AED: "AED ",
  SGD: "SGD ",
  AUD: "AUD ",
  CAD: "CAD ",
  SAR: "SAR ",
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
  fontSize: number
  fontColor: number[] // [r, g, b] normalized 0-1
  bgColor: number[] | null // [r, g, b] normalized 0-1 of the underlying block
  isBold: boolean
  isItalic: boolean
}

interface MergedGroup {
  text: string
  items: TextItem[]
  x: number
  y: number
  totalWidth: number
  fontSize: number
  fontName: string
  bgColor: number[] | null
}

/**
 * Use the bundled pdfjs from pdf-parse to extract text items with positions and font details
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

    // Extract font information from the page
    const fontInfo = await extractFontInfo(page)
    const bgColors = await extractBackgroundColors(page) // array of {y, h, color} objects

    const enhancedItems = textContent.items.map((item: any) => {
      // Get font details for this text item
      const fontDetails = fontInfo.get(item.fontName) || {
        isBold: false,
        isItalic: false,
        fontSize: Math.abs(item.transform[0]) || 12,
        fontColor: [0, 0, 0] // Default black
      }

      // Find the most recent background rect that intersects this item's Y coordinate
      // PDF Y coordinates usually go from bottom to top, so we check distance
      const itemY = item.transform[5];
      let matchedBg: number[] | null = null;
      for (const bg of bgColors) {
        // Simple intersection: is the text's Y coordinate roughly inside the drawn background rect?
        if (itemY >= bg.y - 10 && itemY <= bg.y + bg.h + 10) {
          matchedBg = bg.color;
        }
      }

      return {
        str: item.str,
        width: item.width,
        height: item.height,
        transform: item.transform,
        fontName: item.fontName,
        fontSize: fontDetails.fontSize,
        fontColor: fontDetails.fontColor,
        bgColor: matchedBg,
        isBold: fontDetails.isBold,
        isItalic: fontDetails.isItalic
      }
    })

    pages.push({
      pageIndex: i - 1,
      items: enhancedItems,
    })
  }

  doc.destroy()
  return pages
}

/**
 * Extract font information from a PDF page
 */
async function extractFontInfo(page: any): Promise<Map<string, any>> {
  const fontInfo = new Map<string, any>()

  try {
    // Get the page dictionary to access font resources
    const pageDict = page.commonObjs._objs
    const resources = await page.getOperatorList()

    // Look for font operators in the content stream
    for (const op of resources.fnArray) {
      if (op === 43) { // PDFJS.OPS.setFont constant
        // This would need to be enhanced based on PDF.js API
        // For now, we'll use a simpler approach
      }
    }
  } catch (error) {
    console.warn("Could not extract detailed font info:", error)
  }

  // Fallback: analyze font names to determine style
  // This is a simplified approach that works with most PDFs
  return fontInfo
}

/**
 * Parses the raw drawing operators to find fill Rectangles and their colors.
 * Used to determine the background color of specific rows (e.g. for invoices with zebra-striping)
 */
async function extractBackgroundColors(page: any): Promise<Array<{ y: number, h: number, color: number[] }>> {
  const backgrounds: Array<{ y: number, h: number, color: number[] }> = []

  try {
    const resources = await page.getOperatorList()
    let currentFillRGB: number[] | null = null;

    // PDFJS.OPS maps numbers to operators (e.g., setFillRGBColor, rectangle, fill)
    for (let i = 0; i < resources.fnArray.length; i++) {
      const op = resources.fnArray[i]
      const args = resources.argsArray[i]

      // OPS.setFillRGBColor (usually 28 or 25 depending on the exact PDF.js build)
      // We'll look for operations with 3 arguments in the RGB range 0-1
      // and heuristic checking for common background fills
      if (args && args.length === 3 && typeof args[0] === 'number') {
        // Basic detection of an RGB color set
        // Assuming operations like setFillRGBColor
        currentFillRGB = [args[0], args[1], args[2]]
      }

      // OPS.constructPath / OPS.rectangle (usually 71)
      if (op === 71 && args && args.length === 4 && currentFillRGB) {
        const [x, y, w, h] = args;
        // Filter out pure white (1,1,1) or pure black (0,0,0) as they are rarely 'row backgrounds'
        // or we might want to keep white. We'll track everything.
        backgrounds.push({
          y: y,
          h: h,
          color: currentFillRGB
        })
      }
    }
  } catch (error) {
    console.warn("Could not extract background colors:", error)
  }

  return backgrounds;
}

/**
 * Analyze font name to determine if it's bold or italic
 */
function analyzeFontName(fontName: string): { isBold: boolean; isItalic: boolean } {
  const name = (fontName || '').toLowerCase()

  const isBold = name.includes('bold') ||
    name.includes('black') ||
    name.includes('heavy') ||
    name.includes('extrabold') ||
    name.includes('semibold')

  const isItalic = name.includes('italic') ||
    name.includes('oblique') ||
    name.includes('cursive')

  return { isBold, isItalic }
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
    bgColor: items[0].bgColor,
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
        bgColor: item.bgColor,
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
  fontColor?: number[]
  bgColor?: number[]
  isAmount: boolean
  isBold?: boolean
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

/**
 * Enhanced character boundary calculation for more precise text positioning
 */
function getEnhancedCharBounds(group: MergedGroup): { x: number; w: number; itemIndex: number }[] {
  const charBounds: { x: number; w: number; itemIndex: number }[] = []

  let accumulatedX = group.x
  for (let itemIndex = 0; itemIndex < group.items.length; itemIndex++) {
    const item = group.items[itemIndex]
    const text = item.str
    const itemW = item.width
    if (text.length === 0) continue

    const charW = itemW / text.length
    for (let i = 0; i < text.length; i++) {
      charBounds.push({
        x: accumulatedX + i * charW,
        w: charW,
        itemIndex
      })
    }
    accumulatedX += itemW
  }

  return charBounds
}

/**
 * Get precise bounds for a text match with enhanced positioning
 */
function getEnhancedMatchBounds(group: MergedGroup, matchIndex: number, matchLength: number) {
  const charBounds = getEnhancedCharBounds(group)

  if (matchIndex < 0 || matchIndex >= charBounds.length) return null

  const startChar = charBounds[matchIndex]
  const endChar = charBounds[Math.min(matchIndex + matchLength - 1, charBounds.length - 1)]

  // If match reaches end of the group, use the physical right boundary of the group
  // because average char width underestimates wide characters like 0 at the end
  let totalW = (endChar.x + endChar.w) - startChar.x;
  if (matchIndex + matchLength >= charBounds.length) {
    totalW = (group.x + group.totalWidth) - startChar.x;
  }

  // Add small padding for better coverage
  const padding = 0.5

  return {
    x: startChar.x - padding,
    w: totalW + (padding * 2),
    h: group.fontSize,
    baseline: group.y
  }
}

// Calculate the rendered width of text in a specific font and size
function estimateTextWidth(text: string, fontSize: number): number {
  // Rough estimate for Helvetica: avg char width is ~0.5 * fontSize
  return text.length * (fontSize * 0.5)
}

/**
 * Enhanced currency detection with context-aware patterns
 */
const ENHANCED_AMOUNT_PATTERNS = [
  // Standard INR patterns
  /[₹]\s?[\d,]+(?:\.\d{1,2})?/g,
  /INR\s?[\d,]+(?:\.\d{1,2})?/gi,
  /Rs\.?\s?[\d,]+(?:\.\d{1,2})?/gi,
  /Rupees\s?[\d,]+(?:\.\d{1,2})?/gi,

  // Context-aware patterns (amounts near keywords)
  /(Total|Grand\s?Total|Amount|Net\s?Amount|Balance(?:\s?Due)?|Subtotal|Invoice\s?Total)\s*[:\-]?\s*[₹]\s?[\d,]+(?:\.\d{1,2})?/gi,
  /(Total|Grand\s?Total|Amount|Net\s?Amount|Balance(?:\s?Due)?|Subtotal|Invoice\s?Total)\s*[:\-]?\s*INR\s?[\d,]+(?:\.\d{1,2})?/gi,
  /(Total|Grand\s?Total|Amount|Net\s?Amount|Balance(?:\s?Due)?|Subtotal|Invoice\s?Total)\s*[:\-]?\s*Rs\.?\s?[\d,]+(?:\.\d{1,2})?/gi,

  // Amounts with currency words
  /[\d,]+(?:\.\d{1,2})?\s*(?:Rupees|INR|Rs\.?)/gi,

  // Decimal amounts that look like currency
  /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/g,
]

/**
 * Try multiple regex patterns to find INR amounts in merged text groups with enhanced detection
 */
/**
 * Enhanced currency word replacements with context-aware patterns
 */
const ENHANCED_CURRENCY_WORDS: Record<string, Record<string, string>> = {
  USD: {
    "Indian Rupees": "US Dollars", "Indian rupees": "US Dollars", "indian rupees": "us dollars", "INDIAN RUPEES": "US DOLLARS",
    "Indian Rupee": "US Dollar", "Indian rupee": "US Dollar", "indian rupee": "us dollar", "INDIAN RUPEE": "US DOLLAR",
    "Rupees": "US Dollars", "rupees": "us dollars", "RUPEES": "US DOLLARS",
    "Rupee": "US Dollar", "rupee": "us dollar", "RUPEE": "US DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "USD", "rs": "USD",
    "Rs.": "USD", "rs.": "USD",
    "₹": "USD",

    "Rupees only": "US Dollars only",
    "Rupee only": "US Dollar only",
    "Rupees/-": "US Dollars/-",
    "Rupee/-": "US Dollar/-",
  },
  EUR: {
    "Indian Rupees": "Euros", "Indian rupees": "Euros", "indian rupees": "euros", "INDIAN RUPEES": "EUROS",
    "Indian Rupee": "Euro", "Indian rupee": "Euro", "indian rupee": "euro", "INDIAN RUPEE": "EURO",
    "Rupees": "Euros", "rupees": "euros", "RUPEES": "EUROS",
    "Rupee": "Euro", "rupee": "euro", "RUPEE": "EURO",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "EUR", "rs": "EUR",
    "Rs.": "EUR", "rs.": "EUR",
    "₹": "EUR",

    "Rupees only": "Euros only",
    "Rupee only": "Euro only",
    "Rupees/-": "Euros/-",
    "Rupee/-": "Euro/-",
  },
  GBP: {
    "Indian Rupees": "Pounds", "Indian rupees": "Pounds", "indian rupees": "pounds", "INDIAN RUPEES": "POUNDS",
    "Indian Rupee": "Pound", "Indian rupee": "Pound", "indian rupee": "pound", "INDIAN RUPEE": "POUND",
    "Rupees": "Pounds", "rupees": "pounds", "RUPEES": "POUNDS",
    "Rupee": "Pound", "rupee": "pound", "RUPEE": "POUND",
    "Paise": "Pence", "paise": "pence", "PAISE": "PENCE",
    "Paisa": "Penny", "paisa": "penny", "PAISA": "PENNY",

    "Rs": "GBP", "rs": "GBP",
    "Rs.": "GBP", "rs.": "GBP",
    "₹": "GBP",

    "Rupees only": "Pounds only",
    "Rupee only": "Pound only",
    "Rupees/-": "Pounds/-",
    "Rupee/-": "Pound/-",
  },
  AED: {
    "Indian Rupees": "UAE Dirhams", "Indian rupees": "UAE Dirhams", "indian rupees": "uae dirhams", "INDIAN RUPEES": "UAE DIRHAMS",
    "Indian Rupee": "UAE Dirham", "Indian rupee": "UAE Dirham", "indian rupee": "uae dirham", "INDIAN RUPEE": "UAE DIRHAM",
    "Rupees": "UAE Dirhams", "rupees": "uae dirhams", "RUPEES": "UAE DIRHAMS",
    "Rupee": "UAE Dirham", "rupee": "uae dirham", "RUPEE": "UAE DIRHAM",
    "Paise": "Fils", "paise": "fils", "PAISE": "FILS",
    "Paisa": "Fil", "paisa": "fil", "PAISA": "FIL",

    "Rs": "AED", "rs": "AED",
    "Rs.": "AED", "rs.": "AED",
    "₹": "AED",

    "Rupees only": "UAE Dirhams only",
    "Rupee only": "UAE Dirham only",
    "Rupees/-": "UAE Dirhams/-",
    "Rupee/-": "UAE Dirham/-",
  },
  SGD: {
    "Indian Rupees": "Singapore Dollars", "Indian rupees": "Singapore Dollars", "indian rupees": "singapore dollars", "INDIAN RUPEES": "SINGAPORE DOLLARS",
    "Indian Rupee": "Singapore Dollar", "Indian rupee": "Singapore Dollar", "indian rupee": "singapore dollar", "INDIAN RUPEE": "SINGAPORE DOLLAR",
    "Rupees": "Singapore Dollars", "rupees": "singapore dollars", "RUPEES": "SINGAPORE DOLLARS",
    "Rupee": "Singapore Dollar", "rupee": "singapore dollar", "RUPEE": "SINGAPORE DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "SGD", "rs": "SGD",
    "Rs.": "SGD", "rs.": "SGD",
    "₹": "SGD",

    "Rupees only": "Singapore Dollars only",
    "Rupee only": "Singapore Dollar only",
    "Rupees/-": "Singapore Dollars/-",
    "Rupee/-": "Singapore Dollar/-",
  },
  AUD: {
    "Indian Rupees": "Australian Dollars", "Indian rupees": "Australian Dollars", "indian rupees": "australian dollars", "INDIAN RUPEES": "AUSTRALIAN DOLLARS",
    "Indian Rupee": "Australian Dollar", "Indian rupee": "Australian Dollar", "indian rupee": "australian dollar", "INDIAN RUPEE": "AUSTRALIAN DOLLAR",
    "Rupees": "Australian Dollars", "rupees": "australian dollars", "RUPEES": "AUSTRALIAN DOLLARS",
    "Rupee": "Australian Dollar", "rupee": "australian dollar", "RUPEE": "AUSTRALIAN DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "AUD", "rs": "AUD",
    "Rs.": "AUD", "rs.": "AUD",
    "₹": "AUD",

    "Rupees only": "Australian Dollars only",
    "Rupee only": "Australian Dollar only",
    "Rupees/-": "Australian Dollars/-",
    "Rupee/-": "Australian Dollar/-",
  },
  CAD: {
    "Indian Rupees": "Canadian Dollars", "Indian rupees": "Canadian Dollars", "indian rupees": "canadian dollars", "INDIAN RUPEES": "CANADIAN DOLLARS",
    "Indian Rupee": "Canadian Dollar", "Indian rupee": "Canadian Dollar", "indian rupee": "canadian dollar", "INDIAN RUPEE": "CANADIAN DOLLAR",
    "Rupees": "Canadian Dollars", "rupees": "canadian dollars", "RUPEES": "CANADIAN DOLLARS",
    "Rupee": "Canadian Dollar", "rupee": "canadian dollar", "RUPEE": "CANADIAN DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "CAD", "rs": "CAD",
    "Rs.": "CAD", "rs.": "CAD",
    "₹": "CAD",

    "Rupees only": "Canadian Dollars only",
    "Rupee only": "Canadian Dollar only",
    "Rupees/-": "Canadian Dollars/-",
    "Rupee/-": "Canadian Dollar/-",
  },
  SAR: {
    "Indian Rupees": "Saudi Riyals", "Indian rupees": "Saudi Riyals", "indian rupees": "saudi riyals", "INDIAN RUPEES": "SAUDI RIYALS",
    "Indian Rupee": "Saudi Riyal", "Indian rupee": "Saudi Riyal", "indian rupee": "saudi riyal", "INDIAN RUPEE": "SAUDI RIYAL",
    "Rupees": "Saudi Riyals", "rupees": "saudi riyals", "RUPEES": "SAUDI RIYALS",
    "Rupee": "Saudi Riyal", "rupee": "saudi riyal", "RUPEE": "SAUDI RIYAL",
    "Paise": "Halalas", "paise": "halalas", "PAISE": "HALALAS",
    "Paisa": "Halala", "paisa": "halala", "PAISA": "HALALA",

    "Rs": "SAR", "rs": "SAR",
    "Rs.": "SAR", "rs.": "SAR",
    "₹": "SAR",

    "Rupees only": "Saudi Riyals only",
    "Rupee only": "Saudi Riyal only",
    "Rupees/-": "Saudi Riyals/-",
    "Rupee/-": "Saudi Riyal/-",
  },
}

/**
 * Unified replacement logic: processes each group once for both amounts and words
 * to prevent overlapping overlays.
 */
function findReplacementsForGroups(groups: MergedGroup[], toCurrency: string, symbol: string): ReplacementOp[] {
  const ops: ReplacementOp[] = []
  const wordMap = ENHANCED_CURRENCY_WORDS[toCurrency] || CURRENCY_WORDS[toCurrency]
  if (!wordMap) return ops

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    let currentText = group.text
    let isAmountReplacement = false
    let matchedAmount: number | null = null
    let matchedAmountStr = ""
    let bounds: { x: number; baseline: number; w: number; h: number } | null = null

    // 1. Try to find a currency amount in this group
    // Try enhanced patterns first (context-aware)
    for (const pattern of ENHANCED_AMOUNT_PATTERNS) {
      const match = group.text.match(pattern)
      if (match) {
        const fullMatch = match[0] // This includes symbols like Rs., ₹, etc.
        const amountMatch = fullMatch.match(/[\d,]+(?:\.\d{1,2})?/)
        if (amountMatch) {
          const cleaned = amountMatch[0].replace(/[^\d.]/g, "")
          const num = parseFloat(cleaned)
          if (!isNaN(num) && num >= 0) {
            matchedAmount = num
            matchedAmountStr = fullMatch // Replace the entire matched string (symbol + amount)
            break
          }
        }
      }
    }

    // fallback to basic patterns
    if (matchedAmount === null) {
      for (const pattern of AMOUNT_PATTERNS) {
        const match = group.text.match(pattern)
        if (match) {
          const fullMatch = match[0]
          const cleaned = fullMatch.replace(/[^\d.]/g, "")
          const num = parseFloat(cleaned)
          if (!isNaN(num) && num >= 0) {
            matchedAmount = num
            matchedAmountStr = fullMatch // Replace the entire matched string (symbol + amount)
            break
          }
        }
      }
    }

    // fallback to plain numbers
    if (matchedAmount === null) {
      const plainMatch = group.text.trim().match(PLAIN_NUMBER_PATTERN)
      if (plainMatch) {
        const num = parseFloat(plainMatch[0].replace(/,/g, ""))
        if (!isNaN(num) && num >= 100) {
          matchedAmount = num
          matchedAmountStr = plainMatch[0]
        }
      }
    }

    // If an amount was found, we'll replace the text with the converted amount
    if (matchedAmount !== null) {
      const formattedConverted = matchedAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const convertedText = `${symbol}${formattedConverted}`
      const startIndex = group.text.indexOf(matchedAmountStr)
      bounds = getEnhancedMatchBounds(group, startIndex, matchedAmountStr.length)

      if (bounds) {
        isAmountReplacement = true
        // Only replace the amount portion in our tracking string
        currentText = currentText.replace(matchedAmountStr, convertedText)
      }
    }

    // 2. Regardless of whether an amount was found, apply word replacements to the (potentially updated) text
    let hasWordMatch = false
    const sortedWords = Object.keys(wordMap).sort((a, b) => b.length - a.length)
    for (const word of sortedWords) {
      if (currentText.includes(word)) {
        // Use word boundaries for alphanumeric strings to avoid matching inside other words (e.g., "first")
        const isAlphanumeric = /^[a-zA-Z0-9\s]+$/.test(word);
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = isAlphanumeric 
          ? new RegExp(`\\b${escapedWord}\\b`, "g") 
          : new RegExp(escapedWord, "g");

        if (regex.test(currentText)) {
          currentText = currentText.replace(regex, wordMap[word]);
          hasWordMatch = true;
        }
      }
    }

    if (isAmountReplacement || hasWordMatch) {
      let finalCombinedText = currentText
      let appendOnly = false

      // Check context for "Amount in Words" formatting
      if (hasWordMatch) {
        // Look ahead for "Only" on the immediate next line
        if (i + 1 < groups.length) {
          const nextGroup = groups[i + 1]
          const nextTarget = nextGroup.text.trim().toLowerCase()
          if (nextTarget === "only" || nextTarget === "only." || nextTarget === "only/-") {
            appendOnly = true
            // Mask the orphaned "Only"
            ops.push({
              text: "",
              x: nextGroup.x,
              y: nextGroup.y,
              w: nextGroup.totalWidth,
              h: nextGroup.fontSize,
              fontSize: nextGroup.fontSize,
              fontName: group.fontName,
              fontColor: group.items[0]?.fontColor,
              isAmount: false,
            })
            i++
          }
        }

        if (appendOnly) finalCombinedText = `${finalCombinedText} Only`

        // Clean up spacing
        finalCombinedText = finalCombinedText
          .replace(/:([^\s])/g, ': $1')
          .replace(/\s{2,}/g, ' ')

        // Professional Wording Refinement (Plurality and Reordering)
        const currencyNamesMap: Record<string, [string, string]> = {
          "USD": ["US Dollars", "US Dollar"],
          "EUR": ["Euros", "Euro"],
          "GBP": ["Pounds", "Pound"],
          "AED": ["UAE Dirhams", "UAE Dirham"],
          "SAR": ["Saudi Riyals", "Saudi Riyal"],
          "SGD": ["Singapore Dollars", "Singapore Dollar"],
          "AUD": ["Australian Dollars", "Australian Dollar"],
          "CAD": ["Canadian Dollars", "Canadian Dollar"]
        };

        const pairs = currencyNamesMap[toCurrency]
        if (pairs) {
          const [plural, singular] = pairs
          const wordsLower = finalCombinedText.toLowerCase()
          const isSingular = (wordsLower.includes(" one ") || wordsLower.endsWith(" one") || wordsLower.includes(" single ")) &&
            !wordsLower.includes("hundred") && !wordsLower.includes("thousand") &&
            !wordsLower.includes("lakh") && !wordsLower.includes("crore") &&
            !wordsLower.includes("million") && !wordsLower.includes("billion")

          const correctName = isSingular ? singular : plural
          const otherName = isSingular ? plural : singular

          finalCombinedText = finalCombinedText
            .replace(new RegExp(`\\b${otherName}\\b`, "gi"), correctName)
            .replace(new RegExp(`\\b${correctName}\\b`, "gi"), correctName)

          const moveRegex = new RegExp(`(.*?)\\b(${correctName})\\b\\s+(.*?)\\s+(Only|only|only\\.|only\\/|only\\/\\-)$`, "i")
          const match = finalCombinedText.match(moveRegex)
          if (match) {
            finalCombinedText = `${match[1]}${match[3]} ${match[2]} ${match[4]}`
          }
        }
      }

      // 3. Final grouping and displacement logic
      if (isAmountReplacement && bounds) {
        // Handle "Balance Due" specific background override
        const sameLineGroups = groups.filter(g => Math.abs(g.y - group.y) < 5)
        const lineText = sameLineGroups.map(g => g.text.toLowerCase()).join(" ")
        const isBalanceDueLine = lineText.includes("balance") && lineText.includes("due")
        let targetBgColor = group.bgColor ?? undefined
        if (isBalanceDueLine) {
          targetBgColor = [245 / 255, 245 / 255, 245 / 255] // #F5F5F5
        }

        // Amount specific ReplacementOp
        ops.push({
          text: finalCombinedText,
          x: bounds.x,
          y: bounds.baseline,
          w: bounds.w,
          h: bounds.h,
          fontSize: group.fontSize,
          fontName: group.fontName,
          fontColor: group.items[0]?.fontColor,
          bgColor: targetBgColor,
          isAmount: true,
          isBold: isAmountReplacement && hasWordMatch ? true : false, // BOLD if it's part of Amount in Words
        })
      } else {
        // Redraw whole cohesive line for word-only matches
        ops.push({
          text: finalCombinedText,
          x: group.x,
          y: group.y,
          w: group.totalWidth,
          h: group.fontSize,
          fontSize: group.fontSize,
          fontName: group.fontName,
          fontColor: group.items[0]?.fontColor,
          bgColor: group.bgColor ?? undefined,
          isAmount: false,
          isBold: hasWordMatch, // BOLD the amount in words
        })
      }
    }
  }

  return ops
}

/**
 * Quality assurance: Validate conversion results
 */
function validateConversionResults(allOps: ReplacementOp[], originalText: string): {
  success: boolean
  issues: string[]
  summary: string
} {
  const issues: string[] = []
  let totalAmounts = 0
  let totalWords = 0

  for (const op of allOps) {
    if (op.text.match(/[\d,]+(?:\.\d{2})/)) {
      totalAmounts++
    } else {
      totalWords++
    }
  }

  // Check for potential issues
  if (totalAmounts === 0 && totalWords === 0) {
    issues.push("No currency conversions detected")
  }

  if (totalAmounts > 20) {
    issues.push("High number of amount conversions - may indicate false positives")
  }

  const summary = `Converted ${totalAmounts} amounts and ${totalWords} currency words`

  return {
    success: issues.length === 0,
    issues,
    summary
  }
}

/**
 * Performance optimization: Cache font embeddings
 */
const fontCache = new Map<string, any>()

async function getCachedFont(pdfDoc: any, fontName: string) {
  if (fontCache.has(fontName)) {
    return fontCache.get(fontName)
  }

  let font
  switch (fontName.toLowerCase()) {
    case 'helvetica':
      font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      break
    case 'helvetica-bold':
      font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      break
    case 'helvetica-oblique':
      font = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
      break
    case 'helvetica-bold-oblique':
      font = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
      break
    default:
      font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }

  fontCache.set(fontName, font)
  return font
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const toCurrency = formData.get("toCurrency") as string

    // Quality assurance: Input validation
    if (!file || !toCurrency) {
      return NextResponse.json(
        { error: "Missing file or currency" },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF file." },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      )
    }

    // Validate currency
    if (!CURRENCY_SYMBOLS[toCurrency]) {
      return NextResponse.json(
        { error: "Unsupported currency. Please select a valid currency." },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Step 1: Find text positions using pdfjs
    const pagesWithItems = await getTextItemsWithPositions(buffer)

    // Step 2: Use currency code as prefix for amounts (e.g. USD 6,000.00)
    const symbol = toCurrency + " "

    // Step 3: Load the original PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(arrayBuffer)

    // Performance optimization: Clear font cache for this conversion
    fontCache.clear()

    const pages = pdfDoc.getPages()
    let totalReplacements = 0
    let allConversionOps: ReplacementOp[] = []

    // Step 3: For each page, merge items, find amounts, overlay converted values
    for (const pageData of pagesWithItems) {
      if (pageData.pageIndex >= pages.length) continue
      const page = pages[pageData.pageIndex]

      // Merge adjacent items into groups
      const groups = mergeItemsIntoGroups(pageData.items)

      // Find all replacements for this page in a single pass
      const allOps = findReplacementsForGroups(groups, toCurrency, symbol)

      // Collect all operations for quality assurance
      allConversionOps.push(...allOps)

      // Apply each replacement using its precise substring bounds
      for (const op of allOps) {
        // Performance optimization: Use cached fonts
        const isBold = op.isBold || op.fontName.toLowerCase().includes('bold') || op.fontSize >= 14
        const isItalic = op.fontName.toLowerCase().includes('italic') || op.fontName.toLowerCase().includes('oblique')

        let fontName = 'helvetica'
        if (isBold && isItalic) fontName = 'helvetica-bold-oblique'
        else if (isBold) fontName = 'helvetica-bold'
        else if (isItalic) fontName = 'helvetica-oblique'

        const useFont = await getCachedFont(pdfDoc, fontName)

        // Calculate exact width of new text to allow right-alignment
        const newTextWidth = useFont.widthOfTextAtSize(op.text, op.fontSize)

        // Right-align amounts (as typical in tables), left-align words
        const textX = op.isAmount ? (op.x + op.w) - newTextWidth : op.x

        // Mask covers the union of ORIGINAL bounds and NEW bounds
        const maskX = Math.min(op.x, textX) - 1
        const maskW = Math.max(op.x + op.w, textX + newTextWidth) - maskX + 2

        // Helvetica metrics for accurate Y bounding (descender & full height)
        const descender = op.fontSize * 0.22
        const maskY = op.y - descender - 0.5
        const maskH = op.fontSize * 1.05 + 1.0

        // Enhance overlay background color using extracted pdf operation fill color, fallback to white
        const bgR = op.bgColor ? op.bgColor[0] : 1;
        const bgG = op.bgColor ? op.bgColor[1] : 1;
        const bgB = op.bgColor ? op.bgColor[2] : 1;

        // Enhanced overlay technique with exact masking
        page.drawRectangle({
          x: maskX,
          y: maskY,
          width: maskW,
          height: maskH,
          color: rgb(bgR, bgG, bgB),
          opacity: 1.0,
        })

        const fontCol = op.fontColor || [0, 0, 0]

        // Draw the text with enhanced positioning
        page.drawText(op.text, {
          x: textX,
          y: op.y,
          size: op.fontSize,
          font: useFont,
          color: rgb(fontCol[0], fontCol[1], fontCol[2]),
        })

        totalReplacements++
      }
    }

    // Quality assurance: Validate results
    const validation = validateConversionResults(allConversionOps, "")

    if (!validation.success) {
      console.warn("Conversion validation issues:", validation.issues)
      // Still proceed with conversion but log warnings
    }

    // Step 4: Save and return modified PDF
    const pdfBytes = await pdfDoc.save()
    const safeName = (file.name || "invoice").replace(/\.pdf$/i, "")

    // Add metadata for debugging
    const response = new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-converted-${toCurrency}.pdf"`,
        "X-Conversion-Summary": validation.summary,
        "X-Total-Replacements": totalReplacements.toString(),
      },
    })

    return response
  } catch (error) {
    console.error("PDF conversion error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate converted PDF",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
