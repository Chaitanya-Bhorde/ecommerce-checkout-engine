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

    // Create Products with high-quality images (Amazon/Flipkart style)
    const products = await Product.insertMany([
      {
        name: 'Wireless Headphones',
        description: 'Premium wireless headphones with active noise cancellation and 30-hour battery life',
        price: 2999,
        stock: 50,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
          'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',
          'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Smart Watch Pro',
        description: 'Advanced smartwatch with heart rate monitor, GPS, and 7-day battery',
        price: 4999,
        stock: 30,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
          'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=800&q=80',
          'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Laptop Stand',
        description: 'Ergonomic aluminum laptop stand with adjustable height and cooling',
        price: 1499,
        stock: 100,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
          'https://images.unsplash.com/photo-1611186871348-b1c6962cf3b4?w=800&q=80',
          'https://images.unsplash.com/photo-1585792180666-f7347f490d2b?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Premium Cotton T-Shirt',
        description: 'Ultra-soft 100% organic cotton t-shirt, perfect for everyday wear',
        price: 599,
        stock: 200,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
          'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&q=80',
          'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Slim Fit Denim Jeans',
        description: 'Modern slim fit jeans with stretch comfort and classic look',
        price: 1299,
        stock: 75,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80',
          'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80',
          'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Nike Running Shoes',
        description: 'Professional running shoes with air cushioning and lightweight design',
        price: 2499,
        stock: 40,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
          'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80',
          'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Monstera Deliciosa Plant',
        description: 'Large indoor tropical plant, perfect for home decoration',
        price: 399,
        stock: 60,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&q=80',
          'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&q=80',
          'https://images.unsplash.com/photo-1597055181300-e3633a917c88?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'Modern Wall Clock',
        description: 'Elegant minimalist wall clock with silent quartz movement',
        price: 899,
        stock: 45,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=800&q=80',
          'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800&q=80',
          'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80'
        ],
        isActive: true,
      },
      {
        name: 'JavaScript: The Complete Guide',
        description: 'Bestselling book for learning JavaScript from basics to advanced',
        price: 699,
        stock: 0,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
          'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
          'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80'
        ],
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