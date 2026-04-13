import { env } from '../config/env';
import { getRedisClient, RedisLikeClient } from '../integrations/redisIntegration';

export class LockService {
  private readonly client: RedisLikeClient;

  constructor(client?: RedisLikeClient) {
    this.client = client ?? getRedisClient();
  }

  private key(userId: string): string {
    return `lock:${userId}`;
  }

  public async acquire(userId: string): Promise<boolean> {
    return this.client.setNx(this.key(userId), '1', env.USER_LOCK_TTL_MS);
  }

  public async release(userId: string): Promise<void> {
    await this.client.del(this.key(userId));
  }
}
