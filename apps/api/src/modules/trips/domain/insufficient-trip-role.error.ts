import { DomainError } from "../../../common/domain/domain-error";

export class InsufficientTripRoleError extends DomainError {
  readonly httpStatus = 403;

  constructor(tripId: string) {
    super(`Insufficient role on trip: ${tripId}`);
    this.name = "InsufficientTripRoleError";
  }
}
