// Knowledge Base - Contains all information for AI chatbot
// This data is used for RAG (Retrieval-Augmented Generation)

const knowledgeBase = [
  // Order & Shipping FAQs
  {
    id: 'order-1',
    content: 'Order Status: Orders typically take 1-2 business days to process, 3-7 business days for delivery. You can track your order in real-time through the "My Orders" page.',
    metadata: { category: 'orders', keywords: ['order', 'status', 'tracking', 'delivery time'] },
  },
  {
    id: 'order-2',
    content: 'Order Cancellation: Orders can be cancelled within 24 hours of placement if they are in "Pending" or "Confirmed" status. Go to "My Orders" and click the "Cancel" button.',
    metadata: { category: 'orders', keywords: ['cancel', 'cancellation', 'refund'] },
  },
  {
    id: 'order-3',
    content: 'Return Policy: We accept returns within 7 days of delivery. Products must be unused and in original packaging. Contact support to initiate a return.',
    metadata: { category: 'returns', keywords: ['return', 'refund', 'exchange', 'money back'] },
  },
  {
    id: 'order-4',
    content: 'Shipping Charges: Free shipping on orders above ₹500. For orders below ₹500, shipping charge is ₹40. We ship across India.',
    metadata: { category: 'shipping', keywords: ['shipping', 'delivery charges', 'free shipping'] },
  },
  {
    id: 'order-5',
    content: 'Payment Methods: We accept Razorpay (cards, UPI, net banking), Stripe, and Cash on Delivery (COD). All payments are secure and encrypted.',
    metadata: { category: 'payment', keywords: ['payment', 'pay', 'razorpay', 'cod', 'cash on delivery'] },
  },

  // Product FAQs
  {
    id: 'product-1',
    content: 'Product Availability: Products showing "In Stock" are available for immediate dispatch. "Out of Stock" items will be restocked soon. You can check product availability on the product page.',
    metadata: { category: 'products', keywords: ['stock', 'available', 'in stock', 'out of stock'] },
  },
  {
    id: 'product-2',
    content: 'Product Quality: All products are genuine and come with manufacturer warranty. We offer 7-day replacement for defective products.',
    metadata: { category: 'products', keywords: ['quality', 'warranty', 'genuine', 'defective'] },
  },
  {
    id: 'product-3',
    content: 'Product Categories: We have 6 main categories - Electronics, Clothing, Home & Garden, Sports & Fitness, Books, and Beauty & Health.',
    metadata: { category: 'products', keywords: ['categories', 'department', 'section'] },
  },

  // Account FAQs
  {
    id: 'account-1',
    content: 'Account Registration: Click "Sign Up" to create an account. You need to provide name, email, and password. You can also checkout as guest.',
    metadata: { category: 'account', keywords: ['register', 'signup', 'create account', 'new account'] },
  },
  {
    id: 'account-2',
    content: 'Password Reset: Click "Forgot Password" on the login page. Enter your email and we will send you a reset link.',
    metadata: { category: 'account', keywords: ['password', 'forgot', 'reset', 'login issue'] },
  },
  {
    id: 'account-3',
    content: 'Order History: View all your past orders by going to "My Orders" page. You can see order status, details, and track deliveries.',
    metadata: { category: 'account', keywords: ['order history', 'past orders', 'previous orders'] },
  },

  // Support FAQs
  {
    id: 'support-1',
    content: 'Customer Support: Our support team is available 24/7 via chat, email (support@ecommerce.com), or phone (1800-123-4567). Average response time is 5 minutes.',
    metadata: { category: 'support', keywords: ['support', 'help', 'contact', 'customer service'] },
  },
  {
    id: 'support-2',
    content: 'Escalation: If you are not satisfied with the resolution, you can ask to speak to a senior agent or manager. We are committed to resolving all issues.',
    metadata: { category: 'support', keywords: ['escalate', 'manager', 'complaint', 'unsatisfied'] },
  },
  {
    id: 'support-3',
    content: 'Response Time: AI chatbot responds instantly. Human agents typically respond within 5-10 minutes during business hours (9 AM - 9 PM IST).',
    metadata: { category: 'support', keywords: ['response time', 'how long', 'waiting', 'reply'] },
  },

  // Delivery FAQs
  {
    id: 'delivery-1',
    content: 'Delivery Tracking: Track your order in real-time. Delivery progress shows: 25% (Confirmed), 50% (Processing/Shipped), 75% (Out for Delivery), 100% (Delivered).',
    metadata: { category: 'delivery', keywords: ['track', 'tracking', 'progress', 'where is my order'] },
  },
  {
    id: 'delivery-2',
    content: 'Delivery Address: You can change delivery address before order is shipped. Go to "My Orders" and click "Change Address" or contact support.',
    metadata: { category: 'delivery', keywords: ['address', 'change address', 'wrong address', 'update address'] },
  },
  {
    id: 'delivery-3',
    content: 'Delivery Issues: If your order is delayed or not delivered, check tracking status first. If issue persists, contact support with your order ID.',
    metadata: { category: 'delivery', keywords: ['delayed', 'not delivered', 'missing', 'late'] },
  },

  // Refund FAQs
  {
    id: 'refund-1',
    content: 'Refund Process: Refunds are processed within 7-10 business days after we receive the returned product. Refund will be credited to original payment method.',
    metadata: { category: 'refund', keywords: ['refund', 'money back', 'return money', 'refund status'] },
  },
  {
    id: 'refund-2',
    content: 'Refund Status: Check refund status in "My Orders" page. It shows: Initiated, Processing, Completed. You will receive email confirmation.',
    metadata: { category: 'refund', keywords: ['refund status', 'when will i get refund', 'refund tracking'] },
  },

  // Product Recommendations Context
  {
    id: 'rec-1',
    content: 'Popular Products: Wireless Bluetooth Headphones (₹2,999), Smart Watch Pro (₹4,999), Nike Running Shoes (₹2,499), Laptop Stand (₹1,499)',
    metadata: { category: 'recommendations', keywords: ['popular', 'best seller', 'trending', 'recommended'] },
  },
  {
    id: 'rec-2',
    content: 'Budget Products: Under ₹1000 - Cotton T-Shirt (₹599), Face Moisturizer (₹499), Resistance Bands (₹599), Organic Lip Balm (₹299)',
    metadata: { category: 'recommendations', keywords: ['cheap', 'budget', 'under 1000', 'affordable'] },
  },
  {
    id: 'rec-3',
    content: 'Premium Products: Smart Watch Pro (₹4,999), Mechanical Keyboard (₹3,499), Dumbbells Set (₹3,999), Winter Jacket (₹3,499)',
    metadata: { category: 'recommendations', keywords: ['premium', 'expensive', 'high quality', 'best'] },
  },
];

/**
 * Get all knowledge base documents
 * @returns {Array} All documents
 */
function getAllDocuments() {
  return knowledgeBase;
}

/**
 * Get documents by category
 * @param {string} category - Category name
 * @returns {Array} Filtered documents
 */
function getDocumentsByCategory(category) {
  return knowledgeBase.filter(doc => doc.metadata.category === category);
}

/**
 * Get documents by keywords
 * @param {string} query - Search query
 * @returns {Array} Matching documents
 */
function getDocumentsByKeywords(query) {
  const lowerQuery = query.toLowerCase();
  const keywords = lowerQuery.split(/\s+/);
  
  return knowledgeBase.filter(doc => {
    const docKeywords = doc.metadata.keywords || [];
    return keywords.some(keyword => 
      docKeywords.some(docKeyword => docKeyword.includes(keyword))
    );
  });
}

module.exports = {
  knowledgeBase,
  getAllDocuments,
  getDocumentsByCategory,
  getDocumentsByKeywords,
};
