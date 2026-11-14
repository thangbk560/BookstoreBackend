import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';

@Injectable()
export class CodService {
    constructor(
        private ordersService: OrdersService,
        private promoCodesService: PromoCodesService, // Inject thêm
    ) { }

    async createCodOrder(orderData: any) {
        // Tự tính toán lại discount ở Backend
        let serverDiscount = 0;
        if (orderData.promoCode) {
            try {
                serverDiscount = await this.promoCodesService.calculateDiscount(
                    orderData.promoCode, 
                    orderData.subtotal // Dùng subtotal từ client gửi lên (cần đảm bảo subtotal này đúng)
                );
            } catch (error) {
                // Nếu mã không hợp lệ, có thể bỏ qua hoặc báo lỗi tùy nghiệp vụ
                console.warn("Mã giảm giá không hợp lệ khi tạo đơn COD:", error.message);
            }
        }

        // Tính lại tổng tiền cuối cùng ở Server
        const serverTotal = Math.max(0, orderData.subtotal + orderData.shipping - serverDiscount);

        const order = await this.ordersService.create(
            {
                items: orderData.items,
                shippingAddress: orderData.shippingAddress,
                subtotal: orderData.subtotal,
                shipping: orderData.shipping,
                tax: orderData.tax || 0,
                total: serverTotal, // Dùng total do Server tính
                discount: serverDiscount, // Dùng discount do Server tính
                promoCode: orderData.promoCode,
                paymentMethod: 'cod',
                status: 'pending',
            },
            orderData.userId
        );

        return {
            success: true,
            orderId: order._id,
            message: 'Order placed successfully. Please pay upon delivery.',
            order: {
                id: order._id,
                total: order.total,
                paymentMethod: 'COD',
                estimatedDelivery: this.calculateDeliveryDate(),
            },
        };
    }

    private calculateDeliveryDate(): string {
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 3); // 3 days delivery
        return deliveryDate.toISOString().split('T')[0];
    }
}
