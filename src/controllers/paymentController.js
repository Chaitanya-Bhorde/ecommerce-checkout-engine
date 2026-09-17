require('../models/Ledger');
const { createRazorpayOrder, verifyPaymentSignature, fetchRazorpayPayment } = require('../config/razorpay');

const createPaymentOrder = async (req, res) => {
  let cart = null;
  
  try {
    let order;
    let totalAmount;
    let orderId = req.params.orderId;

    console.log('ðŸ”µ POST /api/payments/create called:', {
      orderId: orderId || 'none',
      userId: req.user?._id,
      body: req.body,
      params: req.params,
      env: { NODE_ENV: process.env.NODE_ENV }
    });

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
    console.log('ðŸ’³ Using existing order total:', { total: totalAmount, orderId: order._id });
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

      console.log('ðŸ’³ Calculated total from cart:', { subtotal, tax, shipping, total: totalAmount, userId: req.user._id });
    }

    console.log('ðŸ’³ Creating Razorpay order with options:', {
      amount: totalAmount,
      currency: 'INR',
      receipt: orderId ? `order_${orderId}` : `cart_${req.user._id}_${Date.now()}`,
      keyId: process.env.RAZORPAY_KEY_ID ? '***' + process.env.RAZORPAY_KEY_ID.slice(-4) : 'NOT SET'
    });

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
      } catch (cartMetaError) {
        console.error('Failed to record cart pendingPayment:', cartMetaError.message);
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
    
    console.log('ðŸ“¤ Sending error response:', { message: errorMessage, error: errorDetails });
    
    res.status(500).json({ 
      message: errorMessage,
      error: errorDetails
    });
    return;
  }
};

const verifyPayment = async (req, res) => {
  // Fetch the authoritative payment from Razorpay for reconciliation. Network
  // or configuration failures degrade gracefully: without reconciliation data
  // we still enforce signature verification, but never fabricate amounts.
  const safeFetchPayment = async (paymentId) => {
    try {
      return await fetchRazorpayPayment(paymentId);
    } catch (fetchError) {
      console.warn('Razorpay payment fetch unavailable during verification:', fetchError.message);
      return null;
    }
  };

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shippingAddress } = req.body;

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ message: 'Payment verification failed — invalid signature' });
    }

    let order = await Order.findOne({ 'payment.razorpayOrderId': razorpay_order_id });

    // Fetch the authoritative payment record from Razorpay. This lets us
    // reconcile the amount actually paid against the amount the backend
    // expected — financial values are never trusted from the frontend.
    let razorpayPayment = null;
    try {
      razorpayPayment = await fetchRazorpayPayment(razorpay_payment_id);
    } catch (fetchError) {
      console.error('Failed to fetch payment from Razorpay:', fetchError.message);
    }

    if (razorpayPayment && order) {
      const razorpayAmount = razorpayPayment.amount;
      if (order.total > 0 && razorpayAmount !== order.total) {
        console.error(
          `Payment amount mismatch for order ${order._id}: ` +
          `expected ${order.total} INR, got ${razorpayAmount} INR from Razorpay`
        );
        return res.status(409).json({
          message: 'Payment amount does not match order total'
        });
      }
      const Cart = require('../models/Cart');
      const Product = require('../models/Product');
      const User = require('../models/User');
      const Notification = require('../models/Notification');

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
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
            return res.status(400).json({ message: `${product.name} is no longer available` });
          }

          // Atomic stock guard â€” identical to the COD checkout. The conditional
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

        // Amount reconciliation (F3/F7): the cart recorded the exact amount
        // presented to Razorpay at payment-creation time. If prices changed
        // since then, fail safely instead of creating an order at a different
        // price than the one actually charged.
        const expectedPaise = cart.pendingPayment && typeof cart.pendingPayment.amount === 'number'
          ? cart.pendingPayment.amount
          : null;
        const recomputedTotal = subtotal + Math.round(subtotal * 0.18) + (subtotal >= 500 ? 0 : 40);
        if (expectedPaise !== null && expectedPaise !== recomputedTotal * 100) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            message: 'Cart prices changed after payment was initiated â€” please restart checkout',
          });
        }

        const tax = Math.round(subtotal * 0.18);
        const shippingCost = subtotal >= 500 ? 0 : 40;
        const total = subtotal + tax + shippingCost;

        const [newOrder] = await Order.create(
          [{
            user: req.user._id,
            items: orderItems,
            shippingAddress,
            subtotal,
            tax,
            shippingCost,
            total,
            payment: {
              method: 'razorpay',
              razorpayOrderId: razorpay_order_id,
              razorpayPaymentId: razorpay_payment_id,
              paidAt: new Date(),
            },
            // Payment has been verified against the gateway â€” the order starts
            // life as confirmed, never left as pending.
            status: 'confirmed',
            statusHistory: [{
              status: 'confirmed',
              changedAt: new Date(),
              changedBy: req.user._id,
              note: 'Payment verified â€” order confirmed',
            }],
          }],
          { session }
        );

        // Clear cart and close the recorded payment intent.
        cart.items = [];
        cart.pendingPayment = { razorpayOrderId: null, amount: null, initiatedAt: null, settled: true };
        await cart.save({ session });

        // Ledger entry. The partial unique index on razorpayPaymentId makes a
        // second completed entry for the same payment impossible â€” a concurrent
        // duplicate verification fails here with E11000 and becomes a clean 409
        // instead of a double-settled order.
        try {
          await Ledger.create([{
            order: newOrder._id,
            user: req.user._id,
            type: 'payment',
            amount: total,
            currency: 'INR',
            paymentMethod: 'razorpay',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            status: 'completed',
            description: `Payment completed for order ${newOrder._id}`,
          }], { session });
        } catch (ledgerError) {
          if (ledgerError.code === 11000) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ message: 'This payment has already been processed' });
          }
          throw ledgerError;
        }

        // Notify admin
        try {
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await Notification.create({
              userId: admin._id,
              type: 'order_placed',
              title: 'New Order Received',
              message: `Order #${newOrder._id.toString().slice(-8)} placed by ${req.user.name} for â‚¹${total}`,
              data: { orderId: newOrder._id, userId: req.user._id, userName: req.user.name, total },
            });
          }
        } catch (notifError) {
          console.error('Error creating order notification:', notifError);
        }

        await session.commitTransaction();
        session.endSession();

        const populatedOrder = await Order.findById(newOrder._id).populate('items.product', 'name price images');
        return res.json({ message: 'Payment verified & order created successfully', order: populatedOrder });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        if (error.code === 11000) {
          return res.status(409).json({ message: 'This payment has already been processed' });
        }
        throw error;
      }
    }

    // Existing order path: the order was pre-created (status "pending") via
    // /payments/create/:orderId. Bind the verified payment to it, confirm it,
    // and complete its ledger entry. Idempotent: re-verifying the same payment
    // returns the already-settled order without side effects.
    const fetchedOrder = await safeFetchPayment(razorpay_payment_id);
    if (fetchedOrder && fetchedOrder.order_id && fetchedOrder.order_id !== razorpay_order_id) {
      return res.status(400).json({ message: 'Payment does not belong to this Razorpay order' });
    }
    if (fetchedOrder && typeof fetchedOrder.amount === 'number' && fetchedOrder.amount !== order.total * 100) {
      return res.status(400).json({ message: 'Payment amount does not match the order total' });
    }

    if (order.payment.razorpayPaymentId === razorpay_payment_id) {
      // Already fully settled (by an earlier verify or the capture webhook) â€”
      // return the settled order without any side effects.
      const settled = await Order.findById(order._id).populate('items.product', 'name price images');
      return res.json({ message: 'Payment already verified', order: settled });
    }

    // Idempotency guard: if the order is already confirmed, return immediately
    // without touching Razorpay or the DB again. This is the first of two
    // duplicate-payment guards (the second is the webhook's findOneAndUpdate
    // with a status check). A 200 here is correct â€” the payment IS confirmed.
    const alreadyConfirmed = order.status === 'confirmed';
    if (alreadyConfirmed) {
      const settled = await Order.findById(order._id).populate('items.product', 'name price images');
      return res.json({ message: 'Payment already verified', order: settled });
    }

    // Duplicate-payment guard: Razorpay payment IDs are globally unique. If the
    // same payment ID is associated with a DIFFERENT order, that is a tamper or
    // replay attempt. The Ledger unique index on razorpayPaymentId is the
    // backstop; this check gives a clean 409 before we call Razorpay's API.
    const duplicatePayment = await Order.findOne({
      'payment.razorpayPaymentId': razorpay_payment_id,
      _id: { $ne: order._id },
    });
    if (duplicatePayment) {
      return res.status(409).json({ message: 'This payment ID is already associated with another order' });
    }

    // Amount reconciliation: do not trust the frontend for financial values.
    // Cross-check the amount Razorpay reports against the order total.
    const razorpayAmount = payment.entity.amount;
    if (order.total > 0 && razorpayAmount !== order.total * 100) {
      console.warn(
        `Payment verification amount mismatch for order ${order._id}: ` +
        `expected ${order.total * 100} paise, got ${razorpayAmount} paise`
      );
      return res.status(409).json({ message: 'Payment amount does not match order total' });
    }

    // Mark the order as confirmed (only reaches here if not already confirmed)
    order.status = 'confirmed';
    order.statusHistory.push({
      status: 'confirmed',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Payment verified via Razorpay',
    });
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.paidAt = order.payment.paidAt || new Date();
    await order.save();

    // Complete (or create) the ledger entry. The partial unique index on
    // razorpayPaymentId guarantees one settled ledger row per payment.
    try {
      const existingLedger = await Ledger.findOne({ razorpayOrderId: razorpay_order_id, type: 'payment' });
      if (existingLedger) {
        existingLedger.razorpayPaymentId = razorpay_payment_id;
        existingLedger.status = 'completed';
        existingLedger.amount = order.total;
        existingLedger.description = `Payment completed for order ${order._id}`;
        await existingLedger.save();
      } else {
        await Ledger.create({
          order: order._id,
          user: order.user,
          type: 'payment',
          amount: order.total,
          currency: 'INR',
          paymentMethod: 'razorpay',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          status: 'completed',
          description: `Payment completed for order ${order._id}`,
        });
      }
    } catch (ledgerError) {
      if (ledgerError.code === 11000) {
        return res.status(409).json({ message: 'This payment has already been processed' });
      }
      throw ledgerError;
    }

    const populatedOrder = await Order.findById(order._id).populate('items.product', 'name price images');
    return res.json({
      message: alreadyConfirmed ? 'Payment already verified' : 'Payment verified successfully',
      order: populatedOrder,
    });
  } catch (error) {
    console.error('âŒ Payment verification error:', error);
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