import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthResponseDto, LoginUserDto, CreateUserDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { BcryptAdapter } from './adapters/bcrypt.adapter';
import type { HashAdapter } from './interfaces/hash-adapter.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(BcryptAdapter) private readonly hashAdapter: HashAdapter,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(createUserDto.email);

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing)
      throw new ConflictException('User with that email already exists');

    const { password, ...userData } = createUserDto;

    const user = this.userRepository.create({
      ...userData,
      email,
      password: await this.hashAdapter.hash(password),
    });

    try {
      await this.userRepository.save(user);
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('User with that email already exists');
      }

      throw error;
    }

    return this.buildAuthResponse(user);
  }

  async login(loginUserDto: LoginUserDto): Promise<AuthResponseDto> {
    const { password } = loginUserDto;
    const email = this.normalizeEmail(loginUserDto.email);

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        fullname: true,
        isActive: true,
        roles: true,
      },
    });

    if (!user) throw new UnauthorizedException('Credentials are not valid');

    if (!(await this.hashAdapter.compare(password, user.password)))
      throw new UnauthorizedException('Credentials are not valid');

    if (!user.isActive)
      throw new UnauthorizedException('User is inactive, talk with an admin');

    return this.buildAuthResponse(user);
  }

  checkAuthStatus(user: User): AuthResponseDto {
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User): AuthResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      isActive: user.isActive,
      roles: user.roles,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}
