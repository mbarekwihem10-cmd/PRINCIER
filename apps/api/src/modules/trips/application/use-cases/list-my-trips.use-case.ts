import { Inject, Injectable } from "@nestjs/common";
import type { TripSummary } from "@tripplanner/shared-types";

import {
  TRIP_REPOSITORY,
  type FindManyForUserOptions,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";

@Injectable()
export class ListMyTripsUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(
    callerId: string,
    filter?: FindManyForUserOptions,
  ): Promise<TripSummary[]> {
    const trips = await this.tripRepository.findManyForUser(callerId, filter);
    return trips.map((trip) => trip.toSummary(callerId));
  }
}
