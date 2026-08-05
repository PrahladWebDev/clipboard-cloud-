import { Module } from '@nestjs/common';
import { ClipboardController } from './clipboard.controller';
import { ClipboardService } from './clipboard.service';
import { ClipboardGateway } from './clipboard.gateway';
import { PairingModule } from '../pairing/pairing.module';

@Module({
  imports: [PairingModule],
  controllers: [ClipboardController],
  providers: [ClipboardService, ClipboardGateway],
  exports: [ClipboardService],
})
export class ClipboardModule {}
