import { DomainError } from "../../../common/domain/domain-error";

export class UserNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}
