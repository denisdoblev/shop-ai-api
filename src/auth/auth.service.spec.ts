/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, UnauthorizedException } from '@nestjs/common';

jest.mock('../common/services/base.service', () => ({
  BaseService: class {},
}));

import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { HashAdapter } from './interfaces/hash-adapter.interface';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let mockRepository: jest.Mocked<Repository<User>>;
  let mockHashAdapter: jest.Mocked<HashAdapter>;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    mockHashAdapter = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as unknown as jest.Mocked<HashAdapter>;

    mockJwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(mockRepository, mockHashAdapter, mockJwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('throws ConflictException when user already exists', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
      } as unknown as User);

      await expect(
        service.create({ email: 'a@b.com', password: 'Abc123', fullname: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a user and returns token on success', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockHashAdapter.hash.mockResolvedValue('hashed-pass');

      const savedUser = {
        id: 10,
        email: 'u@e.com',
        fullname: 'Name',
        password: 'hashed-pass',
      } as unknown as User;
      mockRepository.create.mockReturnValue(savedUser);
      mockRepository.save.mockResolvedValue(savedUser);

      const res = await service.create({
        email: 'u@e.com',
        password: 'Abc123',
        fullname: 'Name',
      });

      expect(mockHashAdapter.hash).toHaveBeenCalledWith('Abc123');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(savedUser);
      expect(res).toMatchObject({ id: 10, email: 'u@e.com' });
      expect(res.token).toBe('signed-token');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@one.com', password: 'Abc123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 2,
        email: 'a@b.com',
        password: 'hashed',
      } as unknown as User);
      mockHashAdapter.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'Wrong1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns user data and token on successful login', async () => {
      const user = {
        id: 3,
        email: 'ok@ok.com',
        password: 'hashed',
      } as unknown as User;
      mockRepository.findOne.mockResolvedValue(user as unknown as User);
      mockHashAdapter.compare.mockResolvedValue(true);

      const res = await service.login({
        email: 'ok@ok.com',
        password: 'Abc123',
      });

      expect(mockHashAdapter.compare).toHaveBeenCalledWith('Abc123', 'hashed');
      expect(res).toMatchObject({ id: 3, email: 'ok@ok.com' });
      expect(res.token).toBe('signed-token');
      expect(Object.prototype.hasOwnProperty.call(res, 'password')).toBe(false);
    });
  });

  describe('checkAuthStatus', () => {
    it('returns user with token', () => {
      const user = { id: 5, email: 'x@y.com' } as User;
      const res = service.checkAuthStatus(user);
      expect(res).toMatchObject({ id: 5, email: 'x@y.com' });
      expect(res.token).toBe('signed-token');
    });
  });
});
