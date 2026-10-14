import mongoose from 'mongoose';
import dns from 'dns';

// Fix for Windows & local ISP DNS dropping SRV records:
// Force Node.js to use Google DNS (8.8.8.8) and Cloudflare DNS (1.1.1.1)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (err) {
  console.warn('⚠️ Could not override DNS servers:', err.message);
}

/**
 * Connect to MongoDB Atlas
 * Implements auto-reconnect, DNS resilience, and diagnostic reporting.
 */
export const connectDB = async (retries = 3, delayMs = 3000) => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 Connecting to MongoDB Atlas (Attempt ${attempt}/${retries})...`);
      const conn = await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host} [Database: ${conn.connection.name}]`);

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB Connection Error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB Disconnected. Attempting reconnection...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB Reconnected successfully.');
      });

      return conn;
    } catch (error) {
      console.error(`❌ MongoDB Connection Attempt ${attempt} Failed: ${error.message}`);

      // Diagnostic hint for IP whitelist
      if (
        error.message.includes('whitelist') ||
        error.message.includes('SSL alert number 80') ||
        error.message.includes('Could not connect to any servers')
      ) {
        console.warn('\n======================================================');
        console.warn('⚠️  MONGODB ATLAS IP ACCESS LIST / WHITELIST REQUIRED:');
        console.warn('👉 Your current public IP is not in MongoDB Atlas Network Access.');
        console.warn('👉 Please visit: https://cloud.mongodb.com');
        console.warn('👉 Go to: Security -> Network Access -> Add IP Address');
        console.warn('👉 Choose "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0) or Add Current IP.');
        console.warn('======================================================\n');
      }

      if (attempt === retries) {
        console.error('❌ Could not establish initial database connection.');
        process.exit(1);
      }

      console.log(`⏳ Retrying database connection in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};
