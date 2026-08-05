import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';
import { SaveSnippetDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('snippets')
  async save(@Req() req: any, @Body() dto: SaveSnippetDto) {
    return this.accountService.saveSnippet(req.user.userId, dto);
  }

  @Get('snippets')
  async list(@Req() req: any) {
    return this.accountService.listSnippets(req.user.userId);
  }

  @Delete('snippets/:id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.accountService.deleteSnippet(req.user.userId, id);
  }
}
