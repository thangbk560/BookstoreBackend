import { Controller, Post, Get, Body, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { VNPayService } from './vnpay.service';
import { MomoService } from './momo.service';
import { CodService } from './cod.service';
import { OrdersService } from '../orders/orders.service';

@Controller('payment')
export class PaymentController {
    constructor(
        private readonly vnpayService: VNPayService,
        private readonly momoService: MomoService,
        private readonly codService: CodService,
        private readonly ordersService: OrdersService,
    ) { }

    @Post('vnpay/create')
    async createVNPayPayment(
        @Body() body: { orderId: string; amount: number; returnUrl: string },
        @Req() req: Request
    ) {
        // Lấy IP thực tế
        let ipAddr = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
        if (ipAddr.includes(',')) {
            ipAddr = ipAddr.split(',')[0].trim();
        }
        if (ipAddr === '::1') {
            ipAddr = '127.0.0.1';
        }

        const order = await this.ordersService.findById(body.orderId);
        
        if (!order) {
            throw new NotFoundException('Không tìm thấy đơn hàng');
        }

        const amountToPay = order.total; 

        const paymentUrl = this.vnpayService.createPaymentUrl(
            body.orderId,
            amountToPay,
            body.returnUrl,
            ipAddr,
        );
        return { paymentUrl };
    }

    @Get('vnpay/return')
    async vnpayReturn(@Query() query: any) {
        const isValid = await this.vnpayService.verifyReturnUrl(query);

        if (!isValid) {
            return { success: false, message: 'Invalid signature' };
        }

        const responseCode = query['vnp_ResponseCode'];

        return {
            success: responseCode === '00',
            message: responseCode === '00' ? 'Payment successful' : 'Payment failed',
            transactionId: query['vnp_TransactionNo'] || query['vnp_TxnRef'],
        };
    }

    @Get('vnpay/ipn') 
    async vnpayIPN(@Query() query: any) {
        return await this.vnpayService.handleIPN(query);
    }

    @Post('momo/create')
    async createMomoPayment(
        @Body() body: { orderId: string; amount: number; returnUrl: string; ipnUrl: string },
    ) {
        return await this.momoService.createPayment(
            body.orderId,
            body.amount,
            body.returnUrl,
            body.ipnUrl,
        );
    }

    @Post('momo/callback')
    async momoCallback(@Body() body: any) {
        return await this.momoService.handleCallback(body);
    }

    @Post('cod')
    async createCodOrder(@Body() orderData: {
        userId: string;
        items: any[];
        shippingAddress: any;
        subtotal: number;
        shipping: number;
        tax: number;
        total: number;
        discount?: number;
        promoCode?: string;
    }) {
        return this.codService.createCodOrder(orderData);
    }
}