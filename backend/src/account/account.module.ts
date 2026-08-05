import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { SavedSnippet, SavedSnippetSchema } from './schemas/saved-snippet.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: SavedSnippet.name, schema: SavedSnippetSchema },
    ]),
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
