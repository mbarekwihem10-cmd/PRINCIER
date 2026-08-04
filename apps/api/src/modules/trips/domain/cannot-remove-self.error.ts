import { DomainError } from "../../../common/domain/domain-error";

export class CannotRemoveSelfError extends DomainError {
  readonly httpStatus = 409;

  constructor(tripId: string) {
    super(`Cannot remove yourself from trip: ${tripId}`);
    this.name = "CannotRemoveSelfError";
  }
}
