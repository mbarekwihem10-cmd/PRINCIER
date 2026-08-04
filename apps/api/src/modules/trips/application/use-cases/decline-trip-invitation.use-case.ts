import { Inject, Injectable } from "@nestjs/common";

import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

@Injectable()
export class DeclineTripInvitationUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(tripId: string, callerId: string): Promise<void> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    trip.declineInvitation(callerId);

    const member = trip.members.find((m) => m.userId === callerId);
    if (!member) {
      throw new TripNotFoundError(tripId);
    }

    await this.tripRepository.updateMemberStatus(
      tripId,
      member.id,
      "Declined",
      null,
    );
  }
}
