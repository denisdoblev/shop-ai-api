import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GetUser, Auth } from './decorators';
import { AuthResponseDto, CreateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';
import {
  ApiGetResponses,
  ApiPostResponses,
} from '../common/decorators/api-responses.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiPostResponses(AuthResponseDto, {
    description: 'User registered successfully',
    hasApiBearerToken: false,
  })
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiPostResponses(AuthResponseDto, {
    description: 'User logged in successfully',
    hasApiBearerToken: false,
  })
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  @Get('check-status')
  @Auth()
  @ApiGetResponses(AuthResponseDto, {
    description: 'Auth status checked successfully',
    hasApiBearerToken: false,
  })
  checkAuthStatus(@GetUser() user: User) {
    return this.authService.checkAuthStatus(user);
  }
}
