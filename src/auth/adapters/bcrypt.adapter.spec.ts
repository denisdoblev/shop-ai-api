import * as bcrypt from 'bcrypt';
import { BcryptAdapter } from './bcrypt.adapter';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('BcryptAdapter', () => {
  let adapter: BcryptAdapter;

  beforeEach(() => {
    adapter = new BcryptAdapter();
    jest.clearAllMocks();
  });

  it('should hash a plain value', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');

    const result = await adapter.hash('plain-text');

    expect(result).toBe('hashed-value');
    expect(bcrypt.hash).toHaveBeenCalledWith('plain-text', 10);
  });

  it('should compare and return true when matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await adapter.compare('plain-text', 'some-hash');

    expect(result).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('plain-text', 'some-hash');
  });

  it('should compare and return false when not matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await adapter.compare('plain-text', 'some-hash');

    expect(result).toBe(false);
    expect(bcrypt.compare).toHaveBeenCalledWith('plain-text', 'some-hash');
  });
});
