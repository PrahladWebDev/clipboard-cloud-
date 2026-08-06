import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
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
import { extname, join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { RedisService } from '../redis/redis.service';

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const maxSizeMb = Number(process.env.MAX_FILE_SIZE_MB) || 25;

// Extensions we refuse to serve/execute-adjacent content for. This isn't a
// substitute for a real malware scan, but blocks the most obvious abuse of a
// public, no-login file relay.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr', '.jar', '.app',
]);

const fileOwnerKey = (fileName: string) => `file-owner:${fileName}`;

@Controller('files')
export class FilesController {
  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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

    return {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      fileUrl: `/api/files/${file.filename}`,
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
    @Headers('authorization') authHeader: string,
    @Res() res: Response,
  ) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(uploadDir, safeName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found.');
    }

    // Two ways to be authorized to download:
    //  1. The request carries the sessionId that owns the file (normal
    //     pairing flow, checked against Redis).
    //  2. The request carries a valid account JWT — this covers snippets a
    //     signed-in user explicitly saved.
    if (this.hasValidBearerToken(authHeader)) {
      return res.sendFile(filePath, { root: '.' });
    }

    const owner = await this.redis.get(fileOwnerKey(safeName));
    if (!owner || !sessionId || owner !== sessionId) {
      throw new BadRequestException(
        'A valid sessionId (or account login) is required to download this file.',
      );
    }

    return res.sendFile(filePath, { root: '.' });
  }
}
