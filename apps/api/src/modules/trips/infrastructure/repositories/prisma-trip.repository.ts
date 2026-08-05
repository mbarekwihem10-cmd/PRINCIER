import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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
import { TripNotFoundError } from "../../domain/trip-not-found.error";
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

function isPrismaRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
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

  async createWithOwner(data: CreateTripData): Promise<Trip> {
    const joinedAt = new Date();

    const trip = await this.prisma.trip.create({
      data: {
        name: data.name,
        description: data.description,
        destination: data.destination,
        startDate: data.dateRange.startDate,
        endDate: data.dateRange.endDate,
        baseCurrency: data.baseCurrency,
        status: "Planning",
        createdBy: data.createdBy,
        members: {
          create: {
            userId: data.createdBy,
            role: "Owner",
            status: "Accepted",
            invitedBy: null,
            joinedAt,
          },
        },
      },
      include: MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT,
    });

    return toDomainTrip(trip);
  }

  async updateDetails(tripId: string, data: UpdateTripData): Promise<Trip> {
    try {
      const trip = await this.prisma.trip.update({
        where: { id: tripId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.destination !== undefined && {
            destination: data.destination,
          }),
          ...(data.dateRange !== undefined && {
            startDate: data.dateRange.startDate,
            endDate: data.dateRange.endDate,
          }),
          ...(data.baseCurrency !== undefined && {
            baseCurrency: data.baseCurrency,
          }),
        },
        include: MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT,
      });

      return toDomainTrip(trip);
    } catch (error: unknown) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new TripNotFoundError(tripId);
      }

      throw error;
    }
  }

  async updateStatus(tripId: string, status: TripStatus): Promise<Trip> {
    try {
      const trip = await this.prisma.trip.update({
        where: { id: tripId },
        data: { status },
        include: MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT,
      });

      return toDomainTrip(trip);
    } catch (error: unknown) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new TripNotFoundError(tripId);
      }

      throw error;
    }
  }

  async softDelete(tripId: string): Promise<void> {
    const deletedAt = new Date();

    await this.prisma.trip.updateMany({
      where: {
        id: tripId,
        deletedAt: null,
      },
      data: {
        deletedAt,
      },
    });
  }

  async upsertMember(
    tripId: string,
    data: UpsertTripMemberData,
  ): Promise<Trip> {
    try {
      const trip = await this.prisma.trip.update({
        where: { id: tripId },
        data: {
          members: {
            upsert: {
              where: {
                tripId_userId: {
                  tripId,
                  userId: data.userId,
                },
              },
              create: {
                userId: data.userId,
                role: data.role ?? "Member",
                status: "Invited",
                invitedBy: data.invitedBy,
                joinedAt: null,
              },
              update: {
                status: "Invited",
                joinedAt: null,
                invitedBy: data.invitedBy,
                ...(data.role !== undefined ? { role: data.role } : {}),
              },
            },
          },
        },
        include: MEMBERS_INCLUDE_ORDERED_BY_CREATED_AT,
      });

      return toDomainTrip(trip);
    } catch (error: unknown) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new TripNotFoundError(tripId);
      }

      throw error;
    }
  }

  // Remaining member write-side methods are not implemented yet.
  // Scheduled for later Lot 5B.2 sub-steps. Never exercised by any test.

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
