import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClipboardService } from './clipboard.service';

@Controller('clipboard')
export class ClipboardController {
  constructor(private readonly clipboardService: ClipboardService) {}

  @Get(':sessionId/history')
  async history(@Param('sessionId') sessionId: string) {
    return this.clipboardService.getHistory(sessionId);
  }

  @Get(':sessionId/search')
  async search(
    @Param('sessionId') sessionId: string,
    @Query('q') q: string,
  ) {
    if (!q) return this.clipboardService.getHistory(sessionId);
    return this.clipboardService.search(sessionId, q);
  }
}
