const express = require('express');
const router = express.Router();
const {
  getAllOrders,
  updateOrderStatus,
  getOrderById,
} = require('../controllers/orderController');
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { getLedgerEntries, getAllLedgerEntries } = require('../controllers/paymentController');
const { validateOrderStatus } = require('../controllers/orderController');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { protect, admin } = require('../middleware/authMiddleware');

router.use(protect);
router.use(admin);

// Dashboard Stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    console.log('[Admin Dashboard] Fetching stats...');
    
    const [
      totalRevenue,
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalProducts,
      activeProducts,
      totalCategories,
      activeCategories,
    ] = await Promise.all([
      // Total revenue from completed orders
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]).catch(err => {
        console.error('[Admin Dashboard] Error fetching revenue:', err);
        return [{ total: 0 }];
      }),
      // Total orders
      Order.countDocuments().catch(err => {
        console.error('[Admin Dashboard] Error fetching orders:', err);
        return 0;
      }),
      // Pending orders
      Order.countDocuments({ status: 'pending' }).catch(err => {
        console.error('[Admin Dashboard] Error fetching pending orders:', err);
        return 0;
      }),
      // Total customers
      User.countDocuments({ role: 'customer' }).catch(err => {
        console.error('[Admin Dashboard] Error fetching customers:', err);
        return 0;
      }),
      // Total products
      Product.countDocuments().catch(err => {
        console.error('[Admin Dashboard] Error fetching products:', err);
        return 0;
      }),
      // Active products
      Product.countDocuments({ isActive: true }).catch(err => {
        console.error('[Admin Dashboard] Error fetching active products:', err);
        return 0;
      }),
      // Total categories
      Category.countDocuments().catch(err => {
        console.error('[Admin Dashboard] Error fetching categories:', err);
        return 0;
      }),
      // Active categories
      Category.countDocuments({ isActive: true }).catch(err => {
        console.error('[Admin Dashboard] Error fetching active categories:', err);
        return 0;
      }),
    ]);

    console.log('[Admin Dashboard] Stats fetched successfully');

    res.json({
      revenue: totalRevenue[0]?.total || 0,
      orders: {
        total: totalOrders,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
      },
      categories: {
        total: totalCategories,
        active: activeCategories,
      },
    });
  } catch (error) {
    console.error('[Admin Dashboard] Error fetching stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard stats',
      error: error.message 
    });
  }
});

// Orders Management
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email')
        .populate('items.product', 'name price images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('items.product', 'name price images');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/orders/:orderId/status', validateOrderStatus, updateOrderStatus);

// Products Management
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find()
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(),
    ]);

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Categories Management
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Customers Management
router.get('/customers', async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ customers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/customers/:customerId', async (req, res) => {
  try {
    const customer = await User.findById(req.params.customerId).select('-password');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer order stats
    const [orderStats, recentOrders] = await Promise.all([
      Order.aggregate([
        { $match: { user: customer._id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$total' },
            lastOrderDate: { $max: '$createdAt' },
          },
        },
      ]),
      Order.find({ user: customer._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id total status createdAt'),
    ]);

    res.json({
      ...customer.toObject(),
      orderStats: orderStats[0] || { totalOrders: 0, totalSpent: 0, lastOrderDate: null },
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ledger/Financial
router.get('/ledger', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type, startDate, endDate } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      require('../models/Ledger').find(filter)
        .populate('order', 'total status')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      require('../models/Ledger').countDocuments(filter),
    ]);

    const summary = await require('../models/Ledger').aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
      summary: summary[0] || { totalEntries: 0, totalAmount: 0 },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;