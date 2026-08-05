import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { RedisService } from '../redis/redis.service';
import { generatePairingCode } from '../common/utils/code-generator';

const SESSION_PREFIX = 'session:';
const CODE_PREFIX = 'code:';

export interface SessionRecord {
  sessionId: string;
  createdAt: number;
  devices: number;
  encrypted: boolean;
}

@Injectable()
export class PairingService {
  private ttl = Number(process.env.SESSION_TTL_SECONDS) || 1800;

  constructor(private readonly redis: RedisService) {}

  async createSession(opts: { encrypted?: boolean; origin: string }) {
    const sessionId = uuidv4();
    let code = generatePairingCode();

    // Make sure the code isn't already in use (extremely unlikely, but be safe).
    let attempts = 0;
    while ((await this.redis.exists(CODE_PREFIX + code)) && attempts < 5) {
      code = generatePairingCode();
      attempts++;
    }

    const record: SessionRecord = {
      sessionId,
      createdAt: Date.now(),
      devices: 1,
      encrypted: !!opts.encrypted,
    };

    await this.redis.set(
      SESSION_PREFIX + sessionId,
      JSON.stringify(record),
      this.ttl,
    );
    await this.redis.set(CODE_PREFIX + code, sessionId, this.ttl);

    const pairUrl = `${opts.origin}/clipboard/${sessionId}?code=${code}`;
    const qrDataUrl = await QRCode.toDataURL(pairUrl, {
      margin: 1,
      width: 320,
    });

    return { sessionId, code, qrDataUrl, expiresInSeconds: this.ttl };
  }

  async joinByCode(code: string) {
    const sessionId = await this.redis.get(CODE_PREFIX + code.trim());
    if (!sessionId) {
      throw new NotFoundException(
        'Invalid or expired pairing code. Ask the other device to generate a new one.',
      );
    }
    await this.touchDeviceJoin(sessionId);
    return { sessionId };
  }

  async getSession(sessionId: string): Promise<SessionRecord> {
    const raw = await this.redis.get(SESSION_PREFIX + sessionId);
    if (!raw) {
      throw new NotFoundException('Session not found or has expired.');
    }
    return JSON.parse(raw);
  }

  async touchDeviceJoin(sessionId: string) {
    const raw = await this.redis.get(SESSION_PREFIX + sessionId);
    if (!raw) return;
    const record: SessionRecord = JSON.parse(raw);
    record.devices += 1;
    await this.redis.set(SESSION_PREFIX + sessionId, JSON.stringify(record), this.ttl);
  }

  /** Refresh TTL on activity so active sessions don't expire mid-use. */
  async keepAlive(sessionId: string) {
    await this.redis.expire(SESSION_PREFIX + sessionId, this.ttl);
    await this.redis.expire(`clipboard:${sessionId}`, this.ttl);
  }
}
