/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { HashAdapter } from './interfaces/hash-adapter.interface';

describe('AuthService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  let service: AuthService;
  let mockRepository: jest.Mocked<Repository<User>>;
  let mockHashAdapter: jest.Mocked<HashAdapter>;
  let mockJwtService: jest.Mocked<JwtService>;

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: userId,
      email: 'user@example.com',
      password: 'hashed-pass',
      fullname: 'Test User',
      isActive: true,
      roles: ['user'],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
      ...overrides,
    }) as User;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    mockHashAdapter = { hash: jest.fn(), compare: jest.fn() };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    } as unknown as jest.Mocked<JwtService>;
    service = new AuthService(mockRepository, mockHashAdapter, mockJwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('throws ConflictException when user already exists', async () => {
      mockRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        service.create({
          email: ' User@Example.COM ',
          password: 'Abc123',
          fullname: 'Test User',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('returns the safe profile and token on success', async () => {
      const savedUser = buildUser();
      mockRepository.findOne.mockResolvedValue(null);
      mockHashAdapter.hash.mockResolvedValue('hashed-pass');
      mockRepository.create.mockReturnValue(savedUser);
      mockRepository.save.mockResolvedValue(savedUser);

      const result = await service.create({
        email: ' User@Example.COM ',
        password: 'Abc123',
        fullname: savedUser.fullname,
      });

      expect(mockHashAdapter.hash).toHaveBeenCalledWith('Abc123');
      expect(mockRepository.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        fullname: savedUser.fullname,
        password: 'hashed-pass',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(savedUser);
      expect(result).toEqual({
        id: userId,
        email: savedUser.email,
        fullname: savedUser.fullname,
        isActive: true,
        roles: ['user'],
        token: 'signed-token',
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('createdAt');
    });

    it('maps a concurrent unique email violation to ConflictException', async () => {
      const user = buildUser();
      mockRepository.findOne.mockResolvedValue(null);
      mockHashAdapter.hash.mockResolvedValue('hashed-pass');
      mockRepository.create.mockReturnValue(user);
      mockRepository.save.mockRejectedValue(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('duplicate key'), { code: '23505' }),
        ),
      );

      await expect(
        service.create({
          email: user.email,
          password: 'Abc123',
          fullname: user.fullname,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'Abc123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      mockRepository.findOne.mockResolvedValue(buildUser());
      mockHashAdapter.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'Wrong1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns the same safe profile contract on successful login', async () => {
      const user = buildUser();
      mockRepository.findOne.mockResolvedValue(user);
      mockHashAdapter.compare.mockResolvedValue(true);

      const result = await service.login({
        email: user.email,
        password: 'Abc123',
      });

      expect(mockHashAdapter.compare).toHaveBeenCalledWith(
        'Abc123',
        'hashed-pass',
      );
      expect(result).toMatchObject({ id: userId, token: 'signed-token' });
      expect(result).not.toHaveProperty('password');
    });

    it('normalizes the email before looking up the user', async () => {
      const user = buildUser();
      mockRepository.findOne.mockResolvedValue(user);
      mockHashAdapter.compare.mockResolvedValue(true);

      await service.login({
        email: ' User@Example.COM ',
        password: 'Abc123',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'user@example.com' } }),
      );
    });

    it('throws UnauthorizedException without issuing a token when user is inactive', async () => {
      mockRepository.findOne.mockResolvedValue(buildUser({ isActive: false }));
      mockHashAdapter.compare.mockResolvedValue(true);

      await expect(
        service.login({ email: 'user@example.com', password: 'Abc123' }),
      ).rejects.toThrow('User is inactive, talk with an admin');

      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  it('returns the same safe profile contract from checkAuthStatus', () => {
    const result = service.checkAuthStatus(buildUser());

    expect(result).toMatchObject({ id: userId, token: 'signed-token' });
    expect(result).not.toHaveProperty('password');
  });
});
