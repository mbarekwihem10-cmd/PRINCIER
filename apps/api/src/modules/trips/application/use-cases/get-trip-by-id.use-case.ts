import { Inject, Injectable } from "@nestjs/common";
import type { TripDetails } from "@tripplanner/shared-types";

import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

@Injectable()
export class GetTripByIdUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(tripId: string, callerId: string): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    return trip.toDetails(callerId);
  }
}
