const Review = require('../models/Review');
const Order = require('../models/Order');

// @desc    Add a review for a product
// @route   POST /api/reviews
// @access  Private
exports.addReview = async (req, res) => {
  try {
    const { productId, rating, title, comment } = req.body;

    // Check if user has purchased this product
    const order = await Order.findOne({
      user: req.user._id,
      'items.product': productId,
      status: { $in: ['delivered', 'received'] },
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'You can only review products you have purchased and received',
      });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id,
      order: order._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product for this order',
      });
    }

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: order._id,
      rating,
      title,
      comment,
      isVerified: true,
    });

    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/:productId
// @access  Public
exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => { distribution[r.rating]++; });

    res.json({
      success: true,
      reviews,
      stats: {
        total: reviews.length,
        averageRating: parseFloat(avgRating),
        distribution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if user can review a product
// @route   GET /api/reviews/can-review/:productId
// @access  Private
exports.canReview = async (req, res) => {
  try {
    const order = await Order.findOne({
      user: req.user._id,
      'items.product': req.params.productId,
      status: { $in: ['delivered', 'received'] },
    });

    const existingReview = order ? await Review.findOne({
      product: req.params.productId,
      user: req.user._id,
      order: order._id,
    }) : null;

    res.json({
      success: true,
      canReview: !!order && !existingReview,
      hasReviewed: !!existingReview,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};