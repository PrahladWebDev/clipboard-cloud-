import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsBoolean()
  encrypted?: boolean;
}

export class JoinSessionDto {
  @IsString()
  @Length(6, 6, { message: 'Pairing code must be exactly 6 digits.' })
  code: string;
}
