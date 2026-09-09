import { Controller, Get, Post, Body } from '@nestjs/common';
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
  @ApiPostResponses(AuthResponseDto, {
    description: 'User registered successfully',
    hasApiBearerToken: false,
  })
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
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
