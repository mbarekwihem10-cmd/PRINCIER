import { DomainError } from "../../../common/domain/domain-error";

export class TripMemberNotFoundError extends DomainError {
  readonly httpStatus = 404;

  constructor(memberId: string) {
    super(`Trip member not found: ${memberId}`);
    this.name = "TripMemberNotFoundError";
  }
}
