import { Inject, Injectable } from "@nestjs/common";
import type { TripDetails } from "@tripplanner/shared-types";

import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

@Injectable()
export class ArchiveTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(tripId: string, callerId: string): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    const wasAlreadyArchived = trip.status === "Archived";

    trip.archive(callerId);

    if (wasAlreadyArchived) {
      return trip.toDetails(callerId);
    }

    const updated = await this.tripRepository.updateStatus(tripId, "Archived");
    return updated.toDetails(callerId);
  }
}
