const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const adminData = {
      name: 'Admin',
      email: 'admin@ecommerce.com',
      password: 'Admin@123',
      role: 'admin',
    };

    const existing = await User.findOne({ email: adminData.email });
    if (existing) {
      console.log('Admin already exists with email:', adminData.email);
      console.log('Admin ID:', existing._id);
      await mongoose.disconnect();
      return;
    }

    const admin = await User.create(adminData);
    console.log('Admin created successfully!');
    console.log('Email: admin@ecommerce.com');
    console.log('Password: Admin@123');
    console.log('Admin ID:', admin._id);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();