import { Inject, Injectable } from "@nestjs/common";

import { UsersService } from "../../../users/application/users.service";
import { InvalidCredentialsError } from "../../domain/invalid-credentials.error";
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from "../../domain/ports/password-hasher.port";
import {
  TOKEN_GENERATOR,
  type TokenGeneratorPort,
  type TokenPair,
} from "../../domain/ports/token-generator.port";

export interface LoginUserInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    private readonly usersService: UsersService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_GENERATOR)
    private readonly tokenGenerator: TokenGeneratorPort,
  ) {}

  async execute(input: LoginUserInput): Promise<TokenPair> {
    const credentials = await this.usersService.findCredentialsByEmail(
      input.email,
    );
    if (!credentials) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.verify(
      credentials.passwordHash,
      input.password,
    );
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return this.tokenGenerator.generateTokenPair(credentials.id);
  }
}
