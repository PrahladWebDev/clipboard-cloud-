import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PairingService } from './pairing.service';
import { CreateSessionDto, JoinSessionDto } from './dto';

@Controller('pairing')
export class PairingController {
  constructor(private readonly pairingService: PairingService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('create')
  async create(
    @Body() dto: CreateSessionDto,
    @Headers('origin') origin?: string,
  ) {
    return this.pairingService.createSession({
      encrypted: dto.encrypted,
      origin: origin || process.env.CORS_ORIGIN || 'http://localhost:3000',
    });
  }

  // Only 1,000,000 possible 6-digit codes exist, so this endpoint gets a much
  // tighter limit than the rest of the API to make brute-forcing impractical.
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('join')
  async join(@Body() dto: JoinSessionDto) {
    return this.pairingService.joinByCode(dto.code);
  }

  @Get(':sessionId')
  async get(@Param('sessionId') sessionId: string) {
    return this.pairingService.getSession(sessionId);
  }
}
