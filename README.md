# E-Commerce Checkout Engine

A full-stack e-commerce application with complete checkout flow, payment integration, and admin dashboard.

## 🚀 Features

### Customer Features
- **User Authentication** - JWT-based auth with secure cookies
- **Product Browsing** - Search, filter, and sort products
- **Shopping Cart** - Add/update/remove items with stock validation
- **Checkout Flow** - Two-step process with payment method selection
- **Order Management** - View order history and status
- **Payment Integration** - Razorpay (Card/UPI) and Cash on Delivery

### Admin Features
- **Dashboard** - Real-time statistics and metrics
- **Order Management** - Update status, view details, track history
- **Product Management** - CRUD operations with image management
- **Category Management** - Organize products with categories
- **Customer Management** - View customer stats and order history
- **Financial Ledger** - Track all transactions with filters

### Technical Features
- **MongoDB Transactions** - Atomic operations for order creation
- **Idempotency Keys** - Prevent duplicate orders
- **Role-Based Access** - Admin and Customer roles
- **Error Handling** - Comprehensive error management
- **Responsive Design** - Mobile, tablet, and desktop support

## 🛠️ Tech Stack

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Razorpay Integration
- Jest Testing

### Frontend
- React 18 + Vite
- React Router v6
- Context API for state management
- CSS3 with modern features

## 📦 Installation

### Prerequisites
- Node.js (v16+)
- MongoDB Atlas account
- Razorpay account (for payments)

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/Chaitanya-Bhorde/ecommerce-checkout-engine.git
cd ecommerce-checkout-engine
```

2. **Install dependencies**
```bash
npm install
cd client && npm install && cd ..
```

3. **Configure environment variables**

Create `.env` file in root directory:
```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# MongoDB
MONGODB_URI=your_mongodb_atlas_uri

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

4. **Run the application**
```bash
# Development (both frontend and backend)
npm run dev:all

# Or run separately:
# Backend
npm run dev

# Frontend (in new terminal)
npm run client:dev
```

5. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## 🧪 Testing

```bash
# Run backend tests
npm test

# Run with coverage
npm run test:coverage
```

## 📁 Project Structure

```
ecommerce-checkout-engine/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts (Auth)
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
│   └── package.json
├── src/                   # Express backend
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   └── app.js            # Express app
├── package.json
└── README.md
```

## 🔐 Default Admin Account

To create an admin user, you can use the seed script or register a user and manually update their role in MongoDB:

```javascript
// In MongoDB Atlas or mongosh
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

## 📊 Database Models

### User
- name, email, password, role (customer/admin)
- Password hashing with bcrypt

### Product
- name, description, price, stock, category
- images array, isActive flag
- Category reference

### Category
- name, description, isActive

### Cart
- user reference
- items array (product, quantity, price)

### Order
- user, items, shippingAddress
- payment info, status, statusHistory
- Subtotal, tax, shipping, total

### Ledger
- order, user references
- type (payment/refund)
- amount, paymentMethod, status

### Idempotency
- key, user, response
- expiresAt (24h TTL)

## 🔄 Order Flow

1. **Cart Review** → User reviews cart items
2. **Shipping Address** → Fill shipping details
3. **Payment Method** → Select Razorpay or COD
4. **Order Creation** → Backend creates order with transaction
5. **Payment** → Razorpay checkout (if selected)
6. **Verification** → Payment signature verification
7. **Confirmation** → Order confirmation page

## 🎨 Admin Features

### Dashboard
- Total Revenue, Orders, Customers
- Pending orders count
- Product/Category counts
- Recent orders table

### Order Management
- View all orders with pagination
- Filter by status
- Update order status
- View detailed order info
- Track status history

### Product Management
- Grid view with images
- Add/Edit/Delete products
- Activate/Deactivate toggle
- Stock management

### Category Management
- Table view
- Add/Edit/Delete categories
- Activate/Deactivate toggle

### Customer Management
- Customer list
- Order statistics per customer
- Recent orders view

### Financial Ledger
- Transaction history
- Filter by status/type/date
- Summary statistics
- Payment method tracking

## 🔒 Security

- JWT authentication with httpOnly cookies
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Idempotency keys for duplicate prevention
- Input validation and sanitization
- CORS configuration

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (admin)
- `PUT /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add to cart
- `PUT /api/cart/:itemId` - Update cart item
- `DELETE /api/cart/:itemId` - Remove from cart
- `DELETE /api/cart` - Clear cart

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id/cancel` - Cancel order

### Payments
- `POST /api/payments/create/:orderId` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment
- `GET /api/payments/status/:orderId` - Get payment status
- `GET /api/payments/ledger` - Get ledger entries (admin)

### Admin
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/orders` - List all orders (admin)
- `GET /api/admin/orders/:id` - Get order details (admin)
- `PUT /api/admin/orders/:id/status` - Update order status (admin)
- `GET /api/admin/customers` - List customers (admin)
- `GET /api/admin/customers/:id` - Customer details (admin)
- `GET /api/admin/ledger` - Get ledger with filters (admin)

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
CLIENT_URL=https://your-domain.com
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=your_secure_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### Deploy to Vercel (Frontend)
```bash
cd client
vercel --prod
```

### Deploy to Railway/Render (Backend)
- Connect GitHub repository
- Set environment variables
- Deploy automatically on push

## 📝 License

ISC

## 👨‍💻 Author

Built with ❤️ by Chaitanya Bhorde

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

## 📞 Support

For support, email chaitanyabhorde@gmail.com