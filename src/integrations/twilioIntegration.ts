import { twiml } from 'twilio';

export class TwilioIntegration {
  public createMessagingResponse(message: string): string {
    const response = new twiml.MessagingResponse();
    response.message(message);
    return response.toString();
  }
}
