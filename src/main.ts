import "module-alias/register";
import {
  VersioningType,
  VERSION_NEUTRAL,
  ValidationPipe,
  BadRequestException,
  RequestMethod,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AzureLoggerService } from "@shared/modules/azure-logger/azure-logger.service";
import { ValidationError } from "class-validator";
import { ServerModule } from "./server.module";
import { Constants, Versions } from "./shared";
import * as appInsights from "applicationinsights";
import { initAppInsights } from "@shared/modules";
appInsights
  .setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true, true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true, true)
  .setUseDiskRetryCaching(true)
  .setSendLiveMetrics(true)
  .start();
async function bootstrap() {
  const app = await NestFactory.create(ServerModule);
  const config = app.get<ConfigService>(ConfigService);
  const logger = await app.resolve<AzureLoggerService>(AzureLoggerService);
  const key = config.get<string>(Constants.APPINSIGHTS);

  logger.setClient(appInsights.defaultClient);
  app.useLogger(logger);
  logger.debug(`${Constants.APPINSIGHTS}: ${key}`);
  logger.debug(`ApplicationInsights Initialized!`);

  app.enableCors();

  logger.debug(`POSTGRES_DB: ${process.env.POSTGRES_DB}`);
  logger.debug(`POSTGRES_USER: ${process.env.POSTGRES_USER}`);
  logger.debug(`POSTGRES_PASSWORD: ${process.env.POSTGRES_PASSWORD}`);
  logger.debug(`POSTGRES_DB: ${process.env.POSTGRES_DB}`);
  logger.debug(`POSTGRES_HOST: ${process.env.POSTGRES_HOST}`);
  logger.debug(`POSTGRES_PORT: ${process.env.POSTGRES_PORT}`);
  logger.debug(`POSTGRES_SCHEMA: ${process.env.POSTGRES_SCHEMA}`);
  logger.debug(`DATABASE_URL: ${process.env.DATABASE_URL}`);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: Versions.v1,
  });
  // app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: {
        target: false,
      },
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        return new BadRequestException(validationErrors);
      },
    })
  );
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "", method: RequestMethod.GET },
      { path: "/", method: RequestMethod.GET },
      { path: "/api/docs", method: RequestMethod.GET },
    ],
  });
  const docBuilder = new DocumentBuilder()
    .setTitle("DropEngine")
    .setDescription("The DropEngine API")
    .setVersion("1.0")
    .setBasePath("api")
    .build();
  const document = SwaggerModule.createDocument(app, docBuilder, {
    ignoreGlobalPrefix: false,
  });
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get("PORT");
  await app.listen(`${Number(port)}`);

  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
