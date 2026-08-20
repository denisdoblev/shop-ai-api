import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

type HandleDatabaseExceptionsProps = {
  error: {
    code: string;
  };
};

@Injectable()
export abstract class BaseService {
  protected handleDatabaseExceptions({
    error,
  }: HandleDatabaseExceptionsProps): never {
    if (error?.code === '23505') {
      throw new ConflictException('Duplicate entry');
    }
    console.error(error);
    throw new InternalServerErrorException('Unexpected database error');
  }
}
