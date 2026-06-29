const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const bcrypt = require('bcryptjs');

const seedDemo = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log('Cleared existing data');

    // Create Admin User
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
    });
    console.log('✓ Created admin user: admin@example.com / admin123');

    // Create Customer User
    const customerPassword = await bcrypt.hash('customer123', 10);
    const customer = await User.create({
      name: 'John Doe',
      email: 'customer@example.com',
      password: customerPassword,
      role: 'customer',
    });
    console.log('✓ Created customer user: customer@example.com / customer123');

    // Create Categories
    const categories = await Category.insertMany([
      {
        name: 'Electronics',
        description: 'Electronic devices and gadgets',
        isActive: true,
      },
      {
        name: 'Clothing',
        description: 'Fashion and apparel',
        isActive: true,
      },
      {
        name: 'Home & Garden',
        description: 'Home decor and garden supplies',
        isActive: true,
      },
      {
        name: 'Books',
        description: 'Books and publications',
        isActive: false,
      },
    ]);
    console.log('✓ Created 4 categories');

    // Create Products
    const products = await Product.insertMany([
      {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 2999,
        stock: 50,
        category: categories[0]._id,
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
        isActive: true,
      },
      {
        name: 'Smart Watch',
        description: 'Feature-rich smartwatch with health tracking',
        price: 4999,
        stock: 30,
        category: categories[0]._id,
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
        isActive: true,
      },
      {
        name: 'Laptop Stand',
        description: 'Ergonomic aluminum laptop stand',
        price: 1499,
        stock: 100,
        category: categories[0]._id,
        images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500'],
        isActive: true,
      },
      {
        name: 'Cotton T-Shirt',
        description: 'Comfortable 100% cotton t-shirt',
        price: 599,
        stock: 200,
        category: categories[1]._id,
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'],
        isActive: true,
      },
      {
        name: 'Denim Jeans',
        description: 'Classic fit denim jeans',
        price: 1299,
        stock: 75,
        category: categories[1]._id,
        images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=500'],
        isActive: true,
      },
      {
        name: 'Running Shoes',
        description: 'Lightweight running shoes for athletes',
        price: 2499,
        stock: 40,
        category: categories[1]._id,
        images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
        isActive: true,
      },
      {
        name: 'Indoor Plant',
        description: 'Beautiful indoor plant for home decor',
        price: 399,
        stock: 60,
        category: categories[2]._id,
        images: ['https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=500'],
        isActive: true,
      },
      {
        name: 'Wall Clock',
        description: 'Modern minimalist wall clock',
        price: 899,
        stock: 45,
        category: categories[2]._id,
        images: ['https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=500'],
        isActive: true,
      },
      {
        name: 'JavaScript Guide',
        description: 'Complete guide to JavaScript programming',
        price: 699,
        stock: 0,
        category: categories[3]._id,
        images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500'],
        isActive: false,
      },
    ]);
    console.log('✓ Created 9 products');

    console.log('\n✅ Demo data seeded successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  Customer: customer@example.com / customer123');
    console.log('\n🛍️  Products: 9 products across 4 categories');
    console.log('📂 Categories: 4 categories (3 active, 1 inactive)');

    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemo();