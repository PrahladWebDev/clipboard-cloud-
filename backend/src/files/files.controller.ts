import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { existsSync, promises as fsp } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { RedisService } from '../redis/redis.service';

const uploadDir = process.env.UPLOAD_DIR || './uploads';
// Hard cap per file. 50 MB unless overridden by MAX_FILE_SIZE_MB.
const maxSizeMb = Number(process.env.MAX_FILE_SIZE_MB) || 50;
// Uploaded files are deleted this many hours after upload (default 24h).
const fileTtlHours = Number(process.env.FILE_TTL_HOURS) || 24;
const fileTtlMs = fileTtlHours * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

// Extensions we refuse to serve/execute-adjacent content for. This isn't a
// substitute for a real malware scan, but blocks the most obvious abuse of a
// public, no-login file relay.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr', '.jar', '.app',
]);

const fileOwnerKey = (fileName: string) => `file-owner:${fileName}`;
const fileNameKey = (fileName: string) => `file-name:${fileName}`;

@Controller('files')
export class FilesController implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FilesController.name);
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.cleanupExpiredFiles();
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredFiles(),
      CLEANUP_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /** Deletes every uploaded file older than the TTL (24h by default). */
  private async cleanupExpiredFiles() {
    try {
      const names = await fsp.readdir(uploadDir);
      const now = Date.now();
      for (const name of names) {
        const full = join(uploadDir, name);
        try {
          const stat = await fsp.stat(full);
          if (!stat.isFile() || now - stat.mtimeMs < fileTtlMs) continue;
          await fsp.unlink(full);
          await this.redis.del(fileOwnerKey(name));
          await this.redis.del(fileNameKey(name));
          this.logger.log(`Deleted expired upload ${name}`);
        } catch {
          // file vanished or is locked — try again next sweep
        }
      }
    } catch (err) {
      this.logger.warn(`Upload cleanup failed: ${(err as Error).message}`);
    }
  }

  // Upload rate limit: 5 uploads per minute per IP (global limit is 120/min).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          if (BLOCKED_EXTENSIONS.has(ext)) {
            cb(new BadRequestException(`File type ${ext} is not allowed.`), '');
            return;
          }
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: maxSizeMb * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!sessionId) {
      throw new BadRequestException('sessionId is required to upload a file.');
    }

    // Record which session "owns" this file so only paired devices in that
    // session (or, later, the authenticated account that saved it — see
    // download()) can retrieve it, rather than anyone who guesses the URL.
    await this.redis.set(fileOwnerKey(file.filename), sessionId);
    await this.redis.set(fileNameKey(file.filename), file.originalname);

    return {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      fileUrl: `/api/files/${file.filename}`,
      expiresAt: Date.now() + fileTtlMs,
    };
  }

  private hasValidBearerToken(authHeader?: string): boolean {
    if (!authHeader?.startsWith('Bearer ')) return false;
    try {
      this.jwtService.verify(authHeader.slice('Bearer '.length));
      return true;
    } catch {
      return false;
    }
  }

  @Get(':fileName')
  async download(
    @Param('fileName') fileName: string,
    @Query('sessionId') sessionId: string,
    @Query('download') download: string,
    @Headers('authorization') authHeader: string,
    @Res() res: Response,
  ) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(uploadDir, safeName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `File not found — files are deleted ${fileTtlHours} hours after upload.`,
      );
    }

    // Two ways to be authorized to download:
    //  1. The request carries the sessionId that owns the file (normal
    //     pairing flow, checked against Redis).
    //  2. The request carries a valid account JWT — this covers snippets a
    //     signed-in user explicitly saved.
    const authorized = this.hasValidBearerToken(authHeader);
    if (!authorized) {
      const owner = await this.redis.get(fileOwnerKey(safeName));
      if (!owner || !sessionId || owner !== sessionId) {
        throw new BadRequestException(
          'A valid sessionId (or account login) is required to download this file.',
        );
      }
    }

    // ?download=1 forces a "Save as…" download using the original file name.
    if (download === '1') {
      const original = (await this.redis.get(fileNameKey(safeName))) || safeName;
      return res.download(resolve(filePath), original);
    }
    return res.sendFile(filePath, { root: '.' });
  }
}
