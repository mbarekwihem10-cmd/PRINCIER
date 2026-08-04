import { Inject, Injectable } from "@nestjs/common";
import type { TripDetails } from "@tripplanner/shared-types";

import type { UpdateTripData } from "../../domain/entities/trip.entity";
import {
  TRIP_REPOSITORY,
  type TripRepositoryPort,
} from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";
import { TripDateRange } from "../../domain/value-objects/trip-date-range.value-object";

export interface UpdateTripInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly destination?: string | null;
  readonly startDate?: Date | null;
  readonly endDate?: Date | null;
  readonly baseCurrency?: string;
}

@Injectable()
export class UpdateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: TripRepositoryPort,
  ) {}

  async execute(
    tripId: string,
    callerId: string,
    data: UpdateTripInput,
  ): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    trip.assertEditableBy(callerId);

    const startDate =
      data.startDate !== undefined ? data.startDate : trip.dateRange.startDate;
    const endDate =
      data.endDate !== undefined ? data.endDate : trip.dateRange.endDate;

    const dateRange =
      data.startDate !== undefined || data.endDate !== undefined
        ? TripDateRange.create(startDate, endDate)
        : undefined;

    const updateData: UpdateTripData = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.destination !== undefined && { destination: data.destination }),
      ...(dateRange !== undefined && { dateRange }),
      ...(data.baseCurrency !== undefined && {
        baseCurrency: data.baseCurrency,
      }),
    };

    trip.updateDetails(callerId, updateData);

    if (Object.keys(updateData).length === 0) {
      return trip.toDetails(callerId);
    }

    const updated = await this.tripRepository.updateDetails(tripId, updateData);
    return updated.toDetails(callerId);
  }
}
