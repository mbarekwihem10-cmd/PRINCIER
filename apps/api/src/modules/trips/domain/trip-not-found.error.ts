import { DomainError } from "../../../common/domain/domain-error";

export class TripNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(tripId: string) {
    super(`Trip not found: ${tripId}`);
    this.name = "TripNotFoundError";
  }
}
