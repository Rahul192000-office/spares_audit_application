import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { connectDB, getStatus, disconnectDB } from './server/db';
import apiRoutes from './server/routes';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

// Connect to Database
connectDB(MONGODB_URI);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware to check DB connection for API routes
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/log-error' || req.path === '/reconnect') return next();
  const { isConnected } = getStatus();
  if (!isConnected) {
    return res.status(503).json({ 
      error: 'Database not connected. Please check MONGODB_URI in Secrets.',
      status: 'disconnected'
    });
  }
  next();
});

// --- API Routes ---

app.get('/api/health', (req, res) => {
  const { isConnected, lastError } = getStatus();
  res.json({ 
    status: isConnected ? 'connected' : 'disconnected',
    hasUri: !!MONGODB_URI,
    error: lastError
  });
});

app.post('/api/log-error', (req, res) => {
  console.error("CLIENT ERROR:", req.body);
  res.json({ success: true });
});

app.post('/api/reconnect', async (req, res) => {
  await disconnectDB();
  const result = await connectDB(MONGODB_URI);
  if (result.isConnected) {
    res.json({ success: true, message: 'Reconnected successfully.' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

// Mount modular routes
app.use('/api', apiRoutes);

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
