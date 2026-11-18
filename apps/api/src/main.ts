import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use((_req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer'); next(); });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: false,
  });
  await app.listen(Number(process.env.PORT ?? 3000), process.env.NODE_ENV === 'test' ? '127.0.0.1' : (process.env.LISTEN_HOST || '0.0.0.0'));
}

void bootstrap();
