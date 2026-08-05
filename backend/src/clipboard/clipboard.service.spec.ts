import { RedisService } from '../redis/redis.service';
import { ClipboardService } from './clipboard.service';
import { PushClipboardItemDto } from './dto/clipboard-item.dto';

const textItem = (content: string): PushClipboardItemDto => ({
  type: 'text',
  content,
});

describe('ClipboardService', () => {
  let service: ClipboardService;
  const sessionId = 'test-session';

  beforeEach(() => {
    service = new ClipboardService(new RedisService());
  });

  it('adds an item and retrieves it in history', async () => {
    await service.addItem(sessionId, textItem('hello world'));
    const history = await service.getHistory(sessionId);
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe('hello world');
    expect(history[0].pinned).toBe(false);
  });

  it('orders history with most recent first', async () => {
    await service.addItem(sessionId, textItem('first'));
    await service.addItem(sessionId, textItem('second'));
    const history = await service.getHistory(sessionId);
    expect(history[0].content).toBe('second');
    expect(history[1].content).toBe('first');
  });

  it('pins an item so it survives beyond the unpinned cap', async () => {
    const first = await service.addItem(sessionId, textItem('keep me'));
    await service.setPinned(sessionId, first.id, true);

    // Push far more items than the default history limit.
    for (let i = 0; i < 25; i++) {
      await service.addItem(sessionId, textItem(`filler-${i}`));
    }

    const history = await service.getHistory(sessionId);
    const pinnedItem = history.find((i) => i.id === first.id);
    expect(pinnedItem).toBeDefined();
    expect(pinnedItem?.pinned).toBe(true);
  });

  it('deletes an item by id', async () => {
    const item = await service.addItem(sessionId, textItem('to delete'));
    await service.deleteItem(sessionId, item.id);
    const history = await service.getHistory(sessionId);
    expect(history.find((i) => i.id === item.id)).toBeUndefined();
  });

  it('searches history by content substring', async () => {
    await service.addItem(sessionId, textItem('the quick brown fox'));
    await service.addItem(sessionId, textItem('lazy dog'));
    const results = await service.search(sessionId, 'quick');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('quick');
  });

  it('clears all history for a session', async () => {
    await service.addItem(sessionId, textItem('one'));
    await service.clearHistory(sessionId);
    const history = await service.getHistory(sessionId);
    expect(history).toHaveLength(0);
  });
});
