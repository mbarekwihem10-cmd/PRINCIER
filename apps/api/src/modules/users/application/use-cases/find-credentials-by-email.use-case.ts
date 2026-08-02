import { Inject, Injectable } from "@nestjs/common";

import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

export interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
}

/**
 * Réservé à un usage interne cross-module (Auth) pour la vérification de
 * mot de passe — jamais exposé tel quel dans une réponse HTTP (Handbook 1.3).
 */
@Injectable()
export class FindCredentialsByEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string): Promise<UserCredentials | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    return { id: user.id, email: user.email, passwordHash: user.passwordHash };
  }
}
