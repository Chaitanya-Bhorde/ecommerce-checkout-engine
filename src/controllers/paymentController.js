const mongoose = require('mongoose');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const { createRazorpayOrder, verifyPaymentSignature } = require('../config/razorpay');

const createPaymentOrder = async (req, res) => {
  try {
    let order;
    let orderId = req.params.orderId;

    // If orderId is provided, fetch the existing order
    if (orderId) {
      order = await Order.findOne({
        _id: orderId,
        user: req.user._id,
        status: 'pending',
      });

      if (!order) {
        return res.status(404).json({ message: 'Order not found or already processed' });
      }

      if (order.payment.razorpayOrderId) {
        return res.status(400).json({ message: 'Payment already initiated for this order' });
      }
    }

    // Get cart total if no order exists yet
    const Cart = require('../models/Cart');
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const subtotal = cart.totalAmount;
    const tax = subtotal * 0.18;
    const shipping = subtotal >= 500 ? 0 : 40;
    const total = subtotal + tax + shipping;

    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder(
      total,
      'INR',
      orderId ? `order_${orderId}` : `cart_${req.user._id}_${Date.now()}`
    );

    // If order exists, update it with payment info
    if (order) {
      order.payment.method = 'razorpay';
      order.payment.razorpayOrderId = razorpayOrder.id;
      await order.save();

      await Ledger.create({
        order: order._id,
        user: req.user._id,
        type: 'payment',
        amount: total,
        currency: 'INR',
        paymentMethod: 'razorpay',
        razorpayOrderId: razorpayOrder.id,
        status: 'pending',
        description: `Payment initiated for order ${order._id}`,
      });
    }

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order ? order._id : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ message: 'Payment verification failed — invalid signature' });
    }

    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpay_order_id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      order.payment.razorpayPaymentId = razorpay_payment_id;
      order.payment.paidAt = new Date();
      order.status = 'confirmed';
      order.statusHistory.push({
        status: 'confirmed',
        changedAt: new Date(),
        changedBy: req.user._id,
        note: 'Payment verified successfully',
      });
      await order.save({ session });

      await Ledger.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          razorpayPaymentId: razorpay_payment_id,
          status: 'completed',
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.json({ message: 'Payment verified successfully', order });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      orderId: order._id,
      status: order.status,
      payment: order.payment,
      total: order.total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLedgerEntries = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (type) filter.type = type;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      Ledger.find(filter)
        .populate('order', 'total status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Ledger.countDocuments(filter),
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
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllLedgerEntries = async (req, res) => {
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
      Ledger.find(filter)
        .populate('order', 'total status')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Ledger.countDocuments(filter),
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
      summary: {
        totalEntries: total,
        totalAmount: entries.reduce((sum, e) => sum + e.amount, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createPaymentOrder, verifyPayment, getPaymentStatus, getLedgerEntries, getAllLedgerEntries };