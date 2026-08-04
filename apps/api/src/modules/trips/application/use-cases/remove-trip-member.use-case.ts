import type { TripDetails } from "@tripplanner/shared-types";

import type { TripRepositoryPort } from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

export class RemoveTripMemberUseCase {
  constructor(private readonly tripRepository: TripRepositoryPort) {}

  async execute(
    tripId: string,
    callerId: string,
    memberId: string,
  ): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    const target = trip.members.find((m) => m.id === memberId);
    const wasAlreadyRemoved = target?.status === "Removed";

    trip.removeMember(callerId, memberId);

    if (wasAlreadyRemoved) {
      return trip.toDetails(callerId);
    }

    const updated = await this.tripRepository.updateMemberStatus(
      tripId,
      memberId,
      "Removed",
      null,
    );
    return updated.toDetails(callerId);
  }
}
