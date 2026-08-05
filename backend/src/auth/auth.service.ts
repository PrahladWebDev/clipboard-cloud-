import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  private async signToken(user: UserDocument) {
    const payload = { sub: user._id.toString(), email: user.email };
    return this.jwtService.signAsync(payload);
  }

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });
    const accessToken = await this.signToken(user);
    return {
      accessToken,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new UnauthorizedException('Invalid email or password.');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password.');
    const accessToken = await this.signToken(user);
    return {
      accessToken,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    };
  }

  async findById(id: string) {
    return this.userModel.findById(id).select('-passwordHash');
  }
}
