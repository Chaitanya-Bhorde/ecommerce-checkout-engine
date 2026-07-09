const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Idempotency = require('../models/Idempotency');
const Notification = require('../models/Notification');
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
    .withMessage('Payment method must be either razorpay or cod')
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
  const idempotencyKey = req.headers['idempotency-key'];

  const existing = await Idempotency.findOne({ key: idempotencyKey, user: req.user._id });
  if (existing) {
    return res.status(existing.response.statusCode).json(existing.response.body);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { shippingAddress, paymentMethod } = req.body;

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

      if (product.stock < cartItem.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
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

      await Product.findByIdAndUpdate(
        product._id,
        { $inc: { stock: -cartItem.quantity } },
        { session }
      );
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
            razorpayOrderId: null,
            razorpayPaymentId: null,
            paidAt: null,
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
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populatedOrder = await Order.findById(order._id).populate('items.product', 'name price images');

    // Send notification to admin about new order
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
    res.status(500).json({ message: error.message });
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
    // Validate input
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

    // Map status to delivery progress
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

    const order = await Order.findById(req.params.id);
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

    // Send notification to customer about order status update
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
    res.status(500).json({ message: error.message });
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
