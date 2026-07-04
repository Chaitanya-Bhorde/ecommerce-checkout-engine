// Agentic AI Tools - Allows AI to perform real actions
// This is what makes the AI "agentic" - it can DO things, not just chat

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

/**
 * Tool: Cancel an order
 * AI can use this to automatically cancel orders
 */
async function cancelOrder(orderId, userId, reason = '') {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    if (!['Pending', 'Confirmed'].includes(order.status)) {
      return {
        success: false,
        message: `Cannot cancel order with status: ${order.status}. Only Pending or Confirmed orders can be cancelled.`,
      };
    }

    // Check if within 24 hours
    const hoursSinceOrder = (Date.now() - order.createdAt) / (1000 * 60 * 60);
    if (hoursSinceOrder > 24) {
      return {
        success: false,
        message: 'Orders can only be cancelled within 24 hours of placement',
      };
    }

    // Cancel order
    order.status = 'Cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    return {
      success: true,
      message: `Order #${orderId.slice(-8)} has been cancelled successfully. Refund will be processed in 7-10 business days.`,
      orderId: order._id,
      refundAmount: order.total,
    };
  } catch (error) {
    console.error('Cancel order error:', error);
    return {
      success: false,
      message: 'Failed to cancel order. Please try again or contact support.',
    };
  }
}

/**
 * Tool: Process return request
 * AI can initiate returns automatically
 */
async function processReturn(orderId, userId, reason = '') {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    if (order.status !== 'Delivered') {
      return {
        success: false,
        message: 'Only delivered orders can be returned',
      };
    }

    // Check if within 7 days
    const daysSinceDelivery = (Date.now() - order.deliveredAt) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7) {
      return {
        success: false,
        message: 'Returns are only accepted within 7 days of delivery',
      };
    }

    // Initiate return
    order.status = 'Return Requested';
    order.returnReason = reason;
    order.returnRequestedAt = new Date();
    await order.save();

    return {
      success: true,
      message: `Return request for order #${orderId.slice(-8)} has been initiated. Our team will contact you within 24 hours.`,
      orderId: order._id,
      refundAmount: order.total,
    };
  } catch (error) {
    console.error('Process return error:', error);
    return {
      success: false,
      message: 'Failed to process return. Please try again or contact support.',
    };
  }
}

/**
 * Tool: Update delivery address
 * AI can update address for pending orders
 */
async function updateDeliveryAddress(orderId, userId, newAddress) {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    if (!['Pending', 'Confirmed'].includes(order.status)) {
      return {
        success: false,
        message: 'Cannot update address for orders that are already shipped',
      };
    }

    // Update address
    order.shippingAddress = {
      ...order.shippingAddress,
      ...newAddress,
    };
    await order.save();

    return {
      success: true,
      message: `Delivery address updated for order #${orderId.slice(-8)}`,
      orderId: order._id,
      newAddress: order.shippingAddress,
    };
  } catch (error) {
    console.error('Update address error:', error);
    return {
      success: false,
      message: 'Failed to update address. Please try again or contact support.',
    };
  }
}

/**
 * Tool: Get order details
 * AI can fetch real-time order information
 */
async function getOrderDetails(orderId, userId) {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.product', 'name price images')
      .select('_id total status deliveryProgress createdAt items shippingAddress');

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    return {
      success: true,
      order: {
        id: order._id,
        orderNumber: `#${order._id.slice(-8).toUpperCase()}`,
        total: order.total,
        status: order.status,
        progress: order.deliveryProgress,
        date: order.createdAt,
        items: order.items.map(item => ({
          name: item.product?.name || 'Product',
          price: item.price,
          quantity: item.quantity,
          image: item.product?.images?.[0] || null,
        })),
        shippingAddress: order.shippingAddress,
      },
    };
  } catch (error) {
    console.error('Get order details error:', error);
    return {
      success: false,
      message: 'Failed to fetch order details',
    };
  }
}

/**
 * Tool: Search products
 * AI can search products for recommendations
 */
async function searchProducts(query, limit = 5) {
  try {
    const products = await Product.find({
      isActive: true,
      stock: { $gt: 0 },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('category', 'name')
      .limit(limit)
      .select('name price images category stock description');

    return {
      success: true,
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        price: product.price,
        category: product.category?.name || 'General',
        stock: product.stock,
        image: product.images?.[0] || null,
        description: product.description,
      })),
    };
  } catch (error) {
    console.error('Search products error:', error);
    return {
      success: false,
      message: 'Failed to search products',
    };
  }
}

/**
 * Tool: Apply discount code
 * AI can apply discount codes
 */
async function applyDiscountCode(orderId, userId, discountCode) {
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return {
        success: false,
        message: 'Order not found',
      };
    }

    if (!['Pending', 'Confirmed'].includes(order.status)) {
      return {
        success: false,
        message: 'Cannot apply discount to shipped orders',
      };
    }

    // Check if discount already applied
    if (order.discountApplied) {
      return {
        success: false,
        message: 'Discount already applied to this order',
      };
    }

    // Validate discount code (you can expand this)
    const validCodes = {
      'SAVE10': { percentage: 10, type: 'percentage' },
      'FLAT50': { amount: 50, type: 'fixed' },
      'WELCOME20': { percentage: 20, type: 'percentage' },
    };

    const discount = validCodes[discountCode.toUpperCase()];

    if (!discount) {
      return {
        success: false,
        message: 'Invalid discount code',
      };
    }

    // Calculate discount
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (order.total * discount.percentage) / 100;
    } else {
      discountAmount = discount.amount;
    }

    // Apply discount
    order.discount = discountAmount;
    order.discountCode = discountCode.toUpperCase();
    order.discountApplied = true;
    order.total = order.total - discountAmount;
    await order.save();

    return {
      success: true,
      message: `Discount code ${discountCode.toUpperCase()} applied! You saved ₹${discountAmount}`,
      orderId: order._id,
      discountAmount,
      newTotal: order.total,
    };
  } catch (error) {
    console.error('Apply discount error:', error);
    return {
      success: false,
      message: 'Failed to apply discount. Please try again.',
    };
  }
}

/**
 * Tool: Get user's recent orders
 * AI can fetch user's order history
 */
async function getUserRecentOrders(userId, limit = 5) {
  try {
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id total status deliveryProgress createdAt');

    return {
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        orderNumber: `#${order._id.slice(-8).toUpperCase()}`,
        total: order.total,
        status: order.status,
        progress: order.deliveryProgress,
        date: order.createdAt,
      })),
    };
  } catch (error) {
    console.error('Get user orders error:', error);
    return {
      success: false,
      message: 'Failed to fetch orders',
    };
  }
}

// Export all tools
module.exports = {
  cancelOrder,
  processReturn,
  updateDeliveryAddress,
  getOrderDetails,
  searchProducts,
  applyDiscountCode,
  getUserRecentOrders,
};