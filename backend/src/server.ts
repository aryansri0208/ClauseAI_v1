import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { logger } from './config/logger';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';

import companyRoutes from './routes/company.routes';
import vendorRoutes from './routes/vendor.routes';
import scanRoutes from './routes/scan.routes';
import systemRoutes from './routes/system.routes';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN ?? true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/company', companyRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/systems', systemRoutes);

app.use(errorMiddleware);

const server = app.listen(env.PORT, () => {
  logger.info('ClauseAI backend started', { port: env.PORT, nodeEnv: env.NODE_ENV });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});

export default app;
