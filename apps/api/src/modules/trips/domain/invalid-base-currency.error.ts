import { DomainError } from "../../../common/domain/domain-error";

export class InvalidBaseCurrencyError extends DomainError {
  readonly httpStatus = 422;

  constructor(currencyCode: string) {
    super(`Unknown base currency: ${currencyCode}`);
    this.name = "InvalidBaseCurrencyError";
  }
}
