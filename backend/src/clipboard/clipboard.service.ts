import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import { ClipboardItem, PushClipboardItemDto } from './dto/clipboard-item.dto';

const historyKey = (sessionId: string) => `clipboard:${sessionId}`;

@Injectable()
export class ClipboardService {
  private historyLimit = Number(process.env.CLIPBOARD_HISTORY_LIMIT) || 20;

  constructor(private readonly redis: RedisService) {}

  async addItem(
    sessionId: string,
    dto: PushClipboardItemDto,
    senderSocketId?: string,
  ): Promise<ClipboardItem> {
    const item: ClipboardItem = {
      id: uuidv4(),
      type: dto.type,
      content: dto.content,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      mimeType: dto.mimeType,
      encrypted: !!dto.encrypted,
      deviceLabel: dto.deviceLabel,
      description: dto.description,
      pinned: false,
      createdAt: Date.now(),
      senderSocketId,
    };

    // Pinned items must survive the capped-length trim, so we re-implement
    // "push capped but keep pinned" instead of a plain LPUSH/LTRIM.
    const current = await this.getHistory(sessionId);
    const pinned = current.filter((i) => i.pinned);
    const unpinned = current.filter((i) => !i.pinned);
    const merged = [item, ...unpinned].slice(
      0,
      Math.max(this.historyLimit - pinned.length, 1),
    );
    const finalList = [...pinned, ...merged].sort(
      (a, b) => b.createdAt - a.createdAt,
    );

    await this.redis.listReplace(
      historyKey(sessionId),
      finalList.map((i) => JSON.stringify(i)),
    );

    return item;
  }

  async getHistory(sessionId: string): Promise<ClipboardItem[]> {
    const raw = await this.redis.listAll(historyKey(sessionId));
    return raw.map((r) => JSON.parse(r));
  }

  async setPinned(
    sessionId: string,
    itemId: string,
    pinned: boolean,
  ): Promise<ClipboardItem[]> {
    const list = await this.getHistory(sessionId);
    const updated = list.map((i) =>
      i.id === itemId ? { ...i, pinned } : i,
    );
    await this.redis.listReplace(
      historyKey(sessionId),
      updated.map((i) => JSON.stringify(i)),
    );
    return updated;
  }

  async deleteItem(
    sessionId: string,
    itemId: string,
    requesterSocketId: string,
    requesterIsHost: boolean,
  ): Promise<ClipboardItem[]> {
    const list = await this.getHistory(sessionId);
    const target = list.find((i) => i.id === itemId);
    if (!target) return list;

    // Only the device that sent an item, or the host device, may delete it.
    // A guest device shouldn't be able to remove content another device shared.
    const canDelete =
      requesterIsHost || target.senderSocketId === requesterSocketId;
    if (!canDelete) {
      throw new Error('Only the sender or the host device can delete this item.');
    }

    const updated = list.filter((i) => i.id !== itemId);
    await this.redis.listReplace(
      historyKey(sessionId),
      updated.map((i) => JSON.stringify(i)),
    );
    return updated;
  }

  async clearHistory(sessionId: string): Promise<void> {
    await this.redis.del(historyKey(sessionId));
  }

  async search(sessionId: string, query: string): Promise<ClipboardItem[]> {
    const list = await this.getHistory(sessionId);
    const q = query.toLowerCase();
    return list.filter(
      (i) =>
        i.content.toLowerCase().includes(q) ||
        i.fileName?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q),
    );
  }
}
