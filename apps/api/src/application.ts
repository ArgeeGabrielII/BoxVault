import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
export async function createApplication() {
 const app = await NestFactory.create(AppModule, { rawBody: true, logger: process.env.BOXVAULT_AWS_RUNTIME === '1' ? false : undefined });
 app.use((_req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer'); next(); });
 app.setGlobalPrefix('api/v1');
 app.enableCors({origin:(process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(','),credentials:false});
 return app;
}
