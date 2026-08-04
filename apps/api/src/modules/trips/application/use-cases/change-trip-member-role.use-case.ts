import type { TripDetails, TripMemberRole } from "@tripplanner/shared-types";

import type { TripRepositoryPort } from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

export class ChangeTripMemberRoleUseCase {
  constructor(private readonly tripRepository: TripRepositoryPort) {}

  async execute(
    tripId: string,
    callerId: string,
    memberId: string,
    newRole: TripMemberRole,
  ): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    const target = trip.members.find((m) => m.id === memberId);
    const wasAlreadyThisRole = target?.role === newRole;

    trip.changeMemberRole(callerId, memberId, newRole);

    if (wasAlreadyThisRole) {
      return trip.toDetails(callerId);
    }

    const updated = await this.tripRepository.updateMemberRole(
      tripId,
      memberId,
      newRole,
    );
    return updated.toDetails(callerId);
  }
}
