import { Inject, Injectable } from "@nestjs/common";
import type { TripDetails } from "@tripplanner/shared-types";

import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripDateRange } from "../../domain/value-objects/trip-date-range.value-object";

export interface CreateTripInput {
  readonly name: string;
  readonly description: string | null;
  readonly destination: string | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly baseCurrency: string;
}

@Injectable()
export class CreateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(callerId: string, data: CreateTripInput): Promise<TripDetails> {
    const dateRange = TripDateRange.create(data.startDate, data.endDate);

    const trip = await this.tripRepository.createWithOwner({
      name: data.name,
      description: data.description,
      destination: data.destination,
      dateRange,
      baseCurrency: data.baseCurrency,
      createdBy: callerId,
    });

    return trip.toDetails(callerId);
  }
}
