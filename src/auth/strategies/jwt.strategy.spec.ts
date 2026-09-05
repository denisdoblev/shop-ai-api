import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';

describe('JwtStrategy', () => {
  const activeUserId = '11111111-1111-4111-8111-111111111111';
  const missingUserId = '22222222-2222-4222-8222-222222222222';
  const inactiveUserId = '33333333-3333-4333-8333-333333333333';
  let strategy: JwtStrategy;
  const mockRepo = {
    findOneBy: jest.fn(),
  } as unknown as Repository<User>;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const findOneBy = mockRepo.findOneBy as jest.Mock;

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(mockRepo, mockConfigService);
  });

  it('returns user when payload contains valid id and user is active', async () => {
    const user: Partial<User> = { id: activeUserId, isActive: true };
    findOneBy.mockResolvedValue(user);

    const result = await strategy.validate({ id: activeUserId });

    expect(findOneBy).toHaveBeenCalledWith({ id: activeUserId });
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when user is not found', async () => {
    findOneBy.mockResolvedValue(undefined);

    await expect(strategy.validate({ id: missingUserId })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    const user: Partial<User> = { id: inactiveUserId, isActive: false };
    findOneBy.mockResolvedValue(user);

    await expect(strategy.validate({ id: inactiveUserId })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
