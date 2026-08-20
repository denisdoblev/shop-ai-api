import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { HashAdapter } from '../interfaces/hash-adapter.interface';

@Injectable()
export class BcryptAdapter implements HashAdapter {
  private readonly saltRounds = 10;

  async hash(plain: string): Promise<string> {
    return await bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(plain, hash);
  }
}
