import { Injectable } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import { UsersService } from "../../../users/application/users.service";

@Injectable()
export class GetCurrentUserUseCase {
  constructor(private readonly usersService: UsersService) {}

  execute(userId: string): Promise<UserProfile> {
    return this.usersService.findById(userId);
  }
}
