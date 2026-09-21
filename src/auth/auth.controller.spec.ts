import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';

describe('AuthController', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  let controller: AuthController;
  const mockAuthService = {
    create: jest.fn(),
    login: jest.fn(),
    checkAuthStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      imports: [ThrottlerModule.forRoot([{ limit: 5, ttl: 60_000 }])],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createUser should call authService.create and return its result', async () => {
    const dto = {
      email: 'a@b.com',
      password: 'pass',
      fullname: 'Test',
    } as unknown as CreateUserDto;
    const result = {
      id: userId,
      email: dto.email,
      fullname: dto.fullname,
      isActive: true,
      roles: ['user'],
      token: 'jwt',
    };
    mockAuthService.create.mockResolvedValue(result);

    await expect(controller.createUser(dto)).resolves.toEqual(result);
    expect(mockAuthService.create).toHaveBeenCalledWith(dto);
  });

  it('loginUser should call authService.login and return its result', async () => {
    const dto = {
      email: 'a@b.com',
      password: 'pass',
    } as unknown as LoginUserDto;
    const result = {
      id: userId,
      email: dto.email,
      fullname: 'Test User',
      isActive: true,
      roles: ['user'],
      token: 'jwt2',
    };
    mockAuthService.login.mockResolvedValue(result);

    await expect(controller.loginUser(dto)).resolves.toEqual(result);
    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('checkAuthStatus should call authService.checkAuthStatus and return its result', () => {
    const user = {
      id: userId,
      email: 'c@d.com',
      fullname: 'Test User',
      isActive: true,
      roles: ['user'],
    } as User;
    const result = { ...user, token: 'jwt3' };
    mockAuthService.checkAuthStatus.mockReturnValue(result);

    expect(controller.checkAuthStatus(user)).toEqual(result);
    expect(mockAuthService.checkAuthStatus).toHaveBeenCalledWith(user);
  });
});
