const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('../models/Category');
const Product = require('../models/Product');

dotenv.config();

const seedDemo = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const categoryNames = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports'];
    const categoryIds = [];

    for (const name of categoryNames) {
      const cat = await Category.findOneAndUpdate(
        { name },
        { name, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      categoryIds.push(cat._id);
      console.log(`Category ready: ${name} (${cat._id})`);
    }

    const demoSample = [
      { name: 'Wireless Headphones', description: 'Noise cancelling over-ear headphones with 20hr battery.', price: 2499, comparePrice: 3999, category: categoryIds[0], stock: 50, images: ['https://via.placeholder.com/400x300?text=Headphones'], ratings: 4.5, numReviews: 120, isActive: true },
      { name: 'Smart Watch', description: 'Fitness tracker with heart rate monitor and GPS.', price: 4999, comparePrice: 6999, category: categoryIds[0], stock: 30, images: ['https://via.placeholder.com/400x300?text=Smart+Watch'], ratings: 4.2, numReviews: 85, isActive: true },
      { name: 'Cotton T-Shirt', description: 'Breathable cotton crew neck t-shirt for daily wear.', price: 599, comparePrice: 899, category: categoryIds[1], stock: 200, images: ['https://via.placeholder.com/400x300?text=T-Shirt'], ratings: 4.0, numReviews: 300, isActive: true },
      { name: 'Denim Jacket', description: 'Classic fit denim jacket with button closure.', price: 1899, comparePrice: 2499, category: categoryIds[1], stock: 25, images: ['https://via.placeholder.com/400x300?text=Jacket'], ratings: 4.6, numReviews: 45, isActive: true },
      { name: 'JavaScript Guide', description: 'Comprehensive guide to modern JavaScript (ES6+).', price: 799, comparePrice: 1199, category: categoryIds[2], stock: 100, images: ['https://via.placeholder.com/400x300?text=JS+Book'], ratings: 4.8, numReviews: 210, isActive: true },
      { name: 'Garden Tool Set', description: '5-piece stainless steel garden tool set with pouch.', price: 1299, comparePrice: 1799, category: categoryIds[3], stock: 40, images: ['https://via.placeholder.com/400x300?text=Tools'], ratings: 4.1, numReviews: 60, isActive: true },
      { name: 'Yoga Mat', description: 'Non-slip eco-friendly yoga mat (6mm thickness).', price: 899, comparePrice: 1299, category: categoryIds[4], stock: 80, images: ['https://via.placeholder.com/400x300?text=Yoga+Mat'], ratings: 4.4, numReviews: 150, isActive: true },
      { name: 'Running Shoes', description: 'Lightweight mesh running shoes with cushioned sole.', price: 2199, comparePrice: 2999, category: categoryIds[4], stock: 35, images: ['https://via.placeholder.com/400x300?text=Shoes'], ratings: 4.3, numReviews: 190, isActive: true },
    ];

    for (const data of demoSample) {
      const product = await Product.findOneAndUpdate(
        { name: data.name },
        data,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Product ready: ${product.name} (${product._id})`);
    }

    console.log('\nDemo seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding demo data:', error.message);
    process.exit(1);
  }
};

seedDemo();
