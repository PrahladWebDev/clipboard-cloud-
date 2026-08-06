import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClipboardService } from './clipboard.service';
import { PairingService } from '../pairing/pairing.service';
import { PushClipboardItemDto } from './dto/clipboard-item.dto';

interface JoinRoomPayload {
  sessionId: string;
  deviceLabel?: string;
}

interface DeviceInfo {
  socketId: string;
  deviceLabel: string;
  joinedAt: number;
  isHost: boolean;
}

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' },
})
export class ClipboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ClipboardGateway.name);

  // socket.id -> sessionId, so we can clean up on disconnect
  private socketSessions = new Map<string, string>();
  // sessionId -> (socketId -> DeviceInfo), for the device list UI
  private roomDevices = new Map<string, Map<string, DeviceInfo>>();
  // sessionId -> socketId of the device that generated/created the session
  // (the first device to join the room). Used to label devices as
  // "Host" (generated) vs "Joined" in the UI.
  private roomHost = new Map<string, string>();

  constructor(
    private readonly clipboardService: ClipboardService,
    private readonly pairingService: PairingService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const sessionId = this.socketSessions.get(client.id);
    if (sessionId) {
      this.removeDevice(sessionId, client.id);
      client.to(sessionId).emit('device:left', { socketId: client.id });
      this.emitDeviceList(sessionId);
      this.socketSessions.delete(client.id);
    }
  }

  private emitDeviceList(sessionId: string) {
    const devices = Array.from(this.roomDevices.get(sessionId)?.values() ?? []);
    this.server.to(sessionId).emit('devices:update', devices);
  }

  private removeDevice(sessionId: string, socketId: string) {
    const room = this.roomDevices.get(sessionId);
    room?.delete(socketId);

    if (!room || room.size === 0) {
      this.roomDevices.delete(sessionId);
      this.roomHost.delete(sessionId);
      return;
    }

    // If the host device left, hand the "Host" label to whichever
    // remaining device joined earliest, so the badge doesn't just vanish.
    if (this.roomHost.get(sessionId) === socketId) {
      const next = Array.from(room.values()).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      this.roomHost.set(sessionId, next.socketId);
      room.forEach((d) => (d.isHost = d.socketId === next.socketId));
    }
  }

  @SubscribeMessage('room:join')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const { sessionId, deviceLabel } = payload;
    try {
      await this.pairingService.getSession(sessionId);
    } catch {
      client.emit('room:error', { message: 'Session not found.' });
      return;
    }

    client.join(sessionId);
    this.socketSessions.set(client.id, sessionId);

    if (!this.roomDevices.has(sessionId)) {
      this.roomDevices.set(sessionId, new Map());
    }

    // The first device to join a room is the one that generated the
    // session (it creates the session via REST, then immediately joins).
    // Every later joiner is a "guest" that scanned/entered the code.
    if (!this.roomHost.has(sessionId)) {
      this.roomHost.set(sessionId, client.id);
    }

    this.roomDevices.get(sessionId).set(client.id, {
      socketId: client.id,
      deviceLabel: deviceLabel || 'Unknown device',
      joinedAt: Date.now(),
      isHost: this.roomHost.get(sessionId) === client.id,
    });

    const history = await this.clipboardService.getHistory(sessionId);
    client.emit('history:sync', history);

    client.to(sessionId).emit('device:joined', {
      socketId: client.id,
      deviceLabel: deviceLabel || 'Unknown device',
    });
    this.emitDeviceList(sessionId);
  }

  @SubscribeMessage('device:kick')
  async onKickDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; socketId: string },
  ) {
    const { sessionId, socketId } = payload;
    // Only allow kicking devices within the same room the requester is in.
    if (this.socketSessions.get(client.id) !== sessionId) return;

    const targetSocket = this.server.sockets.sockets.get(socketId);
    if (targetSocket) {
      targetSocket.emit('device:kicked');
      targetSocket.leave(sessionId);
      targetSocket.disconnect(true);
    }
    this.removeDevice(sessionId, socketId);
    this.socketSessions.delete(socketId);
    this.emitDeviceList(sessionId);
  }

  @SubscribeMessage('clipboard:push')
  async onClipboardPush(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string } & PushClipboardItemDto,
  ): Promise<{ ok: boolean; message?: string; itemId?: string }> {
    // Returning a value here doubles as the ack: when the frontend calls
    // socket.emit('clipboard:push', payload, callback), socket.io invokes
    // that callback with whatever this handler returns. That's what powers
    // the "Sent ✓ / Failed to send" feedback in the UI.
    const { sessionId, ...rest } = payload;
    const dto = plainToInstance(PushClipboardItemDto, rest);
    const errors = await validate(dto);
    if (errors.length) {
      const message = errors
        .map((e) => Object.values(e.constraints || {}).join(', '))
        .join('; ');
      client.emit('clipboard:error', { message });
      return { ok: false, message };
    }

    try {
      const item = await this.clipboardService.addItem(sessionId, dto, client.id);
      // Broadcast to every device in the room, including the sender, so all
      // UIs (including the one that just pasted) stay in sync with the
      // canonical, capped/pinned-aware history order.
      this.server.to(sessionId).emit('clipboard:new', item);
      return { ok: true, itemId: item.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send item.';
      client.emit('clipboard:error', { message });
      return { ok: false, message };
    }
  }

  @SubscribeMessage('clipboard:pin')
  async onPin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; itemId: string; pinned: boolean },
  ) {
    const updated = await this.clipboardService.setPinned(
      payload.sessionId,
      payload.itemId,
      payload.pinned,
    );
    this.server.to(payload.sessionId).emit('history:sync', updated);
  }

  @SubscribeMessage('clipboard:delete')
  async onDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; itemId: string },
  ) {
    const isHost = this.roomDevices
      .get(payload.sessionId)
      ?.get(client.id)?.isHost;

    try {
      const updated = await this.clipboardService.deleteItem(
        payload.sessionId,
        payload.itemId,
        client.id,
        !!isHost,
      );
      this.server.to(payload.sessionId).emit('history:sync', updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete item.';
      client.emit('clipboard:error', { message });
    }
  }

  @SubscribeMessage('clipboard:clear')
  async onClear(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    await this.clipboardService.clearHistory(payload.sessionId);
    this.server.to(payload.sessionId).emit('history:sync', []);
  }
}
