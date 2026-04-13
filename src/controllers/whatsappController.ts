import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ExpenseService } from '../services/expenseService';
import { TwilioIntegration } from '../integrations/twilioIntegration';
import { whatsappWebhookSchema } from '../validators/webhookValidator';
import { logger } from '../utils/logger';

export class WhatsAppController {
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly twilioIntegration: TwilioIntegration
  ) {}

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = whatsappWebhookSchema.parse(req.body);

      logger.info({
        message: 'Incoming WhatsApp webhook',
        from: payload.From,
        body: payload.Body
      });

      const reply = await this.expenseService.handleIncomingMessage(payload.From, payload.Body);
      const twiml = this.twilioIntegration.createMessagingResponse(reply);

      res.status(200).type('text/xml').send(twiml);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error({
          message: 'Invalid webhook payload',
          issues: error.issues
        });

        const twiml = this.twilioIntegration.createMessagingResponse(
          'Invalid request payload received.'
        );

        res.status(400).type('text/xml').send(twiml);
        return;
      }

      logger.error({
        message: 'Unhandled webhook controller error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const twiml = this.twilioIntegration.createMessagingResponse(
        'Something went wrong. Please try again.'
      );

      res.status(500).type('text/xml').send(twiml);
    }
  };
}
