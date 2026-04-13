import { createApp } from './app';
import { env } from './config/env';
import { getPrismaClient } from './integrations/prismaIntegration';
import { logger } from './utils/logger';

process.on('unhandledRejection', (reason) => {
  logger.error({
    message: 'Unhandled promise rejection',
    error: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (error) => {
  logger.error({
    message: 'Uncaught exception',
    error: error.message
  });
});

const app = createApp();
const prisma = getPrismaClient();

const server = app.listen(env.PORT, () => {
  logger.info({ message: 'Server started', port: env.PORT });
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ message: 'Shutdown signal received', signal });

  server.close(async () => {
    await prisma.$disconnect();
    logger.info({ message: 'Server and DB disconnected' });
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
