import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin wrapper around ioredis that is used for:
 *  - pairing session storage (6-digit code -> sessionId)
 *  - clipboard history (Redis lists, capped by length)
 *
 * If Redis is not reachable (e.g. running the demo locally without infra),
 * this service transparently falls back to an in-memory store so the app
 * still works for development/demo purposes. In production, always run a
 * real Redis instance (see docker-compose.yml).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private usingFallback = false;

  // in-memory fallback store
  private mem = new Map<string, string>();
  private memLists = new Map<string, string[]>();

  constructor() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        retryStrategy: () => null, // don't keep retrying forever
        maxRetriesPerRequest: 1,
      });

      this.client.on('error', (err) => {
        if (!this.usingFallback) {
          this.usingFallback = true;
          this.logger.warn(
            `Redis unavailable (${err.message}). Falling back to in-memory store (dev mode only).`,
          );
        }
      });

      this.client.connect().catch(() => {
        this.usingFallback = true;
        this.logger.warn(
          'Could not connect to Redis. Falling back to in-memory store (dev mode only).',
        );
      });
    } catch (e) {
      this.usingFallback = true;
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  private get live() {
    // Checking actual connection status (rather than just "have we seen an
    // error event yet") avoids a race: ioredis queues commands sent before
    // the connection settles, and if the connection then fails, those
    // queued commands reject with "Connection is closed" even though our
    // error listener hasn't necessarily flipped `usingFallback` yet.
    return !this.usingFallback && this.client?.status === 'ready';
  }

  /** Runs a live-Redis operation, but transparently falls back to the
   * in-memory store (and marks fallback mode) if Redis throws at runtime —
   * e.g. the connection drops between the `live` check and the command
   * actually executing. */
  private async withFallback<T>(
    liveFn: () => Promise<T>,
    fallbackFn: () => T | Promise<T>,
  ): Promise<T> {
    if (!this.live) return fallbackFn();
    try {
      return await liveFn();
    } catch (err) {
      if (!this.usingFallback) {
        this.usingFallback = true;
        this.logger.warn(
          `Redis operation failed (${(err as Error).message}). Falling back to in-memory store.`,
        );
      }
      return fallbackFn();
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.withFallback(
      async () => {
        await this.client.set(key, value);
      },
      () => {
        this.mem.set(key, value);
      },
    );
  }

  async get(key: string): Promise<string | null> {
    return this.withFallback(
      () => this.client.get(key),
      () => this.mem.get(key) ?? null,
    );
  }

  async del(key: string): Promise<void> {
    await this.withFallback(
      async () => {
        await this.client.del(key);
      },
      () => {
        this.mem.delete(key);
        this.memLists.delete(key);
      },
    );
  }

  /** Push a JSON item onto the head of a list, trim to maxLength. */
  async listPushCapped(
    key: string,
    item: string,
    maxLength: number,
  ): Promise<void> {
    await this.withFallback(
      async () => {
        const pipeline = this.client.pipeline();
        pipeline.lpush(key, item);
        pipeline.ltrim(key, 0, maxLength - 1);
        await pipeline.exec();
      },
      () => {
        const list = this.memLists.get(key) ?? [];
        list.unshift(item);
        this.memLists.set(key, list.slice(0, maxLength));
      },
    );
  }

  async listAll(key: string): Promise<string[]> {
    return this.withFallback(
      () => this.client.lrange(key, 0, -1),
      () => this.memLists.get(key) ?? [],
    );
  }

  async listReplace(key: string, items: string[]) {
    await this.withFallback(
      async () => {
        const pipeline = this.client.pipeline();
        pipeline.del(key);
        if (items.length) pipeline.rpush(key, ...items);
        await pipeline.exec();
      },
      () => {
        this.memLists.set(key, items);
      },
    );
  }

  async exists(key: string): Promise<boolean> {
    return this.withFallback(
      async () => (await this.client.exists(key)) === 1,
      () => this.mem.has(key) || this.memLists.has(key),
    );
  }
}
