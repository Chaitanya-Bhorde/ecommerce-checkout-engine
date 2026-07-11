// PDF Parser Service - Extracts text and order details from PDF receipts
// Uses AI (Groq/LLM) for intelligent text parsing instead of brittle regex patterns
const { PDFParse } = require('pdf-parse');
const { callLLM } = require('./llmConfig');

async function extractTextFromPDF(filePath) {
  try {
    const fs = require('fs');
    const dataBuffer = fs.readFileSync(filePath);
    // pdf-parse v2.x requires Uint8Array, not Buffer
    const uint8Array = new Uint8Array(dataBuffer);
    const pdf = new PDFParse(uint8Array);
    await pdf.load();
    // getText takes an options object (or empty for all pages)
    const result = await pdf.getText({});
    // Result has a 'pages' array where each page has 'text' property
    const text = result.pages.map(p => p.text).join('\n');
    return text || '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Parse order details from raw PDF text using AI (Groq/LLM)
 * This is MUCH more reliable than regex patterns since it understands
 * context and can handle any invoice format.
 */
async function parseOrderDetailsWithAI(text) {
  const systemPrompt = `You are a receipt/invoice parser. Extract order details from the given text and return ONLY a valid JSON object with these fields:
{
  "orderId": "string or null",
  "orderNumber": "string or null",
  "date": "string or null",
  "total": "number or null",
  "status": "string or null",
  "items": [{"name": "string", "quantity": "number", "price": "number"}],
  "customerName": "string or null",
  "shippingAddress": "string or null",
  "paymentMethod": "string or null",
  "paymentId": "string or null"
}

Rules:
- Extract ALL line items/products with their quantities and prices
- Convert total to a number (remove currency symbols, commas)
- For dates, return in YYYY-MM-DD format if possible
- If a field is not found, use null (do NOT make up values)
- Return ONLY the JSON object, no other text`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract order details from this receipt text:\n\n${text}` }
    ];

    const response = await callLLM(messages, { maxTokens: 1000, temperature: 0.1, timeout: 30000 });
    
    // Parse the JSON response (handle markdown code blocks if present)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const orderDetails = JSON.parse(jsonStr);
    
    // Validate and clean up
    const defaultDetails = {
      orderId: null,
      orderNumber: null,
      date: null,
      total: null,
      status: null,
      items: [],
      customerName: null,
      shippingAddress: null,
      paymentMethod: null,
      paymentId: null,
    };

    return { ...defaultDetails, ...orderDetails };
  } catch (error) {
    console.error('[PDF Parser] AI parsing failed, falling back to regex:', error.message);
    return null; // Signal fallback
  }
}

/**
 * Legacy regex-based parsing as fallback when AI is unavailable
 */
function parseOrderDetailsFromText(text) {
  const orderDetails = {
    orderId: null,
    orderNumber: null,
    date: null,
    total: null,
    status: null,
    items: [],
    customerName: null,
    shippingAddress: null,
    paymentMethod: null,
    paymentId: null,
  };

  try {
    console.log('[PDF Parser] Fallback regex parsing...');

    // Extract Order ID/Number
    const orderIdPatterns = [
      /Invoice\s*#?\s*[:\s]+INV-([A-Za-z0-9-]{8,})/i,
      /Order\s*#?\s*[:\s]+([A-Za-z0-9]{16,})/i,
      /Order\s+#?\s*([A-Za-z0-9]{16,})/i,
      /Invoice\s*#?\s*[:\s]+([A-Za-z0-9-]{8,})/i,
      /Order\s+ID[:\s]+([A-Za-z0-9]{8,})/i,
      /(?:txn|TXN)[_-]([A-Za-z0-9]{10,})/i,
    ];

    for (const pattern of orderIdPatterns) {
      const match = text.match(pattern);
      if (match) {
        orderDetails.orderNumber = '#' + match[1];
        orderDetails.orderId = match[1];
        break;
      }
    }

    // Extract Date
    const datePatterns = [
      /Date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /Order\s+Date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        orderDetails.date = match[1];
        break;
      }
    }

    // Extract Total Amount
    const totalPatterns = [
      /Grand\s+Total[:\s]+[₹$]?\s*([\d,]+\.?\d*)/i,
      /Total[:\s]+[₹$]?\s*([\d,]+\.?\d*)/i,
      /Amount\s+Payable[:\s]+[₹$]?\s*([\d,]+\.?\d*)/i,
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        orderDetails.total = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // Extract Status
    const statusKeywords = {
      'pending': 'pending',
      'confirmed': 'confirmed',
      'processing': 'processing',
      'shipped': 'shipped',
      'out for delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
    };

    for (const [keyword, status] of Object.entries(statusKeywords)) {
      if (text.toLowerCase().includes(keyword)) {
        orderDetails.status = status;
        break;
      }
    }

    // Extract Items
    const itemPatterns = [
      /([A-Za-z][A-Za-z0-9\s\-\(\)]{3,50})\s+(\d+)\s+[x×]\s+[₹$]?\s*([\d,]+\.?\d{2})/g,
      /(\d+)\s+[x×]\s+([A-Za-z][A-Za-z0-9\s\-\(\)]{3,50})\s+[₹$]?\s*([\d,]+\.?\d{2})/g,
    ];

    for (const pattern of itemPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        orderDetails.items = matches.slice(0, 10).map(match => {
          const name = match[1] || match[2];
          const qty = parseInt(match[2] || match[1]);
          const price = parseFloat((match[3] || '0').replace(/,/g, ''));
          return { name: name.trim(), quantity: qty, price };
        }).filter(item => item.name && item.quantity > 0 && item.price > 0);
        if (orderDetails.items.length > 0) break;
      }
    }

    // Extract Customer Name
    const namePatterns = [
      /Bill\s+To[:\s]+([A-Za-z\s]{2,50})/i,
      /Customer\s+Name[:\s]+([A-Za-z\s]{2,50})/i,
      /^([A-Za-z][A-Za-z\s]{2,50})$/m,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        orderDetails.customerName = match[1].trim();
        break;
      }
    }

    // Extract Payment Method
    if (text.toLowerCase().includes('razorpay') || text.toLowerCase().includes('online payment')) {
      orderDetails.paymentMethod = 'razorpay';
    } else if (text.toLowerCase().includes('cash on delivery') || text.toLowerCase().includes('cod')) {
      orderDetails.paymentMethod = 'cod';
    }

    // Extract Payment ID
    const paymentIdPatterns = [
      /Payment\s+ID[:\s]+([A-Z0-9]+)/i,
      /Transaction\s+ID[:\s]+([A-Z0-9]+)/i,
    ];

    for (const pattern of paymentIdPatterns) {
      const match = text.match(pattern);
      if (match) {
        orderDetails.paymentId = match[1];
        break;
      }
    }

    return orderDetails;
  } catch (error) {
    console.error('Error parsing order details:', error);
    return orderDetails;
  }
}

async function processReceiptPDF(filePath) {
  try {
    const text = await extractTextFromPDF(filePath);
    
    // Step 1: Try AI-powered parsing (much more reliable)
    let orderDetails = await parseOrderDetailsWithAI(text);
    
    // Step 2: Fallback to regex if AI fails
    if (!orderDetails) {
      console.log('[PDF Parser] Falling back to regex parsing');
      orderDetails = parseOrderDetailsFromText(text);
    }

    return {
      success: true,
      text: text,
      orderDetails: orderDetails,
    };
  } catch (error) {
    console.error('Error processing receipt PDF:', error);
    return {
      success: false,
      error: error.message,
      text: null,
      orderDetails: null,
    };
  }
}

module.exports = {
  extractTextFromPDF,
  parseOrderDetailsFromText,
  parseOrderDetailsWithAI,
  processReceiptPDF,
};