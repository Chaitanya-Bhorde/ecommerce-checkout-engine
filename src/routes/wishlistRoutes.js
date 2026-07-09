const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getWishlist, addToWishlist, removeFromWishlist, checkWishlist } = require('../controllers/wishlistController');

router.get('/', protect, getWishlist);
router.get('/check/:productId', protect, checkWishlist);
router.post('/add', protect, addToWishlist);
router.delete('/remove/:productId', protect, removeFromWishlist);

module.exports = router;