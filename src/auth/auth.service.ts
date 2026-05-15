import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { OtpService } from './otp.service';
import * as bcrypt from 'bcrypt';
import * as svgCaptcha from 'svg-captcha';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private mailService: MailService,
        private otpService: OtpService,
    ) {
        this.googleClient = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
        );
    }

    // ========== GOOGLE TOKEN VERIFICATION ==========
    async verifyGoogleToken(idToken: string) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new UnauthorizedException('Invalid Google token');
            }

            const email = payload.email;
            const name = payload.name || email.split('@')[0];
            const googleId = payload.sub;

            let user = await this.usersService.findByEmail(email);
            
            if (!user) {
                user = await this.usersService.create({
                    email: email,
                    name: name,
                    googleId: googleId,
                    isActive: true,
                });
            } else if (!user.googleId) {
                await this.usersService.updateGoogleId(user._id.toString(), googleId);
                user = await this.usersService.findByEmail(email);
            }

            const jwtPayload = { email: user.email, sub: user._id, role: user.role };
            const access_token = this.jwtService.sign(jwtPayload);
            const refresh_token = this.jwtService.sign(jwtPayload, { expiresIn: '30d' });

            return {
                access_token,
                refresh_token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            };
        } catch (error) {
            console.error('Google token verification failed:', error);
            throw new UnauthorizedException('Invalid Google token');
        }
    }

    // ========== EXISTING METHODS ==========
    async register(name: string, email: string, password: string) {
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            if (!existingUser.isActive) {
                const otp = this.otpService.generateOTP();
                await this.otpService.storeOTP(email, otp);
                await this.mailService.sendOTP(email, otp);
                return { message: 'OTP sent to email. Please verify to complete registration.', requireOtp: true };
            }
            throw new UnauthorizedException('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await this.usersService.create({
            name,
            email,
            password: hashedPassword,
            isActive: false,
        });

        const otp = this.otpService.generateOTP();
        await this.otpService.storeOTP(email, otp);
        await this.mailService.sendOTP(email, otp);

        return { message: 'OTP sent to email. Please verify to complete registration.', requireOtp: true };
    }

    async verifyRegistration(email: string, otp: string) {
        const isValid = await this.otpService.verifyOTP(email, otp);
        if (!isValid) {
            throw new UnauthorizedException('Invalid or expired OTP');
        }

        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        user.isActive = true;
        await user.save();

        const payload = { email: user.email, sub: user._id, role: user.role };
        const access_token = this.jwtService.sign(payload);
        const refresh_token = this.jwtService.sign(payload, { expiresIn: '30d' });

        return {
            access_token,
            refresh_token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }

    async login(email: string, password: string, captcha?: string, captchaId?: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Tài khoản chưa được kích hoạt. Vui lòng xác nhận email.');
        }

        if (user.lockUntil && user.lockUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
            throw new UnauthorizedException(`Tài khoản bị khóa. Vui lòng thử lại sau ${minutesLeft} phút.`);
        }

        if ((user.failedLoginAttempts || 0) >= 3) {
            if (!captcha || !captchaId) {
                return { requireCaptcha: true, message: 'Yêu cầu CAPTCHA' };
            }

            const isCaptchaValid = await this.otpService.verifyCaptcha(captchaId, captcha);
            if (!isCaptchaValid) {
                throw new UnauthorizedException('CAPTCHA không hợp lệ');
            }
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

            if (user.failedLoginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
            }

            await user.save();

            const attempts = user.failedLoginAttempts;
            if (attempts >= 5) {
                throw new UnauthorizedException('Tài khoản bị khóa 10 phút do quá nhiều lần đăng nhập không hợp lệ.');
            } else if (attempts >= 3) {
                return { requireCaptcha: true, message: 'Yêu cầu CAPTCHA' };
            }

            throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
        }

        if (user.failedLoginAttempts > 0) {
            user.failedLoginAttempts = 0;
            user.lockUntil = null as any;
            await user.save();
        }

        const payload = { email: user.email, sub: user._id, role: user.role };
        const access_token = this.jwtService.sign(payload);
        const refresh_token = this.jwtService.sign(payload, { expiresIn: '30d' });

        return {
            access_token,
            refresh_token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                failedLoginAttempts: user.failedLoginAttempts || 0,
            },
        };
    }

    async refresh(refreshToken: string) {
        try {
            const decoded = this.jwtService.verify(refreshToken);
            const user = await this.usersService.findOne(decoded.sub);
            if (!user) {
                throw new UnauthorizedException('Invalid token');
            }

            const payload = { email: user.email, sub: user._id, role: user.role };
            const access_token = this.jwtService.sign(payload);
            const new_refresh_token = this.jwtService.sign(payload, { expiresIn: '30d' });

            return {
                access_token,
                refresh_token: new_refresh_token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async validateUser(userId: string) {
        return this.usersService.findOne(userId);
    }

    generateToken(payload: any, expiresIn?: string) {
        if (expiresIn) {
            return this.jwtService.sign(payload, { expiresIn } as any);
        }
        return this.jwtService.sign(payload);
    }

    async sendOTP(email: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const otp = this.otpService.generateOTP();
        await this.otpService.storeOTP(email, otp);
        await this.mailService.sendOTP(email, otp);

        return { message: 'OTP sent to email' };
    }

    async verifyOTP(email: string, otp: string) {
        const isValid = await this.otpService.verifyOTP(email, otp);
        if (!isValid) {
            throw new UnauthorizedException('Invalid or expired OTP');
        }

        return { message: 'OTP verified successfully' };
    }

    async forgotPassword(email: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return { message: 'If email exists, password reset link has been sent' };
        }

        const resetToken = this.otpService.generateResetToken();
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 3600000);
        await user.save();

        await this.mailService.sendPasswordReset(email, resetToken);

        return { message: 'Password reset link sent to email' };
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await this.usersService.findByResetToken(token);

        if (!user) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = null as any;
        user.resetPasswordExpires = null as any;
        await user.save();

        return { message: 'Password reset successfully' };
    }

    async generateCaptcha() {
        const captcha = svgCaptcha.create({
            size: 6,
            noise: 2,
            color: true,
            background: '#f0f0f0',
        });

        const id = crypto.randomUUID();
        await this.otpService.storeCaptcha(id, captcha.text);

        return {
            image: captcha.data,
            id: id,
        };
    }
}