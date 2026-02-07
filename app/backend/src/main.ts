import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('v1');

  // Enable CORS for Tauri frontend
  app.enableCors({
    origin: ['http://localhost:1420', 'http://localhost:5173', 'tauri://localhost'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
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
    )
    .addTag('auth', 'Authentication & session management')
    .addTag('users', 'User management')
    .addTag('branches', 'Branch management')
    .addTag('categories', 'Product categories')
    .addTag('items', 'Product/item catalog')
    .addTag('inventory', 'Inventory & stock management')
    .addTag('wastage', 'Wastage & spoilage tracking')
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
