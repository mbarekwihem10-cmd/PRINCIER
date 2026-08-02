import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { UsersModule } from "../users/users.module";

import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case";
import { LoginUserUseCase } from "./application/use-cases/login-user.use-case";
import { RegisterUserUseCase } from "./application/use-cases/register-user.use-case";
import { PASSWORD_HASHER } from "./domain/ports/password-hasher.port";
import { TOKEN_GENERATOR } from "./domain/ports/token-generator.port";
import { Argon2PasswordHasherAdapter } from "./infrastructure/adapters/argon2-password-hasher.adapter";
import { JwtTokenGeneratorAdapter } from "./infrastructure/adapters/jwt-token-generator.adapter";
import { JwtStrategy } from "./infrastructure/adapters/jwt.strategy";
import { AuthController } from "./infrastructure/controllers/auth.controller";

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    GetCurrentUserUseCase,
    JwtStrategy,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasherAdapter },
    { provide: TOKEN_GENERATOR, useClass: JwtTokenGeneratorAdapter },
  ],
})
export class AuthModule {}
