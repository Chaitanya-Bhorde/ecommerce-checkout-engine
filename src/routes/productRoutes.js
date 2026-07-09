const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  validateProduct,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', protect, admin, validateProduct, createProduct);
router.put('/:id', protect, admin, validateProduct, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

module.exports = router;
