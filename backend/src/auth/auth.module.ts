import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // registerAsync + ConfigService (rather than a plain object with
    // process.env.JWT_SECRET) defers reading the secret until Nest actually
    // instantiates this provider, instead of at module-import time — which
    // matters because AuthModule can be imported (and its decorator
    // evaluated) before ConfigModule.forRoot() has loaded .env, depending
    // on import order elsewhere in the app. Reading process.env directly
    // in a static register() risks silently signing tokens with the
    // 'dev-secret-change-me' fallback while JwtStrategy verifies them with
    // the real secret loaded later — a mismatch that fails every request.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
