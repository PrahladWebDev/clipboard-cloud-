import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SavedSnippetDocument = SavedSnippet & Document;

@Schema({ timestamps: true })
export class SavedSnippet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, enum: ['text', 'url', 'image', 'file'] })
  type: string;

  @Prop({ required: true })
  content: string;

  @Prop()
  fileName?: string;

  @Prop()
  fileUrl?: string;

  @Prop()
  mimeType?: string;

  @Prop({ default: false })
  encrypted: boolean;

  @Prop()
  description?: string;
}

export const SavedSnippetSchema = SchemaFactory.createForClass(SavedSnippet);
