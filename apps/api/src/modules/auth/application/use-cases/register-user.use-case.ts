import { Inject, Injectable } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import { UsersService } from "../../../users/application/users.service";
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from "../../domain/ports/password-hasher.port";

export interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly usersService: UsersService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: RegisterUserInput): Promise<UserProfile> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    return this.usersService.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  }
}
