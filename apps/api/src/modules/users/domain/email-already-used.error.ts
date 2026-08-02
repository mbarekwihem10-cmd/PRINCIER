import { DomainError } from "../../../common/domain/domain-error";

export class EmailAlreadyUsedError extends DomainError {
  readonly httpStatus = 409;

  constructor(email: string) {
    super(`Email already used: ${email}`);
    this.name = "EmailAlreadyUsedError";
  }
}
