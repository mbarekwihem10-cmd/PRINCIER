import { Inject, Injectable } from "@nestjs/common";

import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

@Injectable()
export class DeleteTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(tripId: string, callerId: string): Promise<void> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    const wasAlreadyDeleted = trip.isDeleted;

    trip.markDeleted(callerId);

    if (wasAlreadyDeleted) {
      return;
    }

    await this.tripRepository.softDelete(tripId);
  }
}
