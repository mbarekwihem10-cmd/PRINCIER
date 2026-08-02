import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port";

@Injectable()
export class Argon2PasswordHasherAdapter implements PasswordHasherPort {
  hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword);
  }

  verify(hash: string, plainPassword: string): Promise<boolean> {
    return argon2.verify(hash, plainPassword);
  }
}
