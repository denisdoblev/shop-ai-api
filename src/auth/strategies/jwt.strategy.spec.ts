import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const mockRepo = {
    findOneBy: jest.fn(),
  } as unknown as Repository<User>;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const findOneBy = mockRepo.findOneBy as jest.Mock;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(mockRepo, mockConfigService);
  });

  it('returns user when payload contains valid id and user is active', async () => {
    const user: Partial<User> = { id: 1, isActive: true };
    findOneBy.mockResolvedValue(user);

    const result = await strategy.validate({ id: 1 });

    expect(findOneBy).toHaveBeenCalledWith({ id: 1 });
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when user is not found', async () => {
    findOneBy.mockResolvedValue(undefined);

    await expect(strategy.validate({ id: 2 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    const user: Partial<User> = { id: 3, isActive: false };
    findOneBy.mockResolvedValue(user);

    await expect(strategy.validate({ id: 3 })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
