import { Controller, Get, Param } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import { FindUserByIdUseCase } from "../../application/use-cases/find-user-by-id.use-case";

@Controller("users")
export class UsersController {
  constructor(private readonly findUserByIdUseCase: FindUserByIdUseCase) {}

  @Get(":id")
  findById(@Param("id") id: string): Promise<UserProfile> {
    return this.findUserByIdUseCase.execute(id);
  }
}
