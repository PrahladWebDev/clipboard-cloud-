import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveSnippetDto {
  @IsIn(['text', 'url', 'image', 'file'])
  type: 'text' | 'url' | 'image' | 'file';

  @IsString()
  @MaxLength(200_000)
  content: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsBoolean()
  encrypted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
