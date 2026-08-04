import { DomainError } from "../../../common/domain/domain-error";

export class DuplicateTripMemberError extends DomainError {
  readonly httpStatus = 409;

  constructor(tripId: string) {
    super(`User is already invited or a member of trip: ${tripId}`);
    this.name = "DuplicateTripMemberError";
  }
}
