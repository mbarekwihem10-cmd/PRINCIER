import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { StringValue } from "ms";

import type {
  TokenGeneratorPort,
  TokenPair,
} from "../../domain/ports/token-generator.port";

@Injectable()
export class JwtTokenGeneratorAdapter implements TokenGeneratorPort {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateTokenPair(userId: string): TokenPair {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.configService.get<string>(
          "JWT_ACCESS_TTL",
          "15m",
        ) as StringValue,
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.configService.get<string>(
          "JWT_REFRESH_TTL",
          "30d",
        ) as StringValue,
      },
    );
    return { accessToken, refreshToken };
  }
}
