import { Inject, Injectable } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

@Injectable()
export class FindUserByEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findByEmail(email);
    return user ? user.toProfile() : null;
  }
}
