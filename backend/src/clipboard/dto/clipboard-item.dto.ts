import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type ClipboardItemType = 'text' | 'url' | 'image' | 'file';

export class PushClipboardItemDto {
  @IsIn(['text', 'url', 'image', 'file'])
  type: ClipboardItemType;

  /** For text/url/image(base64 data-url): the raw content. For file: metadata only. */
  @IsString()
  @MaxLength(500_000, {
    message: 'Clipboard content is too large (500KB max for text/links).',
  })
  content: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsBoolean()
  encrypted?: boolean;

  @IsOptional()
  @IsString()
  deviceLabel?: string;

  /** Optional free-text note shown to every device explaining what this
   * content is / what it's for, e.g. "Wifi password for the office". */
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Description can be at most 300 characters.' })
  description?: string;
}

export interface ClipboardItem {
  id: string;
  type: ClipboardItemType;
  content: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  encrypted?: boolean;
  deviceLabel?: string;
  description?: string;
  pinned: boolean;
  createdAt: number;
  /** Socket id of whoever pushed this item — set server-side, never trusted
   * from the client — so we can tell the sender apart from other devices
   * for permission checks (e.g. only the sender or the host may delete). */
  senderSocketId?: string;
}
