import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { HealthController } from "./common/health/health.controller";
import { pinoConfig } from "./common/logger/pino.config";
import { validateEnv } from "./config/env.validation";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";

// AppModule ne câble volontairement que les modules déjà implémentés
// (Users, Auth) — aucun autre domaine métier n'est enregistré en avance
// (YAGNI, Handbook 2.4). Chaque futur module s'ajoute ici au moment de son
// implémentation réelle, jamais avant.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot(pinoConfig),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    UsersModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
