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
      ]),
      // Total orders
      Order.countDocuments(),
      // Pending orders
      Order.countDocuments({ status: 'pending' }),
      // Total customers
      User.countDocuments({ role: 'customer' }),
      // Total products
      Product.countDocuments(),
      // Active products
      Product.countDocuments({ isActive: true }),
      // Total categories
      Category.countDocuments(),
      // Active categories
      Category.countDocuments({ isActive: true }),
    ]);

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
    res.status(500).json({ message: error.message });
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

router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { status, note } = req.body;

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: ['received', 'refunded'],
      received: [],
      cancelled: [],
      refunded: [],
    };

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const allowedTransitions = validTransitions[order.status];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from ${order.status} to ${status}`,
      });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: note || '',
    });

    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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