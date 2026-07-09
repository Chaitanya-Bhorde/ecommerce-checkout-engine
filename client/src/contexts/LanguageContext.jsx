import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    app: { name: 'ShopEase', tagline: 'Your One-Stop Shop' },
    nav: { products: 'Products', cart: 'Cart', orders: 'Orders', chat: 'AI Chat', login: 'Login', register: 'Register', logout: 'Logout', hello: 'Hi' },
    product: { addToCart: 'Add to Cart', outOfStock: 'Out of Stock', inStock: 'In Stock', reviews: 'Reviews', writeReview: 'Write a Review', addToWishlist: 'Add to Wishlist', removeWishlist: 'Remove from Wishlist', category: 'Category', price: 'Price', description: 'Description' },
    cart: { title: 'Shopping Cart', empty: 'Your cart is empty', checkout: 'Proceed to Checkout', remove: 'Remove', total: 'Total', subtotal: 'Subtotal', tax: 'Tax (18% GST)', shipping: 'Shipping', free: 'FREE' },
    order: { title: 'My Orders', noOrders: 'No orders yet', viewDetails: 'View Details', downloadInvoice: 'Download Invoice', cancelOrder: 'Cancel Order' },
    checkout: { title: 'Checkout', shipping: 'Shipping Address', payment: 'Payment Method', placeOrder: 'Place Order', processing: 'Processing...', fullName: 'Full Name', phone: 'Phone Number', address: 'Address', city: 'City', state: 'State', pincode: 'Pincode' },
    admin: { dashboard: 'Admin Dashboard', orders: 'Order Management', products: 'Products', customers: 'Customers', ledger: 'Ledger', analytics: 'AI Analytics', support: 'Support Tickets' },
    review: { rating: 'Rating', title: 'Review Title', comment: 'Your Review', submit: 'Submit Review', noReviews: 'No reviews yet', verified: 'Verified Purchase', avgRating: 'Average Rating' },
    chat: { title: 'AI Assistant', placeholder: 'Type your message...', send: 'Send', newChat: 'New Chat', online: 'Online', close: 'Close' },
    common: { loading: 'Loading...', error: 'Error', success: 'Success', confirm: 'Confirm', cancel: 'Cancel', search: 'Search', filter: 'Filter', all: 'All', noData: 'No data found' },
    theme: { light: 'Light', dark: 'Dark', language: 'Language' },
    notif: { title: 'Notifications', noNotif: 'No notifications yet', markAllRead: 'Mark all as read' },
  },
  hi: {
    app: { name: 'शॉपईज़', tagline: 'आपकी एक-स्टॉप दुकान' },
    nav: { products: 'उत्पाद', cart: 'कार्ट', orders: 'ऑर्डर', chat: 'एआई चैट', login: 'लॉगिन', register: 'पंजीकरण', logout: 'लॉगआउट', hello: 'नमस्ते' },
    product: { addToCart: 'कार्ट में डालें', outOfStock: 'स्टॉक खत्म', inStock: 'स्टॉक में', reviews: 'समीक्षाएं', writeReview: 'समीक्षा लिखें', addToWishlist: 'इच्छा-सूची में जोड़ें', removeWishlist: 'इच्छा-सूची से हटाएं', category: 'श्रेणी', price: 'मूल्य', description: 'विवरण' },
    cart: { title: 'शॉपिंग कार्ट', empty: 'आपकी कार्ट खाली है', checkout: 'चेकआउट करें', remove: 'हटाएं', total: 'कुल', subtotal: 'उप-योग', tax: 'कर (18% जीएसटी)', shipping: 'शिपिंग', free: 'मुफ्त' },
    order: { title: 'मेरे ऑर्डर', noOrders: 'अभी तक कोई ऑर्डर नहीं', viewDetails: 'विवरण देखें', downloadInvoice: 'चालान डाउनलोड करें', cancelOrder: 'ऑर्डर रद्द करें' },
    checkout: { title: 'चेकआउट', shipping: 'शिपिंग पता', payment: 'भुगतान विधि', placeOrder: 'ऑर्डर करें', processing: 'प्रोसेसिंग...', fullName: 'पूरा नाम', phone: 'फोन नंबर', address: 'पता', city: 'शहर', state: 'राज्य', pincode: 'पिनकोड' },
    admin: { dashboard: 'एडमिन डैशबोर्ड', orders: 'ऑर्डर प्रबंधन', products: 'उत्पाद', customers: 'ग्राहक', ledger: 'लेज़र', analytics: 'एआई विश्लेषण', support: 'सहायता टिकट' },
    review: { rating: 'रेटिंग', title: 'समीक्षा शीर्षक', comment: 'आपकी समीक्षा', submit: 'समीक्षा जमा करें', noReviews: 'अभी तक कोई समीक्षा नहीं', verified: 'सत्यापित खरीद', avgRating: 'औसत रेटिंग' },
    chat: { title: 'एआई सहायक', placeholder: 'अपना संदेश लिखें...', send: 'भेजें', newChat: 'नई चैट', online: 'ऑनलाइन', close: 'बंद करें' },
    common: { loading: 'लोड हो रहा है...', error: 'त्रुटि', success: 'सफलता', confirm: 'पुष्टि करें', cancel: 'रद्द करें', search: 'खोजें', filter: 'फ़िल्टर', all: 'सभी', noData: 'कोई डेटा नहीं मिला' },
    theme: { light: 'लाइट', dark: 'डार्क', language: 'भाषा' },
    notif: { title: 'सूचनाएं', noNotif: 'अभी तक कोई सूचना नहीं', markAllRead: 'सभी पढ़ी हुई चिह्नित करें' },
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  const toggleLang = () => setLang(prev => prev === 'en' ? 'hi' : 'en');

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};