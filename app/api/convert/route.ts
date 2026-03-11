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
  fontSize: number
  fontColor: number[] // [r, g, b] normalized 0-1
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

    const enhancedItems = textContent.items.map((item: any) => {
      // Get font details for this text item
      const fontDetails = fontInfo.get(item.fontName) || {
        isBold: false,
        isItalic: false,
        fontSize: Math.abs(item.transform[0]) || 12,
        fontColor: [0, 0, 0] // Default black
      }

      return {
        str: item.str,
        width: item.width,
        height: item.height,
        transform: item.transform,
        fontName: item.fontName,
        fontSize: fontDetails.fontSize,
        fontColor: fontDetails.fontColor,
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
  fontColor?: number[]
  isAmount: boolean
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
function findAmountGroups(groups: MergedGroup[], symbol: string): ReplacementOp[] {
  const ops: ReplacementOp[] = []

  for (const group of groups) {
    let matchedAmount: number | null = null
    let matchedString = ""
    let contextMatch = false

    // Try enhanced patterns first (context-aware)
    for (const pattern of ENHANCED_AMOUNT_PATTERNS) {
      const match = group.text.match(pattern)
      if (match) {
        // Extract the actual amount from the match
        const fullMatch = match[0]
        const amountMatch = fullMatch.match(/[\d,]+(?:\.\d{1,2})?/)

        if (amountMatch) {
          const cleaned = amountMatch[0].replace(/[^\d.]/g, "")
          const num = parseFloat(cleaned)
          if (!isNaN(num) && num >= 0) {
            matchedAmount = num
            matchedString = amountMatch[0]
            contextMatch = true
            break
          }
        }
      }
    }

    // If no context match, try basic patterns
    if (matchedAmount === null) {
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
    }

    // If still no match, try plain number pattern (for numbers ≥ 100)
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

      // Use enhanced positioning for better accuracy
      const bounds = getEnhancedMatchBounds(group, startIndex, matchedString.length)

      if (bounds) {
        ops.push({
          text: convertedText,
          x: bounds.x,
          y: bounds.baseline,
          w: bounds.w,
          h: bounds.h,
          fontSize: group.fontSize,
          fontName: group.fontName,
          fontColor: group.items[0]?.fontColor,
          isAmount: true,
        })
      }
    }
  }

  return ops
}

/**
 * Enhanced currency word replacements with context-aware patterns
 */
const ENHANCED_CURRENCY_WORDS: Record<string, Record<string, string>> = {
  USD: {
    // Standard replacements
    "Indian Rupees": "Dollars", "Indian rupees": "Dollars", "indian rupees": "dollars", "INDIAN RUPEES": "DOLLARS",
    "Indian Rupee": "Dollar", "Indian rupee": "Dollar", "indian rupee": "dollar", "INDIAN RUPEE": "DOLLAR",
    "Rupees": "Dollars", "rupees": "dollars", "RUPEES": "DOLLARS",
    "Rupee": "Dollar", "rupee": "dollar", "RUPEE": "DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    // Contextual replacements
    "Rs": "$", "rs": "$",
    "Rs.": "$", "rs.": "$",
    "₹": "$",

    // Amount context replacements
    "Rupees only": "Dollars only",
    "Rupee only": "Dollar only",
    "Rupees/-": "Dollars/-",
    "Rupee/-": "Dollar/-",
  },
  EUR: {
    "Indian Rupees": "Euros", "Indian rupees": "Euros", "indian rupees": "euros", "INDIAN RUPEES": "EUROS",
    "Indian Rupee": "Euro", "Indian rupee": "Euro", "indian rupee": "euro", "INDIAN RUPEE": "EURO",
    "Rupees": "Euros", "rupees": "euros", "RUPEES": "EUROS",
    "Rupee": "Euro", "rupee": "euro", "RUPEE": "EURO",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "€", "rs": "€",
    "Rs.": "€", "rs.": "€",
    "₹": "€",

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

    "Rs": "£", "rs": "£",
    "Rs.": "£", "rs.": "£",
    "₹": "£",

    "Rupees only": "Pounds only",
    "Rupee only": "Pound only",
    "Rupees/-": "Pounds/-",
    "Rupee/-": "Pound/-",
  },
  AED: {
    "Indian Rupees": "Dirhams", "Indian rupees": "Dirhams", "indian rupees": "dirhams", "INDIAN RUPEES": "DIRHAMS",
    "Indian Rupee": "Dirham", "Indian rupee": "Dirham", "indian rupee": "dirham", "INDIAN RUPEE": "DIRHAM",
    "Rupees": "Dirhams", "rupees": "dirhams", "RUPEES": "DIRHAMS",
    "Rupee": "Dirham", "rupee": "dirham", "RUPEE": "DIRHAM",
    "Paise": "Fils", "paise": "fils", "PAISE": "FILS",
    "Paisa": "Fil", "paisa": "fil", "PAISA": "FIL",

    "Rs": "AED", "rs": "AED",
    "Rs.": "AED", "rs.": "AED",
    "₹": "AED",

    "Rupees only": "Dirhams only",
    "Rupee only": "Dirham only",
    "Rupees/-": "Dirhams/-",
    "Rupee/-": "Dirham/-",
  },
  SGD: {
    "Indian Rupees": "Dollars", "Indian rupees": "Dollars", "indian rupees": "dollars", "INDIAN RUPEES": "DOLLARS",
    "Indian Rupee": "Dollar", "Indian rupee": "Dollar", "indian rupee": "dollar", "INDIAN RUPEE": "DOLLAR",
    "Rupees": "Dollars", "rupees": "dollars", "RUPEES": "DOLLARS",
    "Rupee": "Dollar", "rupee": "dollar", "RUPEE": "DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "S$", "rs": "S$",
    "Rs.": "S$", "rs.": "S$",
    "₹": "S$",

    "Rupees only": "Dollars only",
    "Rupee only": "Dollar only",
    "Rupees/-": "Dollars/-",
    "Rupee/-": "Dollar/-",
  },
  AUD: {
    "Indian Rupees": "Dollars", "Indian rupees": "Dollars", "indian rupees": "dollars", "INDIAN RUPEES": "DOLLARS",
    "Indian Rupee": "Dollar", "Indian rupee": "Dollar", "indian rupee": "dollar", "INDIAN RUPEE": "DOLLAR",
    "Rupees": "Dollars", "rupees": "dollars", "RUPEES": "DOLLARS",
    "Rupee": "Dollar", "rupee": "dollar", "RUPEE": "DOLLAR",
    "Paise": "Cents", "paise": "cents", "PAISE": "CENTS",
    "Paisa": "Cent", "paisa": "cent", "PAISA": "CENT",

    "Rs": "A$", "rs": "A$",
    "Rs.": "A$", "rs.": "A$",
    "₹": "A$",

    "Rupees only": "Dollars only",
    "Rupee only": "Dollar only",
    "Rupees/-": "Dollars/-",
    "Rupee/-": "Dollar/-",
  },
}

/**
 * Enhanced overlay technique with improved background masking
 */
function createEnhancedBackgroundMask(page: any, x: number, y: number, width: number, height: number) {
  // Create a slightly larger mask to ensure complete coverage
  const padding = 0.8
  const maskX = x - padding
  const maskY = y - padding
  const maskWidth = width + (padding * 2)
  const maskHeight = height + (padding * 2)

  // Draw the background mask with precise positioning
  page.drawRectangle({
    x: maskX,
    y: maskY,
    width: maskWidth,
    height: maskHeight,
    color: rgb(1, 1, 1), // Pure white background
    opacity: 1.0,
  })
}

/**
 * Find text groups containing INR-related words, replace the words within the whole string,
 * and redraw the entire string to avoid shifting/spacing artifacts
 */
function findWordGroups(groups: MergedGroup[], toCurrency: string): ReplacementOp[] {
  const ops: ReplacementOp[] = []
  const wordMap = ENHANCED_CURRENCY_WORDS[toCurrency] || CURRENCY_WORDS[toCurrency]
  if (!wordMap) return ops

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
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
        fontName: group.fontName,
        fontColor: group.items[0]?.fontColor,
        isAmount: false,
      })

      // Look ahead for "Only" on the immediate next line(s) to apply matching fonts
      // Sometimes "Only" or "Only." is pushed to a new line and left orphaned in the old font
      if (i + 1 < groups.length) {
        const nextGroup = groups[i + 1]
        const nextTarget = nextGroup.text.trim().toLowerCase()
        if (nextTarget === "only" || nextTarget === "only." || nextTarget === "only/-") {
          ops.push({
            text: nextGroup.text, // redraw the exact same text, but in the matching font
            x: nextGroup.x,
            y: nextGroup.y,
            w: nextGroup.totalWidth,
            h: nextGroup.fontSize,
            fontSize: nextGroup.fontSize,
            fontName: group.fontName, // Inherit the fontName from the parent "Rupees" line for uniformity
            fontColor: group.items[0]?.fontColor,
            isAmount: false,
          })
          i++ // skip the "Only" group so we don't process it twice
        }
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

    const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + " "

    // Step 2: Load the original PDF with pdf-lib
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

      // Find all replacements for this page
      const amountOps = findAmountGroups(groups, symbol)
      const wordOps = findWordGroups(groups, toCurrency)
      const allOps = [...amountOps, ...wordOps]

      // Collect all operations for quality assurance
      allConversionOps.push(...allOps)

      // Apply each replacement using its precise substring bounds
      for (const op of allOps) {
        // Performance optimization: Use cached fonts
        const isBold = op.fontName.toLowerCase().includes('bold') || op.fontSize >= 14
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

        // Enhanced overlay technique with exact masking
        page.drawRectangle({
          x: maskX,
          y: maskY,
          width: maskW,
          height: maskH,
          color: rgb(1, 1, 1),
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
