import express, { Express, Request, Response } from 'express';
import { WhatsAppController } from './controllers/whatsappController';
import { AIIntegration } from './integrations/aiIntegration';
import { TwilioIntegration } from './integrations/twilioIntegration';
import { ExpenseRepository } from './repositories/expense.repository';
import { SplitRepository } from './repositories/split.repository';
import { UserRepository } from './repositories/user.repository';
import { ExpenseService } from './services/expenseService';
import { GroupManager } from './utils/groupManager';
import { rateLimiter } from './utils/rateLimiter';
import { SessionManager } from './utils/sessionManager';

export const createApp = (): Express => {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  const aiIntegration = new AIIntegration();
  const twilioIntegration = new TwilioIntegration();
  const userRepository = new UserRepository();
  const expenseRepository = new ExpenseRepository();
  const splitRepository = new SplitRepository();
  const sessionManager = new SessionManager();
  const groupManager = new GroupManager();

  const expenseService = new ExpenseService(
    aiIntegration,
    userRepository,
    expenseRepository,
    splitRepository,
    sessionManager,
    groupManager
  );

  const whatsappController = new WhatsAppController(expenseService, twilioIntegration);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/webhook/whatsapp', rateLimiter, whatsappController.handleWebhook);

  return app;
};
