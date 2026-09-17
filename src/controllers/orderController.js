const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Ledger = require('../models/Ledger');
const { body, validationResult } = require('express-validator');

const validateOrderCreation = [
  body('shippingAddress')
    .isObject()
    .withMessage('Shipping address is required'),
  body('shippingAddress.address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('shippingAddress.state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('shippingAddress.zipCode')
    .trim()
    .notEmpty()
    .withMessage('Zip code is required')
    .isLength({ min: 3, max: 10 })
    .withMessage('Zip code must be between 3 and 10 characters'),
  body('shippingAddress.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters'),
  body('shippingAddress.phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('paymentMethod')
    .optional()
    .isIn(['razorpay', 'cod'])
    .withMessage('Invalid payment method')
];

const validateOrderStatus = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'received', 'cancelled', 'refunded'])
    .withMessage('Invalid status value'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note must be less than 500 characters')
];

const createOrder = async (req, res) => {
  // Idempotency is enforced solely by idempotencyMiddleware (mounted on
  // POST /api/orders) — the single source of truth. No duplicate pre-check here.

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { shippingAddress, paymentMethod, paymentId, orderId } = req.body;

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product.isActive) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `${product.name} is no longer available`,
        });
      }

      // Atomic stock guard: the conditional decrement only matches when enough
      // stock exists, so concurrent checkouts cannot oversell inventory.
      const decremented = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: cartItem.quantity } },
        { $inc: { stock: -cartItem.quantity } },
        { session, new: true }
      );

      if (!decremented) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const itemTotal = product.price * cartItem.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        quantity: cartItem.quantity,
        price: product.price,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    const tax = Math.round(subtotal * 0.18);
    const shippingCost = subtotal >= 500 ? 0 : 40;
    const total = subtotal + tax + shippingCost;

    const [order] = await Order.create(
      [
        {
          user: req.user._id,
          items: orderItems,
          shippingAddress,
          subtotal,
          tax,
          shippingCost,
          total,
          payment: {
            method: paymentMethod || null,
            razorpayOrderId: orderId || null,
            razorpayPaymentId: paymentId || null,
            paidAt: paymentId ? new Date() : null,
          },
          status: 'pending',
          statusHistory: [
            {
              status: 'pending',
              changedAt: new Date(),
              changedBy: req.user._id,
              note: 'Order placed successfully',
            },
          ],
        },
      ],
      { session }
    );

    cart.items = [];
    cart.pendingPayment = { razorpayOrderId: null, amount: null, initiatedAt: null, settled: true };
    await cart.save({ session });

    // COD ledger entry: COD orders are financial events and must appear in the
    // ledger. Online payments get their pending entry at /payments/create and
    // complete it at /payments/verify — the two paths stay consistent.
    await Ledger.create(
      [
        {
          order: order._id,
          user: req.user._id,
          type: 'payment',
          amount: total,
          currency: 'INR',
          paymentMethod: 'cod',
          status: 'pending',
          description: `COD order ${order._id} — payment due on delivery`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populatedOrder = await Order.findById(order._id).populate('items.product', 'name price images');

    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await Notification.create({
          userId: admin._id,
          type: 'order_placed',
          title: 'New Order Received',
          message: `Order #${order._id.toString().slice(-8)} placed by ${req.user.name} for ₹${total}`,
          data: { orderId: order._id, userId: req.user._id, userName: req.user.name, total },
        });
      }
    } catch (notifError) {
      console.error('Error creating order notification:', notifError);
    }

    res.status(201).json(populatedOrder);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Order could not be created' });
  }
};

const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { user: req.user._id };

    if (status) {
      filter.status = status;
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter)
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
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('items.product', 'name price images');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email')
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
};

const updateOrderStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { status, note } = req.body;

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: ['received', 'refunded'],
      received: [],
      cancelled: [],
      refunded: [],
    };

    const statusProgressMap = {
      pending: 0,
      confirmed: 25,
      processing: 50,
      shipped: 50,
      out_for_delivery: 75,
      delivered: 100,
      received: 100,
      cancelled: 0,
      refunded: 0,
    };

    const orderId = req.params.id || req.params.orderId;
    const order = await Order.findById(orderId);
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
    order.deliveryProgress = statusProgressMap[status] || 0;
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: note || '',
      deliveryProgress: order.deliveryProgress,
    });

    await order.save();

    try {
      const customer = await User.findById(order.user);
      if (customer) {
        await Notification.create({
          userId: order.user,
          type: 'order_shipped',
          title: `Order Status Updated`,
          message: `Your order #${order._id.toString().slice(-8)} has been updated to: ${status}`,
          data: { orderId: order._id, status, note },
        });
      }
    } catch (notifError) {
      console.error('Error creating status update notification:', notifError);
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Order in '${order.status}' status cannot be cancelled`,
      });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { session }
      );
    }

    order.status = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Cancelled by customer',
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Order cancellation error:', error);
    res.status(500).json({ message: 'Order could not be cancelled' });
  }
};

module.exports = { 
  createOrder, 
  getOrders, 
  getOrderById, 
  getAllOrders, 
  updateOrderStatus, 
  cancelOrder,
  validateOrderCreation,
  validateOrderStatus
};
