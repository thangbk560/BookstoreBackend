import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lấy FRONTEND_URL từ env hoặc dùng mặc định
  const frontendUrls = [
    process.env.FRONTEND_URL,
    'https://bookstore-frontend-thangbk560s-projects.vercel.app',
    'https://bookstore-frontend-git-main-thangbk560s-projects.vercel.app',
    'https://bookstore-frontend-eight-theta.vercel.app',
    'https://www.thangbk560.id.vn',
    'https://thangbk560.id.vn',
    'http://localhost:3000',
  ].filter(url => url); // Loại bỏ undefined

  // Cấu hình CORS chi tiết
  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (như từ Postman)
      if (!origin) return callback(null, true);
      
      // Kiểm tra origin có trong danh sách cho phép không
      if (frontendUrls.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`Blocked origin: ${origin}`);
        callback(null, false); // Thay vì throw error, trả về false
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 200, // Cho legacy browsers
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/api`);
}

bootstrap();
