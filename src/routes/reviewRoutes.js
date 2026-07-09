const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { addReview, getProductReviews, canReview } = require('../controllers/reviewController');

router.get('/:productId', getProductReviews);
router.post('/', protect, addReview);
router.get('/can-review/:productId', protect, canReview);

module.exports = router;