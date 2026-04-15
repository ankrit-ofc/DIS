import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import healthRouter    from './routes/health';
import authRouter      from './routes/auth';
import productsRouter  from './routes/products';
import ordersRouter    from './routes/orders';
import customersRouter from './routes/customers';
import ledgerRouter    from './routes/ledger';
import inventoryRouter from './routes/inventory';
import paymentsRouter  from './routes/payments';
import reportsRouter   from './routes/reports';
import publicRouter    from './routes/public';
import adminRouter     from './routes/admin';
import chatRouter      from './routes/chat';
import { startCleanupCron } from './lib/cleanup';
import { apiLimiter } from './middleware/rateLimiter';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(apiLimiter);

app.use('/api/health',    healthRouter);
app.use('/api/auth',      authRouter);
app.use('/api/products',  productsRouter);
app.use('/api/orders',    ordersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/ledger',    ledgerRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/payments',  paymentsRouter);
app.use('/api/reports',   reportsRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/chat',      chatRouter);
app.use('/api',           publicRouter);  // announcements, districts, categories

// Global error handler — catch unhandled errors from async routes
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[API] Unhandled error:', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = parseInt(process.env.API_PORT || '3001');
app.listen(PORT, '127.0.0.1', () => {
  console.log(`DISTRO API running on 127.0.0.1:${PORT}`);
  startCleanupCron();
});

export default app;
