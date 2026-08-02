import { Inject, Injectable } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import { EmailAlreadyUsedError } from "../../domain/email-already-used.error";
import {
  USER_REPOSITORY,
  type CreateUserData,
  type UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(data: CreateUserData): Promise<UserProfile> {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new EmailAlreadyUsedError(data.email);
    }

    const user = await this.userRepository.create(data);
    return user.toProfile();
  }
}
