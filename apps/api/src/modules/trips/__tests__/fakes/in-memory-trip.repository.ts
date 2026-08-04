import type {
  TripMemberRole,
  TripMemberStatus,
  TripStatus,
} from "@tripplanner/shared-types";

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
import { TripMemberNotFoundError } from "../../domain/trip-member-not-found.error";
import { TripNotFoundError } from "../../domain/trip-not-found.error";
import { TripDateRange } from "../../domain/value-objects/trip-date-range.value-object";

interface StoredTripMember {
  id: string;
  tripId: string;
  userId: string;
  role: TripMemberRole;
  status: TripMemberStatus;
  invitedBy: string | null;
  joinedAt: Date | null;
  createdAt: Date;
}

interface StoredTrip {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  baseCurrency: string;
  status: TripStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

function copyDate(date: Date | null): Date | null {
  return date ? new Date(date.getTime()) : null;
}

function toMemberProps(member: StoredTripMember): TripMemberProps {
  return {
    id: member.id,
    tripId: member.tripId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    invitedBy: member.invitedBy,
    joinedAt: copyDate(member.joinedAt),
    createdAt: new Date(member.createdAt.getTime()),
  };
}

function toTripProps(stored: StoredTrip, members: TripMember[]): TripProps {
  return {
    id: stored.id,
    name: stored.name,
    description: stored.description,
    destination: stored.destination,
    dateRange: TripDateRange.create(
      copyDate(stored.startDate),
      copyDate(stored.endDate),
    ),
    baseCurrency: stored.baseCurrency,
    status: stored.status,
    createdBy: stored.createdBy,
    createdAt: new Date(stored.createdAt.getTime()),
    updatedAt: new Date(stored.updatedAt.getTime()),
    deletedAt: copyDate(stored.deletedAt),
    members,
  };
}

/**
 * Fake en mémoire, sans dépendance Prisma/NestJS/PostgreSQL. Les méthodes
 * n'effectuent aucune opération asynchrone réelle : pas de mot-clé `async`
 * (règle `@typescript-eslint/require-await`), retour explicite via
 * `Promise.resolve()`/`Promise.reject()` — même convention que
 * `InMemoryUserRepository` (modules/users). Un `Promise.reject()` explicite
 * est nécessaire (plutôt qu'un `throw` synchrone) pour que les erreurs
 * métier restent observables via `.rejects.toThrow()`, comme le ferait le
 * futur repository Prisma réellement asynchrone.
 */
export class InMemoryTripRepository implements TripRepositoryPort {
  private readonly trips: StoredTrip[] = [];
  private readonly members: StoredTripMember[] = [];
  private nextTripId = 1;
  private nextMemberId = 1;

  findById(tripId: string): Promise<Trip | null> {
    const stored = this.trips.find((trip) => trip.id === tripId);
    return Promise.resolve(stored ? this.hydrate(stored) : null);
  }

  findManyForUser(
    userId: string,
    options?: FindManyForUserOptions,
  ): Promise<Trip[]> {
    const allowedStatuses: TripMemberStatus[] = options?.memberStatus
      ? [options.memberStatus]
      : ["Invited", "Accepted"];

    const matchingTripIds = new Set(
      this.members
        .filter(
          (member) =>
            member.userId === userId && allowedStatuses.includes(member.status),
        )
        .map((member) => member.tripId),
    );

    const result = this.trips
      .filter((trip) => trip.deletedAt === null && matchingTripIds.has(trip.id))
      .map((trip) => this.hydrate(trip));

    return Promise.resolve(result);
  }

  createWithOwner(data: CreateTripData): Promise<Trip> {
    const now = new Date();
    const tripId = this.generateTripId();

    const storedTrip: StoredTrip = {
      id: tripId,
      name: data.name,
      description: data.description,
      destination: data.destination,
      startDate: copyDate(data.dateRange.startDate),
      endDate: copyDate(data.dateRange.endDate),
      baseCurrency: data.baseCurrency,
      status: "Planning",
      createdBy: data.createdBy,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
      deletedAt: null,
    };
    this.trips.push(storedTrip);

    const storedMember: StoredTripMember = {
      id: this.generateMemberId(),
      tripId,
      userId: data.createdBy,
      role: "Owner",
      status: "Accepted",
      invitedBy: null,
      joinedAt: new Date(now.getTime()),
      createdAt: new Date(now.getTime()),
    };
    this.members.push(storedMember);

    return Promise.resolve(this.hydrate(storedTrip));
  }

  updateDetails(tripId: string, data: UpdateTripData): Promise<Trip> {
    try {
      const stored = this.requireStoredTrip(tripId);

      if (data.name !== undefined) {
        stored.name = data.name;
      }
      if (data.description !== undefined) {
        stored.description = data.description;
      }
      if (data.destination !== undefined) {
        stored.destination = data.destination;
      }
      if (data.dateRange !== undefined) {
        stored.startDate = copyDate(data.dateRange.startDate);
        stored.endDate = copyDate(data.dateRange.endDate);
      }
      if (data.baseCurrency !== undefined) {
        stored.baseCurrency = data.baseCurrency;
      }
      stored.updatedAt = new Date();

      return Promise.resolve(this.hydrate(stored));
    } catch (error) {
      return Promise.reject(error as Error);
    }
  }

  updateStatus(tripId: string, status: TripStatus): Promise<Trip> {
    try {
      const stored = this.requireStoredTrip(tripId);
      stored.status = status;
      stored.updatedAt = new Date();
      return Promise.resolve(this.hydrate(stored));
    } catch (error) {
      return Promise.reject(error as Error);
    }
  }

  softDelete(tripId: string): Promise<void> {
    const stored = this.trips.find((trip) => trip.id === tripId);
    if (!stored || stored.deletedAt !== null) {
      return Promise.resolve();
    }
    const now = new Date();
    stored.deletedAt = new Date(now.getTime());
    stored.updatedAt = new Date(now.getTime());
    return Promise.resolve();
  }

  upsertMember(tripId: string, data: UpsertTripMemberData): Promise<Trip> {
    try {
      const stored = this.requireStoredTrip(tripId);

      const existing = this.members.find(
        (member) => member.tripId === tripId && member.userId === data.userId,
      );

      if (existing) {
        existing.status = "Invited";
        existing.joinedAt = null;
        existing.invitedBy = data.invitedBy;
      } else {
        this.members.push({
          id: this.generateMemberId(),
          tripId,
          userId: data.userId,
          role: "Member",
          status: "Invited",
          invitedBy: data.invitedBy,
          joinedAt: null,
          createdAt: new Date(),
        });
      }

      return Promise.resolve(this.hydrate(stored));
    } catch (error) {
      return Promise.reject(error as Error);
    }
  }

  updateMemberStatus(
    tripId: string,
    memberId: string,
    status: TripMemberStatus,
    joinedAt: Date | null,
  ): Promise<Trip> {
    try {
      const member = this.requireStoredMember(tripId, memberId);
      member.status = status;
      member.joinedAt = copyDate(joinedAt);

      const stored = this.requireStoredTrip(tripId);
      return Promise.resolve(this.hydrate(stored));
    } catch (error) {
      return Promise.reject(error as Error);
    }
  }

  updateMemberRole(
    tripId: string,
    memberId: string,
    role: TripMemberRole,
  ): Promise<Trip> {
    try {
      const member = this.requireStoredMember(tripId, memberId);
      member.role = role;

      const stored = this.requireStoredTrip(tripId);
      return Promise.resolve(this.hydrate(stored));
    } catch (error) {
      return Promise.reject(error as Error);
    }
  }

  private requireStoredTrip(tripId: string): StoredTrip {
    const stored = this.trips.find((trip) => trip.id === tripId);
    if (!stored) {
      throw new TripNotFoundError(tripId);
    }
    return stored;
  }

  private requireStoredMember(
    tripId: string,
    memberId: string,
  ): StoredTripMember {
    const member = this.members.find(
      (candidate) => candidate.id === memberId && candidate.tripId === tripId,
    );
    if (!member) {
      throw new TripMemberNotFoundError(memberId);
    }
    return member;
  }

  private hydrate(stored: StoredTrip): Trip {
    const tripMembers = this.members
      .filter((member) => member.tripId === stored.id)
      .map((member) => TripMember.fromPersistence(toMemberProps(member)));

    return Trip.fromPersistence(toTripProps(stored, tripMembers));
  }

  private generateTripId(): string {
    return `trip-${this.nextTripId++}`;
  }

  private generateMemberId(): string {
    return `member-${this.nextMemberId++}`;
  }
}
