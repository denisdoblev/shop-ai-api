import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    create: jest.fn(),
    login: jest.fn(),
    checkAuthStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
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
      name: 'Test',
    } as unknown as CreateUserDto;
    const result = {
      id: 1,
      email: dto.email,
      token: 'jwt',
    } as unknown as Partial<User>;
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
      id: 2,
      email: dto.email,
      token: 'jwt2',
    } as unknown as Partial<User>;
    mockAuthService.login.mockResolvedValue(result);

    await expect(controller.loginUser(dto)).resolves.toEqual(result);
    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('checkAuthStatus should call authService.checkAuthStatus and return its result', () => {
    const user = { id: 3, email: 'c@d.com' } as unknown as User;
    const result = { ...user, token: 'jwt3' } as unknown as Partial<User>;
    mockAuthService.checkAuthStatus.mockReturnValue(result);

    expect(controller.checkAuthStatus(user)).toEqual(result);
    expect(mockAuthService.checkAuthStatus).toHaveBeenCalledWith(user);
  });
});
