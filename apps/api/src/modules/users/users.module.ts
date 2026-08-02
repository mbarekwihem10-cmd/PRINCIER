import { Module } from "@nestjs/common";

import { PrismaModule } from "../../common/prisma/prisma.module";

import { CreateUserUseCase } from "./application/use-cases/create-user.use-case";
import { FindCredentialsByEmailUseCase } from "./application/use-cases/find-credentials-by-email.use-case";
import { FindUserByEmailUseCase } from "./application/use-cases/find-user-by-email.use-case";
import { FindUserByIdUseCase } from "./application/use-cases/find-user-by-id.use-case";
import { UsersService } from "./application/users.service";
import { USER_REPOSITORY } from "./domain/ports/user-repository.port";
import { UsersController } from "./infrastructure/controllers/users.controller";
import { PrismaUserRepository } from "./infrastructure/repositories/prisma-user.repository";

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindCredentialsByEmailUseCase,
    UsersService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
