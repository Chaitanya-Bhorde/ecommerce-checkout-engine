const mongoose = require('mongoose');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const { createRazorpayOrder, verifyPaymentSignature, fetchRazorpayPayment } = require('../config/razorpay');

const createPaymentOrder = async (req, res) => {
  let cart = null;
  
  try {
    let order;
    let totalAmount;
    let orderId = req.params.orderId;

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

    totalAmount = order.total;
  } else {
      const Cart = require('../models/Cart');
      cart = await Cart.findOne({ user: req.user._id });
      
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      const subtotal = cart.totalAmount;
      const tax = Math.round(subtotal * 0.18);
      const shipping = subtotal >= 500 ? 0 : 40;
      totalAmount = subtotal + tax + shipping;
    }

    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder(
        totalAmount,
        'INR',
        orderId ? `order_${orderId}` : `cart_${req.user._id}_${Date.now()}`
      );
    } catch (razorpayError) {
      const razorpayMsg = razorpayError?.error?.description || razorpayError?.message || razorpayError?.response?.data?.description || 'Unknown Razorpay error';
      console.error('âŒ Razorpay API error:', razorpayMsg);
      console.error('âŒ Razorpay full error:', JSON.stringify(razorpayError, Object.getOwnPropertyNames(razorpayError)));
      throw new Error(`Payment gateway error: ${razorpayMsg}`);
    }

    if (order) {
      order.payment.method = 'razorpay';
      order.payment.razorpayOrderId = razorpayOrder.id;
      await order.save();

      try {
        await Ledger.create({
          order: order._id,
          user: req.user._id,
          type: 'payment',
          amount: totalAmount,
          currency: 'INR',
          paymentMethod: 'razorpay',
          razorpayOrderId: razorpayOrder.id,
          status: 'pending',
          description: `Payment initiated for order ${order._id}`,
        });
      } catch (ledgerError) {
        console.error('âš ï¸  Ledger creation failed (non-critical):', ledgerError);
        // Continue even if ledger creation fails
      }
    }

    if (!order && cart) {
      // Idempotency: if a Razorpay order was already created for this cart,
      // return the same order ID instead of creating a new one.
      // This prevents duplicate payment intents when the client retries.
      if (cart.pendingPayment && cart.pendingPayment.razorpayOrderId && !cart.pendingPayment.settled) {
        return res.json({
          razorpayOrderId: cart.pendingPayment.razorpayOrderId,
          amount: cart.pendingPayment.amount,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID,
        });
      }

      // Record the exact amount presented to Razorpay (paise) on the cart so
      // verification can reconcile it and reject a drifted cart safely instead
      // of creating orders at a different price than the one charged.
      try {
        cart.pendingPayment = {
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          initiatedAt: new Date(),
          settled: false,
        };
        await cart.save();

        // Record the payment intent in the ledger as 'pending'. Verification
        // (or the webhook) completes this entry; a payment.failed webhook
        // marks it 'failed'. Every gateway interaction stays financially
        // visible and auditable.
        await Ledger.create({
          order: null,
          user: req.user._id,
          type: 'payment',
          amount: totalAmount,
          currency: 'INR',
          paymentMethod: 'razorpay',
          razorpayOrderId: razorpayOrder.id,
          status: 'pending',
          description: 'Payment intent created',
        });
      } catch (cartMetaError) {
        console.error('Failed to record cart payment intent:', cartMetaError.message);
      }
    }

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order ? order._id : null,
    });
  } catch (error) {
    console.error('âŒ Payment creation error:', error);
    console.error('âŒ Error stack:', error.stack);
    console.error('âŒ Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      userId: req.user?._id,
      cartExists: !!cart
    });
    
    // Send detailed error in development
    const errorMessage = 'Failed to create payment order';
    const errorDetails = process.env.NODE_ENV === 'development' ? error.message : undefined;

    res.status(500).json({ 
      message: errorMessage,
      error: errorDetails
    });
    return;
  }
};

const verifyPayment = async (req, res) => {
  // Fetch the authoritative payment from Razorpay for reconciliation. Network
  // or configuration failures degrade gracefully: we still enforce signature
  // verification and the server-recorded amount check, but never fabricate
  // amounts from client-supplied values.
  const safeFetchPayment = async (paymentId) => {
    try {
      return await fetchRazorpayPayment(paymentId);
    } catch (fetchError) {
      console.warn('Razorpay payment fetch unavailable during verification:', fetchError.message);
      return null;
    }
  };

  // After losing a concurrent-settlement race, the winning twin may still be a
  // few milliseconds from commit. Poll briefly for its order so the retry gets
  // an idempotent replay (200) instead of a premature conflict (409).
  const settleReplay = async (paymentId) => {
    const deadline = Date.now() + 2000;
    for (;;) {
      const winner = await Order.findOne({ 'payment.razorpayPaymentId': paymentId })
        .populate('items.product', 'name price images');
      if (winner) return winner;
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddress } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay verification fields' });
    }

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ message: 'Payment verification failed — invalid signature' });
    }

    const razorpayPayment = await safeFetchPayment(razorpay_payment_id);

    // Normalized gateway data. When Razorpay is unreachable we fall back to the
    // amount recorded server-side at /payments/create time
    // (cart.pendingPayment.amount) — never to values supplied by the client.
    const gateway = razorpayPayment
      ? {
          orderId: razorpayPayment.order_id,
          amount: typeof razorpayPayment.amount === 'number' ? razorpayPayment.amount : null,
          status: razorpayPayment.status,
        }
      : null;

    let order = await Order.findOne({ 'payment.razorpayOrderId': razorpay_order_id });

    // ── Path 1: cart checkout — no Order exists yet. The verified payment
    // creates the order atomically (stock decrement + order + settled ledger).
    if (!order) {
      const Cart = require('../models/Cart');
      const cart = await Cart.findOne({ user: req.user._id });

      // The payment intent must belong to THIS user's cart, and we must have
      // the server-recorded amount from /payments/create to reconcile against.
      const expectedPaise =
        cart && cart.pendingPayment && cart.pendingPayment.razorpayOrderId === razorpay_order_id
          ? cart.pendingPayment.amount
          : null;

      if (expectedPaise === null || typeof expectedPaise !== 'number') {
        return res.status(404).json({ message: 'Order not found for this Razorpay order ID' });
      }

      if (gateway) {
        if (gateway.orderId && gateway.orderId !== razorpay_order_id) {
          return res.status(400).json({ message: 'Payment does not belong to this Razorpay order' });
        }
        if (gateway.amount !== null && gateway.amount !== expectedPaise) {
          return res.status(409).json({ message: 'Payment amount does not match the initiated amount' });
        }
        if (gateway.status && !['captured', 'authorized'].includes(gateway.status)) {
          return res.status(400).json({ message: `Payment was not successful (status: ${gateway.status})` });
        }
      }
      // With no gateway data the signature (Razorpay-secret HMAC) plus the
      // exact recorded-amount recomputation below still guard the flow.

      const Product = require('../models/Product');
      const User = require('../models/User');
      const Notification = require('../models/Notification');

      const session = await mongoose.startSession();
      session.startTransaction({ maxTransactionLockRequestTimeoutMillis: 5000 });
      try {
        const freshCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        if (!freshCart || freshCart.items.length === 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Cart is empty' });
        }
        const orderItems = [];
        let subtotal = 0;

        for (const cartItem of freshCart.items) {
          const product = cartItem.product;
          if (!product || !product.isActive) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              message: `${(product && product.name) || 'An item in your cart'} is no longer available`,
            });
          }

          // Atomic stock guard — identical to the COD checkout. The conditional
          // decrement only matches when enough stock exists, so concurrent
          // verifications cannot oversell inventory.
          const decremented = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: cartItem.quantity } },
            { $inc: { stock: -cartItem.quantity } },
            { session, new: true }
          );

          if (!decremented) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
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

        // Price-drift guard: the amount recorded at payment-creation time must
        // equal a fresh server-side recomputation of the cart. If prices changed
        // in between, fail safely (the transaction rolls back stock decrements)
        // instead of creating an order at a different price than the one paid.
        const recomputedTotal = subtotal + Math.round(subtotal * 0.18) + (subtotal >= 500 ? 0 : 40);
        if (expectedPaise !== recomputedTotal * 100) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            message: 'Cart prices changed after payment was initiated — please restart checkout',
          });
        }

        const [newOrder] = await Order.create(
          [{
            user: req.user._id,
            items: orderItems,
            shippingAddress,
            subtotal,
            tax: Math.round(subtotal * 0.18),
            shippingCost: subtotal >= 500 ? 0 : 40,
            total: recomputedTotal,
            payment: {
              method: 'razorpay',
              razorpayOrderId: razorpay_order_id,
              razorpayPaymentId: razorpay_payment_id,
              paidAt: new Date(),
            },
            // Payment verified against the gateway — the order starts life as
            // confirmed, never left as pending.
            status: 'confirmed',
            statusHistory: [{
              status: 'confirmed',
              changedAt: new Date(),
              changedBy: req.user._id,
              note: 'Payment verified — order confirmed',
            }],
          }],
          { session }
        );

        // Clear the cart and close the recorded payment intent.
        freshCart.items = [];
        freshCart.pendingPayment = { razorpayOrderId: null, amount: null, initiatedAt: null, settled: true };
        await freshCart.save({ session });

        // Settled ledger entry. The partial unique index on razorpayPaymentId
        // makes a second completed entry for the same payment impossible — a
        // concurrent duplicate verification fails here with E11000 and becomes
        // an idempotent replay instead of a double-settled order.
        // The pending intent recorded at /payments/create is COMPLETED (not
        // duplicated) so exactly one ledger entry exists per payment.
        const intent = await Ledger.findOne({
          razorpayOrderId: razorpay_order_id,
          type: 'payment',
          status: { $ne: 'completed' },
        }).session(session);

        if (intent) {
          intent.order = newOrder._id;
          intent.razorpayPaymentId = razorpay_payment_id;
          intent.status = 'completed';
          intent.amount = recomputedTotal;
          intent.description = `Payment completed for order ${newOrder._id}`;
          await intent.save({ session });
        } else {
          await Ledger.create(
            [{
              order: newOrder._id,
              user: req.user._id,
              type: 'payment',
              amount: recomputedTotal,
              currency: 'INR',
              paymentMethod: 'razorpay',
              razorpayOrderId: razorpay_order_id,
              razorpayPaymentId: razorpay_payment_id,
              status: 'completed',
              description: `Payment completed for order ${newOrder._id}`,
            }],
            { session }
          );
        }

        await session.commitTransaction();
        session.endSession();

        // Admin notification (best effort, deliberately outside the transaction)
        try {
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await Notification.create({
              userId: admin._id,
              type: 'order_placed',
              title: 'New Order Received',
              message: `Order #${newOrder._id.toString().slice(-8)} placed by ${req.user.name} for ₹${recomputedTotal}`,
              data: { orderId: newOrder._id, userId: req.user._id, userName: req.user.name, total: recomputedTotal },
            });
          }
        } catch (notifError) {
          console.error('Error creating order notification:', notifError.message);
        }

        const populatedOrder = await Order.findById(newOrder._id).populate('items.product', 'name price images');
        return res.json({ message: 'Payment verified & order created successfully', order: populatedOrder });
      } catch (txError) {
        try { await session.abortTransaction(); } catch (abortError) { /* transaction already terminated by the failed commit */ }
        session.endSession();
        if (txError.code === 11000 || txError.code === 112 || txError.code === 24 || (txError.hasErrorLabel && txError.hasErrorLabel('TransientTransactionError'))) {
          // Lost the settlement race against a concurrent twin (verify or
          // webhook): replay the winner committed order so both callers
          // see success and exactly one order/ledger settlement exists.
          const winner = await settleReplay(razorpay_payment_id);
          if (winner) {
            return res.json({ message: 'Payment already verified', order: winner });
          }
          return res.status(409).json({ message: 'This payment has already been processed' });
        }
        throw txError;
      }
    }

    // ── Path 2: an Order already exists for this Razorpay order (e.g. a COD
    // order being paid online, or a retry racing the webhook). Confirm it
    // atomically — the status guard makes double-confirmation impossible.
    const session = await mongoose.startSession();
    session.startTransaction({ maxTransactionLockRequestTimeoutMillis: 5000 });
    try {
      const locked = await Order.findOneAndUpdate(
        { _id: order._id, status: { $ne: 'confirmed' } },
        {
          $set: {
            'payment.method': 'razorpay',
            'payment.razorpayPaymentId': razorpay_payment_id,
            'payment.paidAt': new Date(),
            status: 'confirmed',
          },
          $push: {
            statusHistory: {
              status: 'confirmed',
              changedAt: new Date(),
              changedBy: req.user._id,
              note: 'Payment verified via Razorpay',
            },
          },
        },
        { new: true, session }
      );

      if (!locked) {
        // A concurrent twin (verify or webhook) already confirmed this order —
        // idempotent replay, never a second settlement.
        await session.abortTransaction();
        session.endSession();
        const settled = await Order.findById(order._id).populate('items.product', 'name price images');
        return res.json({ message: 'Payment already verified', order: settled });
      }

      // Duplicate-payment guard: the same Razorpay payment ID settling a
      // DIFFERENT order is a replay/tamper attempt.
      const duplicatePayment = await Order.findOne({
        'payment.razorpayPaymentId': razorpay_payment_id,
        _id: { $ne: order._id },
      }).session(session);
      if (duplicatePayment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: 'This payment ID is already associated with another order' });
      }

      // Amount reconciliation: gateway amount (paise) must equal the order
      // total in paise. Without gateway data, fall back to the pending ledger
      // recorded at /payments/create — never to client-supplied values.
      const pendingLedger = await Ledger.findOne({
        razorpayOrderId: razorpay_order_id,
        type: 'payment',
      }).session(session);
      const expectedPaise =
        gateway && gateway.amount !== null
          ? gateway.amount
          : pendingLedger
            ? pendingLedger.amount * 100
            : locked.total * 100;

      if (locked.total > 0 && expectedPaise !== locked.total * 100) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: 'Payment amount does not match order total' });
      }
      if (gateway && gateway.orderId && gateway.orderId !== razorpay_order_id) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Payment does not belong to this Razorpay order' });
      }
      if (gateway && gateway.status && !['captured', 'authorized'].includes(gateway.status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Payment was not successful (status: ${gateway.status})` });
      }

      // Complete the pending ledger entry (or upsert one if /payments/create
      // never recorded it). The partial unique index on razorpayPaymentId
      // backstops double settlement at the storage level.
      try {
        if (pendingLedger) {
          pendingLedger.razorpayPaymentId = razorpay_payment_id;
          pendingLedger.status = 'completed';
          pendingLedger.amount = locked.total;
          pendingLedger.description = `Payment completed for order ${locked._id}`;
          await pendingLedger.save({ session });
        } else {
          await Ledger.create(
            [{
              order: locked._id,
              user: locked.user,
              type: 'payment',
              amount: locked.total,
              currency: 'INR',
              paymentMethod: 'razorpay',
              razorpayOrderId: razorpay_order_id,
              razorpayPaymentId: razorpay_payment_id,
              status: 'completed',
              description: `Payment completed for order ${locked._id}`,
            }],
            { session }
          );
        }
      } catch (ledgerError) {
        if (ledgerError.code === 11000) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({ message: 'This payment has already been processed' });
        }
        throw ledgerError;
      }

      await session.commitTransaction();
      session.endSession();

      const populatedOrder = await Order.findById(locked._id).populate('items.product', 'name price images');
      return res.json({ message: 'Payment verified successfully', order: populatedOrder });
    } catch (txError) {
      try { await session.abortTransaction(); } catch (abortError) { /* transaction already terminated by the failed commit */ }
      session.endSession();
      if (txError.code === 11000 || txError.code === 112 || txError.code === 24 || (txError.hasErrorLabel && txError.hasErrorLabel('TransientTransactionError'))) {
        // Lost the settlement race against a concurrent twin: replay the
        // winner committed order instead of surfacing a raw 500.
        const winner = await settleReplay(razorpay_payment_id);
        if (winner) {
          return res.json({ message: 'Payment already verified', order: winner });
        }
        return res.status(409).json({ message: 'This payment has already been processed' });
      }
      throw txError;
    }
  } catch (error) {
    console.error('Payment verification error:', error.message);
    res.status(500).json({ message: 'Payment verification failed' });
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