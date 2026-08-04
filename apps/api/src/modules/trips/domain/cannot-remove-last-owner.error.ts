import { DomainError } from "../../../common/domain/domain-error";

export class CannotRemoveLastOwnerError extends DomainError {
  readonly httpStatus = 409;

  constructor(tripId: string) {
    super(`Cannot remove or demote the last owner of trip: ${tripId}`);
    this.name = "CannotRemoveLastOwnerError";
  }
}
