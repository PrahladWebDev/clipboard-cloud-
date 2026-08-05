import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RedisModule } from './redis/redis.module';
import { PairingModule } from './pairing/pairing.module';
import { ClipboardModule } from './clipboard/clipboard.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Sane global default; individual routes (pairing join, file upload,
        // auth) apply stricter @Throttle() overrides where brute-forcing or
        // abuse is a bigger concern.
        ttl: 60_000,
        limit: 120,
      },
    ]),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clipboard-cloud',
      {
        serverSelectionTimeoutMS: 3000,
        // NestJS awaits the Mongo connection during bootstrap, so an
        // unreachable Mongo currently blocks the whole app (including the
        // core, login-free pairing/clipboard-sync routes) — not just
        // /auth and /account. These bounded retries make that fail fast
        // with a clear error (~15s) instead of hanging forever. See the
        // README for the honest tradeoff and how to run without Mongo.
        retryAttempts: 5,
        retryDelay: 3000,
      },
    ),
    RedisModule,
    PairingModule,
    ClipboardModule,
    FilesModule,
    AuthModule,
    AccountModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
