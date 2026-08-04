import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../../common/prisma/prisma.service";

import { PrismaTripRepository } from "./prisma-trip.repository";

type MockPrismaTrip = Prisma.TripGetPayload<{ include: { members: true } }>;

type FindUniqueMock = jest.Mock<
  Promise<MockPrismaTrip | null>,
  [Prisma.TripFindUniqueArgs]
>;
type FindManyMock = jest.Mock<
  Promise<MockPrismaTrip[]>,
  [Prisma.TripFindManyArgs]
>;

interface PrismaTripDelegateMocks {
  readonly findUnique: FindUniqueMock;
  readonly findMany: FindManyMock;
}

function buildPrismaTripDelegateMocks(): PrismaTripDelegateMocks {
  return {
    findUnique: jest.fn<
      Promise<MockPrismaTrip | null>,
      [Prisma.TripFindUniqueArgs]
    >(),
    findMany: jest.fn<Promise<MockPrismaTrip[]>, [Prisma.TripFindManyArgs]>(),
  };
}

function buildRepository(
  tripDelegateMocks: PrismaTripDelegateMocks,
): PrismaTripRepository {
  const prismaStub = { trip: tripDelegateMocks };
  return new PrismaTripRepository(prismaStub as unknown as PrismaService);
}

const OWNER_MEMBER = {
  id: "member-owner",
  tripId: "trip-1",
  userId: "owner-1",
  role: "Owner",
  status: "Accepted",
  invitedBy: null,
  joinedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies MockPrismaTrip["members"][number];

function buildPrismaTrip(
  overrides: Partial<MockPrismaTrip> = {},
): MockPrismaTrip {
  return {
    id: "trip-1",
    name: "Summer trip",
    description: null,
    coverImageFileId: null,
    destination: "Lisbon",
    startDate: null,
    endDate: null,
    baseCurrency: "EUR",
    status: "Planning",
    travelGroupId: null,
    createdBy: "owner-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    members: [OWNER_MEMBER],
    ...overrides,
  };
}

describe("PrismaTripRepository", () => {
  describe("findById", () => {
    it("returns null when Prisma finds no matching trip", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findUnique.mockResolvedValue(null);
      const repository = buildRepository(tripDelegateMocks);

      const result = await repository.findById("unknown-trip");

      expect(result).toBeNull();
    });

    it("queries by id with no deletedAt filter, so soft-deleted trips are still returned", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findUnique.mockResolvedValue(buildPrismaTrip());
      const repository = buildRepository(tripDelegateMocks);

      await repository.findById("trip-1");

      expect(tripDelegateMocks.findUnique).toHaveBeenCalledTimes(1);
      const callArgs = tripDelegateMocks.findUnique.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: findUnique was not called");
      }
      expect(callArgs.where).toEqual({ id: "trip-1" });
      expect(callArgs.where).not.toHaveProperty("deletedAt");
    });

    it("requests members ordered by createdAt ascending", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findUnique.mockResolvedValue(buildPrismaTrip());
      const repository = buildRepository(tripDelegateMocks);

      await repository.findById("trip-1");

      const callArgs = tripDelegateMocks.findUnique.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: findUnique was not called");
      }
      expect(callArgs.include).toEqual({
        members: { orderBy: { createdAt: "asc" } },
      });
    });

    it("maps an active trip's scalar fields and members into the Domain entity", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findUnique.mockResolvedValue(
        buildPrismaTrip({ destination: "Porto" }),
      );
      const repository = buildRepository(tripDelegateMocks);

      const result = await repository.findById("trip-1");

      if (!result) {
        throw new Error("expected a mapped Trip, got null");
      }
      expect(result.id).toBe("trip-1");
      expect(result.destination).toBe("Porto");
      expect(result.isDeleted).toBe(false);
      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.userId).toBe("owner-1");
      expect(result.members[0]?.role).toBe("Owner");
    });

    it("maps a soft-deleted trip into a Domain entity with isDeleted true", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findUnique.mockResolvedValue(
        buildPrismaTrip({ deletedAt: new Date("2026-02-01T00:00:00.000Z") }),
      );
      const repository = buildRepository(tripDelegateMocks);

      const result = await repository.findById("trip-1");

      if (!result) {
        throw new Error("expected a mapped Trip, got null");
      }
      expect(result.isDeleted).toBe(true);
      expect(result.deletedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    });
  });

  describe("findManyForUser", () => {
    it("always excludes soft-deleted trips via the where clause", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findMany.mockResolvedValue([]);
      const repository = buildRepository(tripDelegateMocks);

      await repository.findManyForUser("user-1");

      const callArgs = tripDelegateMocks.findMany.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: findMany was not called");
      }
      expect(callArgs.where?.deletedAt).toBeNull();
    });

    it("without options, filters membership to Invited and Accepted only", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findMany.mockResolvedValue([]);
      const repository = buildRepository(tripDelegateMocks);

      await repository.findManyForUser("user-1");

      const callArgs = tripDelegateMocks.findMany.mock.calls[0]?.[0];
      if (!callArgs?.where) {
        throw new Error("test setup failed: findMany was not called");
      }
      const membersFilter = callArgs.where.members;
      expect(membersFilter?.some?.userId).toBe("user-1");
      expect(membersFilter?.some?.status).toEqual({
        in: ["Invited", "Accepted"],
      });
    });

    it("with memberStatus 'Invited', filters membership to Invited only", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findMany.mockResolvedValue([]);
      const repository = buildRepository(tripDelegateMocks);

      await repository.findManyForUser("user-1", { memberStatus: "Invited" });

      const callArgs = tripDelegateMocks.findMany.mock.calls[0]?.[0];
      if (!callArgs?.where) {
        throw new Error("test setup failed: findMany was not called");
      }
      const membersFilter = callArgs.where.members;
      expect(membersFilter?.some?.status).toEqual({ in: ["Invited"] });
    });

    it("with memberStatus 'Accepted', filters membership to Accepted only", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findMany.mockResolvedValue([]);
      const repository = buildRepository(tripDelegateMocks);

      await repository.findManyForUser("user-1", { memberStatus: "Accepted" });

      const callArgs = tripDelegateMocks.findMany.mock.calls[0]?.[0];
      if (!callArgs?.where) {
        throw new Error("test setup failed: findMany was not called");
      }
      const membersFilter = callArgs.where.members;
      expect(membersFilter?.some?.status).toEqual({ in: ["Accepted"] });
    });

    it("adds no filter on the trip's own status, so Archived trips are still included", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      tripDelegateMocks.findMany.mockResolvedValue([]);
      const repository = buildRepository(tripDelegateMocks);

      await repository.findManyForUser("user-1");

      const callArgs = tripDelegateMocks.findMany.mock.calls[0]?.[0];
      if (!callArgs?.where) {
        throw new Error("test setup failed: findMany was not called");
      }
      expect(callArgs.where).not.toHaveProperty("status");
    });

    it("includes all of each trip's members, ordered by createdAt ascending", async () => {
      const tripDelegateMocks = buildPrismaTripDelegateMocks();
      const secondMember = {
        ...OWNER_MEMBER,
        id: "member-2",
        userId: "user-1",
        role: "Member" as const,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      };
      tripDelegateMocks.findMany.mockResolvedValue([
        buildPrismaTrip({ members: [OWNER_MEMBER, secondMember] }),
      ]);
      const repository = buildRepository(tripDelegateMocks);

      const results = await repository.findManyForUser("user-1");

      const callArgs = tripDelegateMocks.findMany.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: findMany was not called");
      }
      expect(callArgs.include).toEqual({
        members: { orderBy: { createdAt: "asc" } },
      });
      expect(results[0]?.members).toHaveLength(2);
      expect(results[0]?.members.map((member) => member.userId)).toEqual([
        "owner-1",
        "user-1",
      ]);
    });
  });
});
