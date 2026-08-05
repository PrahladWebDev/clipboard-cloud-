import { RedisService } from './redis.service';

// No Redis instance is expected to be reachable in the unit test
// environment, so this exercises the in-memory fallback path — which is
// exactly what local/dev users without Docker will experience too.
describe('RedisService (in-memory fallback)', () => {
  let service: RedisService;

  beforeEach(() => {
    service = new RedisService();
  });

  it('sets and gets a value', async () => {
    await service.set('k1', 'hello');
    expect(await service.get('k1')).toBe('hello');
  });

  it('returns null for missing keys', async () => {
    expect(await service.get('does-not-exist')).toBeNull();
  });

  it('deletes a value', async () => {
    await service.set('k2', 'v');
    await service.del('k2');
    expect(await service.get('k2')).toBeNull();
  });

  it('expires a value after the given TTL', async () => {
    await service.set('k3', 'v', 0.05); // 50ms
    expect(await service.get('k3')).toBe('v');
    await new Promise((r) => setTimeout(r, 120));
    expect(await service.get('k3')).toBeNull();
  });

  it('caps a list with listPushCapped', async () => {
    for (let i = 0; i < 5; i++) {
      await service.listPushCapped('list1', `item-${i}`, 3);
    }
    const items = await service.listAll('list1');
    expect(items).toHaveLength(3);
    expect(items[0]).toBe('item-4'); // most recent first
  });

  it('reports existence correctly', async () => {
    expect(await service.exists('nope')).toBe(false);
    await service.set('yes', '1');
    expect(await service.exists('yes')).toBe(true);
  });
});
