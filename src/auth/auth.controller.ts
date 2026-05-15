import { Controller, Post, Body, Get, UseGuards, Request, Res, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

    // Alias for register to match frontend
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

    @Get('google/callback')
    async googleCallback(
        @Query('code') code: string,
        @Res() res: Response
    ) {
        try {
            console.log('Received Google code:', code ? 'Yes' : 'No');
            
            if (!code) {
                console.error('No code provided');
                return res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=no_code`);
            }

            // Gọi service để exchange code lấy user info
            const result = await this.authService.validateGoogleUser(code);
            
            // Redirect về frontend với token
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?access_token=${result.access_token}&refresh_token=${result.refresh_token}`;
            
            console.log('Redirecting to:', redirectUrl);
            
            return res.redirect(redirectUrl);
        } catch (error) {
            console.error('Google callback error:', error);
            return res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=auth_failed`);
        }
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

    // Password reset endpoints
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

    // Alias for profile to match frontend expectations
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getCurrentUser(@Request() req) {
        // req.user comes from JWT strategy validation
        // It contains { userId, email, user }
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
