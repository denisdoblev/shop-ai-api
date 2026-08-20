import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { User } from './entities/user.entity';
import { LoginUserDto, CreateUserDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { BcryptAdapter } from './adapters/bcrypt.adapter';
import type { HashAdapter } from './interfaces/hash-adapter.interface';

@Injectable()
export class AuthService extends BaseService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(BcryptAdapter) private readonly hashAdapter: HashAdapter,
    private readonly jwtService: JwtService,
  ) {
    super();
  }

  async create(createUserDto: CreateUserDto) {
    const { email } = createUserDto;

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing)
      throw new ConflictException('User with that email already exists');

    const { password, ...userData } = createUserDto;

    const user = this.userRepository.create({
      ...userData,
      password: await this.hashAdapter.hash(password),
    });

    await this.userRepository.save(user);

    return {
      ...user,
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true },
    });

    if (!user) throw new UnauthorizedException('Credentials are not valid');

    if (!(await this.hashAdapter.compare(password, user.password)))
      throw new UnauthorizedException('Credentials are not valid');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...rest } = user;

    return {
      ...rest,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  checkAuthStatus(user: User) {
    return {
      ...user,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }
}
