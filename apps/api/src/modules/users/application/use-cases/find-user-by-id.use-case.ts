import { Inject, Injectable } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "../../domain/ports/user-repository.port";
import { UserNotFoundError } from "../../domain/user-not-found.error";

@Injectable()
export class FindUserByIdUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(id: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }

    return user.toProfile();
  }
}
