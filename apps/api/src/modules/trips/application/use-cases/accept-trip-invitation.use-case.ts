import { Inject, Injectable } from "@nestjs/common";
import type { TripDetails } from "@tripplanner/shared-types";

import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

@Injectable()
export class AcceptTripInvitationUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(tripId: string, callerId: string): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    trip.acceptInvitation(callerId);

    const member = trip.members.find((m) => m.userId === callerId);
    if (!member) {
      throw new TripNotFoundError(tripId);
    }

    const updated = await this.tripRepository.updateMemberStatus(
      tripId,
      member.id,
      "Accepted",
      member.joinedAt,
    );
    return updated.toDetails(callerId);
  }
}
