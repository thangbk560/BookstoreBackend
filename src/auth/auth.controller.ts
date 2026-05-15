import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Res,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class GoogleTokenDto {
  id_token?: string;
  access_token?: string;
}

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    async register(
        @Body('name') name: string,
        @Body('email') email: string,
        @Body('password') password: string,
    ) {
        return this.authService.register(name, email, password);
    }

    @Post('signup')
    async signup(
        @Body('name') name: string,
        @Body('email') email: string,
        @Body('password') password: string,
    ) {
        return this.authService.register(name, email, password);
    }

    @Post('verify-registration')
    async verifyRegistration(
        @Body('email') email: string,
        @Body('otp') otp: string,
    ) {
        return this.authService.verifyRegistration(email, otp);
    }

    @Get('captcha')
    async getCaptcha() {
        return this.authService.generateCaptcha();
    }

    @Post('login')
    async login(
        @Body('email') email: string,
        @Body('password') password: string,
        @Body('captcha') captcha?: string,
        @Body('captchaId') captchaId?: string,
    ) {
        return this.authService.login(email, password, captcha, captchaId);
    }

    @Post('refresh')
    async refresh(@Body('refreshToken') refreshToken: string) {
        return this.authService.refresh(refreshToken);
    }

    // ========== GOOGLE OAUTH FLOW MỚI ==========
    // Frontend gửi ID Token lên đây
    @Post('google-token')
    async googleTokenAuth(@Body() body: GoogleTokenDto) {
        const token = body.id_token || body.access_token;
        if (!token) {
            throw new UnauthorizedException('No token provided');
        }
        return this.authService.verifyGoogleToken(token);
    }

    // OTP endpoints
    @Post('send-otp')
    async sendOTP(@Body('email') email: string) {
        return this.authService.sendOTP(email);
    }

    @Post('verify-otp')
    async verifyOTP(
        @Body('email') email: string,
        @Body('otp') otp: string,
    ) {
        return this.authService.verifyOTP(email, otp);
    }

    @Post('forgot-password')
    async forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }

    @Post('reset-password')
    async resetPassword(
        @Body('token') token: string,
        @Body('password') password: string,
    ) {
        return this.authService.resetPassword(token, password);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getCurrentUser(@Request() req) {
        const user = req.user.user;
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    }
}