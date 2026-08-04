import type {
  TripMemberRole,
  TripMemberStatus,
  TripStatus,
} from "@tripplanner/shared-types";

import type { Trip, UpdateTripData } from "../entities/trip.entity";
import type { TripDateRange } from "../value-objects/trip-date-range.value-object";

export const TRIP_REPOSITORY = Symbol("TRIP_REPOSITORY");

export type ActiveTripMemberStatus = Extract<
  TripMemberStatus,
  "Invited" | "Accepted"
>;

export interface FindManyForUserOptions {
  readonly memberStatus?: ActiveTripMemberStatus;
}

export interface CreateTripData {
  readonly name: string;
  readonly description: string | null;
  readonly destination: string | null;
  readonly dateRange: TripDateRange;
  readonly baseCurrency: string;
  readonly createdBy: string;
}

export interface UpsertTripMemberData {
  readonly userId: string;
  readonly invitedBy: string;
}

export interface TripRepositoryPort {
  findById(tripId: string): Promise<Trip | null>;

  findManyForUser(
    userId: string,
    options?: FindManyForUserOptions,
  ): Promise<Trip[]>;

  createWithOwner(data: CreateTripData): Promise<Trip>;

  updateDetails(tripId: string, data: UpdateTripData): Promise<Trip>;

  updateStatus(tripId: string, status: TripStatus): Promise<Trip>;

  softDelete(tripId: string): Promise<void>;

  upsertMember(tripId: string, data: UpsertTripMemberData): Promise<Trip>;

  updateMemberStatus(
    tripId: string,
    memberId: string,
    status: TripMemberStatus,
    joinedAt: Date | null,
  ): Promise<Trip>;

  updateMemberRole(
    tripId: string,
    memberId: string,
    role: TripMemberRole,
  ): Promise<Trip>;
}
