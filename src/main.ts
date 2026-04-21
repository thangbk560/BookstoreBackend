import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL,
      'https://bookstore-frontend-thangbk560s-projects.vercel.app',
      'https://bookstore-frontend-git-main-thangbk560s-projects.vercel.app',
      'https://bookstore-frontend-9zxmx2psb-thangbk560s-projects.vercel.app/',
      'https://bookstore-frontend-eight-theta.vercel.app',
      'https://www.thangbk560.id.vn',
      'https://thangbk560.id.vn',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
