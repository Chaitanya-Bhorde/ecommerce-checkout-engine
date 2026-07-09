const express = require('express');
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  validateCategory,
} = require('../controllers/categoryController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', protect, admin, validateCategory, createCategory);
router.put('/:id', protect, admin, validateCategory, updateCategory);
router.delete('/:id', protect, admin, deleteCategory);

module.exports = router;
