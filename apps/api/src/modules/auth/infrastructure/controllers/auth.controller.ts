import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { UserProfile } from "@tripplanner/shared-types";
import type { Request } from "express";

import { GetCurrentUserUseCase } from "../../application/use-cases/get-current-user.use-case";
import { LoginUserUseCase } from "../../application/use-cases/login-user.use-case";
import { RegisterUserUseCase } from "../../application/use-cases/register-user.use-case";
import type { TokenPair } from "../../domain/ports/token-generator.port";
import type { JwtPayload } from "../adapters/jwt.strategy";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";

import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

// Handbook 5.5 : rate limiting renforcé sur les endpoints d'authentification
// (5 requêtes/minute) par rapport à la limite globale par défaut de l'API.
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<UserProfile> {
    return this.registerUserUseCase.execute(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.loginUserUseCase.execute(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest): Promise<UserProfile> {
    return this.getCurrentUserUseCase.execute(req.user.sub);
  }
}
