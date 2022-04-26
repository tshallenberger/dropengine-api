import { CacheModule, Module } from "@nestjs/common";
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
  NestLikeConsoleFormatOptions,
} from "nest-winston";
import * as winston from "winston";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";

import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { HttpModule } from "@nestjs/axios";
import { AzureTelemetryModule } from "@shared/modules/azure-telemetry/azure-telemetry.module";
import { AzureStorageModule } from "@shared/modules/azure-storage/azure-storage.module";
import { AuthModule } from "@shared/modules/auth/auth.module";
import { AppModule } from "../../../app/app.module";
import { ShopifyModule } from "../../../shopify/shopify.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { PassportModule } from "@nestjs/passport";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { CatalogModule } from "../../../catalog/catalog.module";
import { Auth0Module } from "@auth0/auth0.module";
import { AccountsModule } from "../../../accounts/accounts.module";
import { SalesModule } from "../../../sales/sales.module";
import { MyEasySuiteModule } from "../../../myeasysuite/MyEasySuiteModule";
import { APP_FILTER } from "@nestjs/core";
import { AllExceptionsFilter } from "@shared/filters";
import { format } from "winston";
import { Format } from "logform";
import chalk from "chalk";

// `volume` is now a function that returns instances of the format.
let labelFormatter = winston.format.combine(
  winston.format((info) => {
    info.label = `[DropEngine]`;
    return info;
  })(),
  winston.format.simple(),
  winston.format.colorize()
);
let levelFormatter = winston.format.combine(
  winston.format((info) => {
    info.level = `[${info.level.toUpperCase()}]`;
    return info;
  })()
);
const opts = {
  message: true,
  level: true,
  label: true,
};

let logFormatter2 = winston.format.combine(
  labelFormatter,
  levelFormatter,
  winston.format.timestamp({ format: "YY-MM-DD HH:MM:SS" }),
  winston.format.printf(
    (info) => `${info.label} ${info.timestamp}  ${info.level} : ${info.message}`
  ),
  winston.format.colorize(opts)
);

winston.addColors({
  INFO: "bold blue", // fontStyle color
  ERROR: "bold red",
  WARN: "italic yellow",
  DEBUG: "green",
  VERBOSE: "light blue",
});

const nestLikeColorScheme: Record<string, any> = {
  INFO: chalk.greenBright,
  ERROR: chalk.red,
  WARN: chalk.yellow,
  DEBUG: chalk.magentaBright,
  VERBOSE: chalk.cyanBright,
};
export const consoleFormat = (
  appName = "DropEngine",
  options?: NestLikeConsoleFormatOptions
): Format =>
  format.printf(({ context, level, timestamp, message, ms, ...meta }) => {
    if ("undefined" !== typeof timestamp) {
      // Only format the timestamp to a locale representation if it's ISO 8601 format. Any format
      // that is not a valid date string will throw, just ignore it (it will be printed as-is).
      try {
        if (timestamp === new Date(timestamp).toISOString()) {
          timestamp = new Date(timestamp).toLocaleString();
        }
      } catch (error) {
        // eslint-disable-next-line no-empty
        console.log(level);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const color =
      nestLikeColorScheme[level] || ((text: string): string => text);
    if (meta["0"]?.length) {
      context = meta["0"];
    }
    return (
      `${color(`[${appName}] -`)} ` +
      ("undefined" !== typeof timestamp ? `${timestamp}Z\t` : "") +
      `${color(level.toUpperCase())} ` +
      ("undefined" !== typeof context
        ? chalk.yellow(`${"[" + context + "]"} `)
        : "") +
      `${color(message)} - ` +
      `data: ${JSON.stringify(meta, null)} -` +
      ("undefined" !== typeof ms ? ` ${chalk.yellow(ms)}` : "")
    );
  });
export const nestFormat = consoleFormat("DropEngine", {
  prettyPrint: true,
});
export const winstonLoggerOptions = {
  level: "debug",
  format: winston.format.errors({ stack: true }),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format((info) => {
          info.level = `${info.level.toUpperCase()}`;
          return info;
        })(),
        winston.format.timestamp({
          format: "YYYY-MM-DD[T]HH:mm:ss.SSS",
        }),
        winston.format.ms(),
        nestFormat
      ),
    }),
  ],
};
