import type { TripRepositoryPort } from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

export class LeaveTripUseCase {
  constructor(private readonly tripRepository: TripRepositoryPort) {}

  async execute(tripId: string, callerId: string): Promise<void> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    trip.leave(callerId);

    const member = trip.members.find((m) => m.userId === callerId);
    if (!member) {
      throw new TripNotFoundError(tripId);
    }

    await this.tripRepository.updateMemberStatus(
      tripId,
      member.id,
      "Removed",
      null,
    );
  }
}
