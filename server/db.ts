import mongoose from 'mongoose';
import { User } from './models';

let isConnected = false;
let lastError: { message: string, isWhitelistError: boolean } | null = null;

export async function connectDB(uri: string) {
  if (!uri) {
    console.warn('MONGODB_URI not found. Please set it in the Secrets panel.');
    return { isConnected: false, error: 'MONGODB_URI not found' };
  }

  const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
  console.log(`Attempting to connect to MongoDB: ${maskedUri}`);

  if (uri.includes('<password>') || uri.includes('<username>')) {
    const msg = 'MONGODB_URI contains placeholders like <password> or <username>. Please replace them with your actual credentials.';
    console.error(msg);
    return { isConnected: false, error: msg };
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('Connected to MongoDB');
    await initAdmin();
    return { isConnected: true, error: null };
  } catch (err: any) {
    isConnected = false;
    const isWhitelistError = err.message.includes('MongooseServerSelectionError') || err.message.includes('IP');
    console.error('MongoDB connection error:', err);
    lastError = { message: err.message, isWhitelistError };
    return { isConnected: false, error: lastError };
  }
}

async function initAdmin() {
  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({ username: 'admin', password: 'admin123', role: 'admin' });
    console.log('Admin user created');
  }
}

export function getStatus() {
  return { isConnected, lastError };
}

export async function disconnectDB() {
  await mongoose.disconnect();
  isConnected = false;
  lastError = null;
}
