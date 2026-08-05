import { NotFoundException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PairingService } from './pairing.service';

describe('PairingService', () => {
  let service: PairingService;

  beforeEach(() => {
    service = new PairingService(new RedisService());
  });

  it('creates a session with a 6-digit code and a QR data URL', async () => {
    const session = await service.createSession({ origin: 'http://localhost:3000' });
    expect(session.sessionId).toBeDefined();
    expect(session.code).toMatch(/^\d{6}$/);
    expect(session.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('resolves the correct sessionId when joining by code', async () => {
    const session = await service.createSession({ origin: 'http://localhost:3000' });
    const joined = await service.joinByCode(session.code);
    expect(joined.sessionId).toBe(session.sessionId);
  });

  it('throws NotFoundException for an unknown code', async () => {
    await expect(service.joinByCode('000000')).rejects.toThrow(NotFoundException);
  });

  it('increments the device count when a second device joins', async () => {
    const session = await service.createSession({ origin: 'http://localhost:3000' });
    await service.joinByCode(session.code);
    const record = await service.getSession(session.sessionId);
    expect(record.devices).toBe(2);
  });

  it('throws NotFoundException for an expired/unknown sessionId', async () => {
    await expect(service.getSession('does-not-exist')).rejects.toThrow(NotFoundException);
  });
});
