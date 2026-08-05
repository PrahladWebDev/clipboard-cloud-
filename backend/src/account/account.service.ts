import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SavedSnippet, SavedSnippetDocument } from './schemas/saved-snippet.schema';
import { SaveSnippetDto } from './dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(SavedSnippet.name)
    private snippetModel: Model<SavedSnippetDocument>,
  ) {}

  async saveSnippet(userId: string, dto: SaveSnippetDto) {
    return this.snippetModel.create({ ...dto, owner: new Types.ObjectId(userId) });
  }

  async listSnippets(userId: string) {
    return this.snippetModel
      .find({ owner: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async deleteSnippet(userId: string, snippetId: string) {
    const snippet = await this.snippetModel.findById(snippetId);
    if (!snippet) throw new NotFoundException('Snippet not found.');
    if (snippet.owner.toString() !== userId) {
      throw new ForbiddenException("You don't own this snippet.");
    }
    await snippet.deleteOne();
    return { ok: true };
  }
}
