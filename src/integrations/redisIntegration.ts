import { env } from '../config/env';
import { logger } from '../utils/logger';

interface ValueEntry {
  value: string;
  expiresAt: number;
}

class InMemoryRedisLike {
  private readonly map = new Map<string, ValueEntry>();

  public async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    return entry.value;
  }

  public async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  public async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    const current = await this.get(key);
    if (current !== null) {
      return false;
    }

    await this.set(key, value, ttlMs);
    return true;
  }

  public async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  setNx(key: string, value: string, ttlMs: number): Promise<boolean>;
  del(key: string): Promise<void>;
}

class RedisClientAdapter implements RedisLikeClient {
  private readonly memory = new InMemoryRedisLike();

  public async get(key: string): Promise<string | null> {
    return this.memory.get(key);
  }

  public async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.memory.set(key, value, ttlMs);
  }

  public async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    return this.memory.setNx(key, value, ttlMs);
  }

  public async del(key: string): Promise<void> {
    await this.memory.del(key);
  }
}

let singleton: RedisLikeClient | null = null;

export const getRedisClient = (): RedisLikeClient => {
  if (singleton) {
    return singleton;
  }

  if (env.REDIS_URL.trim().length > 0) {
    logger.info({
      message: 'REDIS_URL provided. Falling back to in-memory Redis-compatible store in current build.'
    });
  }

  singleton = new RedisClientAdapter();
  return singleton;
};
