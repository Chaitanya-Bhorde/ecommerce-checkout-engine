const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// @desc    Get wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate('items.product', 'name price images stock');

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    }

    res.json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
// @access  Private
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    }

    const exists = wishlist.items.find(item => item.product.toString() === productId);
    if (exists) {
      return res.json({ success: true, message: 'Already in wishlist' });
    }

    wishlist.items.push({ product: productId });
    await wishlist.save();

    res.json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/remove/:productId
// @access  Private
exports.removeFromWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.items = wishlist.items.filter(item => item.product.toString() !== req.params.productId);
    await wishlist.save();

    res.json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
exports.checkWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    const isInWishlist = wishlist ? wishlist.items.some(item => item.product.toString() === req.params.productId) : false;

    res.json({ success: true, isInWishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};