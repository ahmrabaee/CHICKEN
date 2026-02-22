import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { ValidationError } from 'class-validator';

const ALLOWED_ORIGINS = [
  'http://localhost:1420',
  'http://127.0.0.1:1420',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'tauri://localhost',
  'http://tauri.localhost',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Force CORS headers on EVERY response (including 401, 500, etc.)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Global prefix for all routes
  app.setGlobalPrefix('v1');

  // Enable CORS for Tauri frontend + Vite dev server
  app.enableCors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition', 'Content-Length'],
    credentials: true,
    preflightContinue: false,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) => {
        console.warn('[VALIDATION ERROR]:', JSON.stringify(errors, null, 2));
        const messages = errors.map((e) =>
          e.constraints ? Object.values(e.constraints).join(', ') : e.property + ' has invalid value',
        );
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: messages,
          messageAr: messages.join('؛ '),
        });
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Chicken Shop POS API')
    .setDescription(
      `
      ## Chicken Shop POS, Inventory & Accounting System API
      
      ### Features:
      - **Weight-based point of sale** with digital scale integration
      - **FIFO inventory costing** with real-time cost allocation
      - **Live bird purchase tracking** with shrinkage calculation
      - **Double-entry accounting** with automated journal entries
      - **Credit management** for customers and suppliers
      - **Arabic-first localization** with RTL support
      
      ### Authentication:
      Use the \`/v1/auth/login\` endpoint to get a JWT token, then click "Authorize" and enter: \`Bearer <your-token>\`
      
      ### Value Conventions:
      - **Currency**: Integer in minor units (2500 = 25.00 SAR)
      - **Weight**: Integer in grams (1500 = 1.5 kg)
      - **Percentage**: Integer in basis points (1500 = 15%)
      `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication & session management')
    .addTag('users', 'User management')
    .addTag('branches', 'Branch management')
    .addTag('categories', 'Product categories')
    .addTag('items', 'Product/item catalog')
    .addTag('inventory', 'Inventory & stock management')
    .addTag('wastage', 'Wastage & spoilage tracking')
    .addTag('stock-transfer', 'Stock transfer (raw chicken to products)')
    .addTag('sales', 'Point of Sale operations')
    .addTag('purchases', 'Purchasing & goods receiving')
    .addTag('customers', 'Customer management')
    .addTag('suppliers', 'Supplier management')
    .addTag('payments', 'Payment processing')
    .addTag('debts', 'Receivables & payables')
    .addTag('expenses', 'Expense tracking')
    .addTag('accounting', 'Journal entries & chart of accounts')
    .addTag('reports', 'Reports & analytics')
    .addTag('settings', 'System configuration')
    .addTag('audit', 'Audit logs')
    .addTag('backup', 'Backup management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
    customSiteTitle: 'Chicken Shop POS API',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║           Chicken Shop POS API Server                    ║
╠══════════════════════════════════════════════════════════╣
║  API:      http://localhost:${port}/v1                      ║
║  Swagger:  http://localhost:${port}/api/docs                ║
╚══════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
