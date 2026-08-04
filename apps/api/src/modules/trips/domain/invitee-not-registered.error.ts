import { DomainError } from "../../../common/domain/domain-error";

export class InviteeNotRegisteredError extends DomainError {
  readonly httpStatus = 404;

  constructor(email: string) {
    super(`No registered user found for email: ${email}`);
    this.name = "InviteeNotRegisteredError";
  }
}
