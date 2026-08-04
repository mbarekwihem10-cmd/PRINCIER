import { DomainError } from "../../../common/domain/domain-error";

export class InvalidMemberStatusTransitionError extends DomainError {
  readonly httpStatus = 409;

  constructor(memberId: string) {
    super(`Invalid status transition for trip member: ${memberId}`);
    this.name = "InvalidMemberStatusTransitionError";
  }
}
