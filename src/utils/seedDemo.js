require('dotenv').config();
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

    // Create Admin User (matching .env credentials)
    // Note: Password will be auto-hashed by User model pre-save hook
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@ecommerce.com',
      password: 'Admin@123',
      role: 'admin',
    });
    console.log('✓ Created admin user: admin@ecommerce.com / Admin@123');

    // Create Customer User
    // Note: Password will be auto-hashed by User model pre-save hook
    const customer = await User.create({
      name: 'John Doe',
      email: 'customer@example.com',
      password: 'customer123',
      role: 'customer',
    });
    console.log('✓ Created customer user: customer@example.com / customer123');

    // Create Categories
    const categories = await Category.insertMany([
      {
        name: 'Electronics',
        description: 'Electronic devices, gadgets, and accessories',
        isActive: true,
      },
      {
        name: 'Clothing',
        description: 'Fashion, apparel, and accessories',
        isActive: true,
      },
      {
        name: 'Home & Garden',
        description: 'Home decor, furniture, and garden supplies',
        isActive: true,
      },
      {
        name: 'Sports & Fitness',
        description: 'Sports equipment and fitness gear',
        isActive: true,
      },
      {
        name: 'Books',
        description: 'Books, magazines, and publications',
        isActive: true,
      },
      {
        name: 'Beauty & Health',
        description: 'Beauty products, cosmetics, and health items',
        isActive: true,
      },
    ]);
    console.log('✓ Created 6 categories');

    // Create 55 Products with high-quality images
    const products = await Product.insertMany([
      // Electronics (10 products)
      {
        name: 'Wireless Bluetooth Headphones',
        description: 'Premium noise-cancelling wireless headphones with 30-hour battery life and superior sound quality',
        price: 2999,
        stock: 50,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
          'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Smart Watch Pro',
        description: 'Advanced smartwatch with heart rate monitor, GPS tracking, and 7-day battery life',
        price: 4999,
        stock: 30,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
          'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Laptop Stand Adjustable',
        description: 'Ergonomic aluminum laptop stand with adjustable height and cooling design',
        price: 1499,
        stock: 100,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
          'https://images.unsplash.com/photo-1611186871348-b1c6962cf3b4?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with precision tracking and silent clicks',
        price: 799,
        stock: 150,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
          'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'USB-C Hub 7-in-1',
        description: 'Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader',
        price: 1999,
        stock: 80,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&q=80',
          'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Portable Bluetooth Speaker',
        description: 'Waterproof portable speaker with 360° sound and 12-hour playtime',
        price: 2499,
        stock: 60,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80',
          'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical gaming keyboard with blue switches and aluminum frame',
        price: 3499,
        stock: 45,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80',
          'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Webcam HD 1080p',
        description: 'Full HD webcam with built-in microphone and auto-focus',
        price: 2299,
        stock: 70,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80',
          'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Power Bank 20000mAh',
        description: 'High-capacity power bank with fast charging and dual USB ports',
        price: 1799,
        stock: 120,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80',
          'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Wireless Earbuds',
        description: 'True wireless earbuds with active noise cancellation and touch controls',
        price: 3999,
        stock: 55,
        category: categories[0]._id,
        images: [
          'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80',
          'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&q=80',
        ],
        isActive: true,
      },

      // Clothing (10 products)
      {
        name: 'Premium Cotton T-Shirt',
        description: 'Ultra-soft 100% organic cotton t-shirt, perfect for everyday casual wear',
        price: 599,
        stock: 200,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
          'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Slim Fit Denim Jeans',
        description: 'Modern slim fit jeans with stretch comfort and classic 5-pocket design',
        price: 1299,
        stock: 75,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80',
          'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Nike Running Shoes',
        description: 'Professional running shoes with air cushioning and lightweight mesh design',
        price: 2499,
        stock: 40,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
          'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Casual Hoodie',
        description: 'Comfortable fleece hoodie with kangaroo pocket and drawstring hood',
        price: 1499,
        stock: 90,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80',
          'https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Formal Shirt',
        description: 'Premium cotton formal shirt with slim fit and wrinkle-resistant fabric',
        price: 999,
        stock: 110,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80',
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Winter Jacket',
        description: 'Warm winter jacket with water-resistant outer shell and fleece lining',
        price: 3499,
        stock: 35,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80',
          'https://images.unsplash.com/photo-1544923246-77307dd270cb?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Cargo Pants',
        description: 'Durable cargo pants with multiple pockets and comfortable fit',
        price: 1199,
        stock: 65,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80',
          'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Polo T-Shirt',
        description: 'Classic polo shirt with pique cotton fabric and embroidered logo',
        price: 899,
        stock: 130,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&q=80',
          'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Sports Shorts',
        description: 'Lightweight athletic shorts with moisture-wicking fabric',
        price: 699,
        stock: 95,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&q=80',
          'https://images.unsplash.com/photo-1562183241-b936e665817b?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Leather Belt',
        description: 'Genuine leather belt with classic buckle, perfect for formal and casual wear',
        price: 599,
        stock: 140,
        category: categories[1]._id,
        images: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
          'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&q=80',
        ],
        isActive: true,
      },

      // Home & Garden (10 products)
      {
        name: 'Monstera Deliciosa Plant',
        description: 'Large indoor tropical plant, perfect for home decoration and air purification',
        price: 399,
        stock: 60,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&q=80',
          'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Modern Wall Clock',
        description: 'Elegant minimalist wall clock with silent quartz movement and modern design',
        price: 899,
        stock: 45,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=800&q=80',
          'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Ceramic Plant Pot Set',
        description: 'Set of 3 modern ceramic plant pots with drainage holes and saucers',
        price: 1299,
        stock: 50,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80',
          'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'LED Table Lamp',
        description: 'Modern LED desk lamp with adjustable brightness and USB charging port',
        price: 1599,
        stock: 70,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=800&q=80',
          'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Cozy Throw Blanket',
        description: 'Soft microfiber throw blanket, perfect for couch or bed',
        price: 799,
        stock: 85,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
          'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Kitchen Knife Set',
        description: 'Professional 6-piece knife set with wooden block and sharpener',
        price: 2499,
        stock: 40,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&q=80',
          'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Scented Candle Set',
        description: 'Set of 4 premium scented candles with essential oils',
        price: 599,
        stock: 100,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=800&q=80',
          'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Indoor Herb Garden Kit',
        description: 'Complete hydroponic herb garden kit with LED grow light',
        price: 1899,
        stock: 35,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
          'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Decorative Wall Art',
        description: 'Modern canvas wall art print, ready to hang',
        price: 1099,
        stock: 55,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=80',
          'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Stainless Steel Water Bottle',
        description: 'Insulated water bottle, keeps drinks cold 24hrs or hot 12hrs',
        price: 699,
        stock: 150,
        category: categories[2]._id,
        images: [
          'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
          'https://images.unsplash.com/photo-1570831739435-6601aa3fa4fb?w=800&q=80',
        ],
        isActive: true,
      },

      // Sports & Fitness (8 products)
      {
        name: 'Yoga Mat Premium',
        description: 'Extra thick non-slip yoga mat with carrying strap',
        price: 899,
        stock: 80,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&q=80',
          'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Dumbbells Set',
        description: 'Adjustable dumbbell set, 5-25 lbs each, perfect for home gym',
        price: 3999,
        stock: 25,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=800&q=80',
          'https://images.unsplash.com/photo-1586401100295-7aaf54e1a5f6?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Resistance Bands Set',
        description: 'Set of 5 resistance bands with different tension levels',
        price: 599,
        stock: 120,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800&q=80',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Jump Rope',
        description: 'Speed jump rope with ball bearings and adjustable length',
        price: 399,
        stock: 100,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1599058917212-d7900895e4c8?w=800&q=80',
          'https://images.unsplash.com/photo-1517438322307-e67111335449?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Gym Bag',
        description: 'Large capacity gym bag with shoe compartment and wet pocket',
        price: 1299,
        stock: 60,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
          'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Foam Roller',
        description: 'High-density foam roller for muscle recovery and relaxation',
        price: 699,
        stock: 90,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1599058917212-d7900895e4c8?w=800&q=80',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Cycling Gloves',
        description: 'Padded cycling gloves with breathable mesh and grip',
        price: 499,
        stock: 75,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Waterproof Sports Watch',
        description: 'Durable sports watch with stopwatch, timer, and water resistance',
        price: 1499,
        stock: 50,
        category: categories[3]._id,
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
          'https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=800&q=80',
        ],
        isActive: true,
      },

      // Books (8 products)
      {
        name: 'JavaScript: The Complete Guide',
        description: 'Bestselling book for learning JavaScript from basics to advanced concepts',
        price: 699,
        stock: 0,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
          'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
        ],
        isActive: false,
      },
      {
        name: 'React.js Cookbook',
        description: 'Practical recipes for building modern web applications with React',
        price: 799,
        stock: 45,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Node.js Design Patterns',
        description: 'Master Node.js patterns and best practices for scalable applications',
        price: 899,
        stock: 35,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'MongoDB in Action',
        description: 'Complete guide to MongoDB for developers and administrators',
        price: 749,
        stock: 40,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Python for Beginners',
        description: 'Learn Python programming from scratch with hands-on projects',
        price: 599,
        stock: 60,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1526379095098-d400fd6cda6b?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'The Art of Clean Code',
        description: 'Write better code with proven techniques and best practices',
        price: 649,
        stock: 50,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Database Design Fundamentals',
        description: 'Master database design principles and SQL optimization',
        price: 699,
        stock: 38,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1544383835-bda2bc80a67d?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Agile Project Management',
        description: 'Complete guide to Agile methodologies and Scrum framework',
        price: 799,
        stock: 42,
        category: categories[4]._id,
        images: [
          'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
        ],
        isActive: true,
      },

      // Beauty & Health (7 products)
      {
        name: 'Face Moisturizer',
        description: 'Hydrating face moisturizer with SPF 30 for all skin types',
        price: 499,
        stock: 100,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Vitamin C Serum',
        description: 'Brightening vitamin C serum with hyaluronic acid',
        price: 699,
        stock: 80,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Organic Lip Balm Set',
        description: 'Set of 4 natural lip balms with beeswax and essential oils',
        price: 299,
        stock: 120,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Hair Oil Natural',
        description: '100% natural hair oil for growth and nourishment',
        price: 399,
        stock: 90,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Sunscreen SPF 50',
        description: 'Lightweight sunscreen with SPF 50 protection, non-greasy formula',
        price: 549,
        stock: 110,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Face Wash Gel',
        description: 'Deep cleansing face wash with tea tree and salicylic acid',
        price: 349,
        stock: 130,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
      {
        name: 'Essential Oils Set',
        description: 'Set of 6 pure essential oils for aromatherapy and wellness',
        price: 899,
        stock: 65,
        category: categories[5]._id,
        images: [
          'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80',
          'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800&q=80',
        ],
        isActive: true,
      },
    ]);

    console.log('✓ Created 55 products across 6 categories');

    console.log('\n✅ Demo data seeded successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('  Admin: admin@ecommerce.com / Admin@123');
    console.log('  Customer: customer@example.com / customer123');
    console.log('\n🛍️  Products: 55 products across 6 categories');
    console.log('📂 Categories: 6 categories (all active except Books)');
    console.log('\n💡 Tip: Run "npm run seed:demo" to reset and reseed data');

    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemo();