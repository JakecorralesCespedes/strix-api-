import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as firebaseAdmin from 'firebase-admin';
import { config } from 'dotenv';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { getCredentialsFromEnv } from './utils';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import fastifyCors, { FastifyCorsOptions } from '@fastify/cors';

config();

async function bootstrap() {
  const adapter = new FastifyAdapter();

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  const originAllowList =
    allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

  const corsOptios: FastifyCorsOptions = {
    origin: (origin, callback) => {
      if (!origin || originAllowList.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  };
  await adapter.register(fastifyCors as any, corsOptios);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );
  const config = new DocumentBuilder()
    .setTitle('Strix API')
    .setDescription('Api for Strix application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('doc', app, document);

  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(getCredentialsFromEnv()),
  });

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT || 8000, '0.0.0.0');
}
bootstrap();
