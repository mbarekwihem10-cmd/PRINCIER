import { DomainError } from "../../../common/domain/domain-error";

export class InvalidTripDateRangeError extends DomainError {
  readonly httpStatus = 422;

  constructor(message = "Invalid trip date range") {
    super(message);
    this.name = "InvalidTripDateRangeError";
  }
}
