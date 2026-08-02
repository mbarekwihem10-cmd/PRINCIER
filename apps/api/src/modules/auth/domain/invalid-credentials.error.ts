import { DomainError } from "../../../common/domain/domain-error";

export class InvalidCredentialsError extends DomainError {
  readonly httpStatus = 401;

  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}
