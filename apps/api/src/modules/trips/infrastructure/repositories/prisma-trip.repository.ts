import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  TripMemberRole,
  TripMemberStatus,
  TripStatus,
} from "@tripplanner/shared-types";

import { PrismaService } from "../../../../common/prisma/prisma.service";
import {
  TripMember,
  type TripMemberProps,
} from "../../domain/entities/trip-member.entity";
import {
  Trip,
  type TripProps,
  type UpdateTripData,
} from "../../domain/entities/trip.entity";
import type {
  CreateTripData,
  FindManyForUserOptions,
  TripRepositoryPort,
  UpsertTripMemberData,
} from "../../domain/ports/trip.repository.port";
import { TripDateRange } from "../../domain/value-objects/trip-date-range.value-object";

type PrismaTripWithMembers = Prisma.TripGetPayload<{
  include: { members: true };
}>;

type PrismaTripMember = PrismaTripWithMembers["members"][number];

const MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT = {
  members: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.TripInclude;

function toMemberProps(member: PrismaTripMember): TripMemberProps {
  return {
    id: member.id,
    tripId: member.tripId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    invitedBy: member.invitedBy,
    joinedAt: member.joinedAt,
    createdAt: member.createdAt,
  };
}

function toTripProps(trip: PrismaTripWithMembers): TripProps {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    destination: trip.destination,
    dateRange: TripDateRange.create(trip.startDate, trip.endDate),
    baseCurrency: trip.baseCurrency,
    status: trip.status,
    createdBy: trip.createdBy,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    deletedAt: trip.deletedAt,
    members: trip.members.map((member) =>
      TripMember.fromPersistence(toMemberProps(member)),
    ),
  };
}

function toDomainTrip(trip: PrismaTripWithMembers): Trip {
  return Trip.fromPersistence(toTripProps(trip));
}

@Injectable()
export class PrismaTripRepository implements TripRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tripId: string): Promise<Trip | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT,
    });
    return trip ? toDomainTrip(trip) : null;
  }

  async findManyForUser(
    userId: string,
    options?: FindManyForUserOptions,
  ): Promise<Trip[]> {
    const allowedStatuses: TripMemberStatus[] = options?.memberStatus
      ? [options.memberStatus]
      : ["Invited", "Accepted"];

    const trips = await this.prisma.trip.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId, status: { in: allowedStatuses } } },
      },
      include: MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT,
    });

    return trips.map(toDomainTrip);
  }

  // Not implemented: write-side methods are out of scope for Lot 5B.1
  // (read-only mapping). Scheduled for Lot 5B.2. Never exercised by any test.

  createWithOwner(_data: CreateTripData): Promise<Trip> {
    return Promise.reject(
      new Error("PrismaTripRepository.createWithOwner is not implemented yet"),
    );
  }

  updateDetails(_tripId: string, _data: UpdateTripData): Promise<Trip> {
    return Promise.reject(
      new Error("PrismaTripRepository.updateDetails is not implemented yet"),
    );
  }

  updateStatus(_tripId: string, _status: TripStatus): Promise<Trip> {
    return Promise.reject(
      new Error("PrismaTripRepository.updateStatus is not implemented yet"),
    );
  }

  softDelete(_tripId: string): Promise<void> {
    return Promise.reject(
      new Error("PrismaTripRepository.softDelete is not implemented yet"),
    );
  }

  upsertMember(_tripId: string, _data: UpsertTripMemberData): Promise<Trip> {
    return Promise.reject(
      new Error("PrismaTripRepository.upsertMember is not implemented yet"),
    );
  }

  updateMemberStatus(
    _tripId: string,
    _memberId: string,
    _status: TripMemberStatus,
    _joinedAt: Date | null,
  ): Promise<Trip> {
    return Promise.reject(
      new Error(
        "PrismaTripRepository.updateMemberStatus is not implemented yet",
      ),
    );
  }

  updateMemberRole(
    _tripId: string,
    _memberId: string,
    _role: TripMemberRole,
  ): Promise<Trip> {
    return Promise.reject(
      new Error("PrismaTripRepository.updateMemberRole is not implemented yet"),
    );
  }
}
