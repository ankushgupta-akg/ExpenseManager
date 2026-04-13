import { env } from '../config/env';
import { getRedisClient, RedisLikeClient } from '../integrations/redisIntegration';

export type SessionState =
  | 'IDLE'
  | 'AWAITING_NAME'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_PARTICIPANTS'
  | 'AWAITING_SPLIT'
  | 'PROCESSING';

export type SessionIntent =
  | 'ADD_EXPENSE'
  | 'GET_RECEIVABLE'
  | 'GET_PAYABLE'
  | 'GET_BALANCE'
  | 'SIMPLIFY_DEBTS'
  | 'UNKNOWN';

export interface UserSession {
  userId: string;
  state: SessionState;
  intent: SessionIntent;
  pending_action: string | null;
  data: Record<string, unknown>;
  expires_at: number;
}

export class SessionService {
  private readonly client: RedisLikeClient;

  constructor(client?: RedisLikeClient) {
    this.client = client ?? getRedisClient();
  }

  private key(identityKey: string): string {
    return `session:${identityKey}`;
  }

  public async get(identityKey: string): Promise<UserSession | null> {
    const raw = await this.client.get(this.key(identityKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as UserSession;
    if (Date.now() >= parsed.expires_at) {
      await this.clear(identityKey);
      return null;
    }

    return parsed;
  }

  public async set(
    identityKey: string,
    input: Omit<UserSession, 'expires_at'>
  ): Promise<UserSession> {
    const session: UserSession = {
      ...input,
      expires_at: Date.now() + env.SESSION_TTL_SECONDS * 1000
    };

    await this.client.set(
      this.key(identityKey),
      JSON.stringify(session),
      env.SESSION_TTL_SECONDS * 1000
    );

    return session;
  }

  public async clear(identityKey: string): Promise<void> {
    await this.client.del(this.key(identityKey));
  }
}
