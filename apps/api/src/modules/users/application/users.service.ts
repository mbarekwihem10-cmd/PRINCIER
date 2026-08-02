import { Injectable } from "@nestjs/common";
import type { UserProfile } from "@tripplanner/shared-types";

import type { CreateUserData } from "../domain/ports/user-repository.port";

import { CreateUserUseCase } from "./use-cases/create-user.use-case";
import {
  FindCredentialsByEmailUseCase,
  type UserCredentials,
} from "./use-cases/find-credentials-by-email.use-case";
import { FindUserByEmailUseCase } from "./use-cases/find-user-by-email.use-case";
import { FindUserByIdUseCase } from "./use-cases/find-user-by-id.use-case";

/**
 * Interface de service publique du module Users (Handbook 1.3) — seul point
 * d'entrée que les autres modules (ex: Auth) sont autorisés à appeler.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly findUserByEmailUseCase: FindUserByEmailUseCase,
    private readonly findCredentialsByEmailUseCase: FindCredentialsByEmailUseCase,
  ) {}

  createUser(data: CreateUserData): Promise<UserProfile> {
    return this.createUserUseCase.execute(data);
  }

  findById(id: string): Promise<UserProfile> {
    return this.findUserByIdUseCase.execute(id);
  }

  findByEmail(email: string): Promise<UserProfile | null> {
    return this.findUserByEmailUseCase.execute(email);
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.findCredentialsByEmailUseCase.execute(email);
  }
}
