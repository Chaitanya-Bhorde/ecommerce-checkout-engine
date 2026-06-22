 const mongoose = require('mongoose');

const connectDB = async () => {
  try {
     
    const cloudUrl = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!cloudUrl) {
      throw new Error("Database connection URL missing in environment variables!");
    }

    console.log("Connecting to MongoDB Atlas Securely...");
    const conn = await mongoose.connect(cloudUrl);
    
    console.log(`MongoDB Cloud Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Cloud Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;