import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../../common/prisma/prisma.service";
import type { UpdateTripData } from "../../domain/entities/trip.entity";
import type { CreateTripData } from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";
import { TripDateRange } from "../../domain/value-objects/trip-date-range.value-object";

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

  describe("createWithOwner", () => {
    function buildCreateTripData(
      overrides: Partial<CreateTripData> = {},
    ): CreateTripData {
      return {
        name: "Summer trip",
        description: null,
        destination: "Lisbon",
        dateRange: TripDateRange.create(
          new Date("2026-07-01T00:00:00.000Z"),
          new Date("2026-07-10T00:00:00.000Z"),
        ),
        baseCurrency: "EUR",
        createdBy: "owner-1",
        ...overrides,
      };
    }

    function buildCreatedPrismaTrip(
      overrides: Partial<MockPrismaTrip> = {},
    ): MockPrismaTrip {
      return buildPrismaTrip({
        status: "Planning",
        members: [{ ...OWNER_MEMBER, id: "member-owner-new" }],
        ...overrides,
      });
    }

    function buildCreateHarness(): {
      repository: PrismaTripRepository;
      createMock: jest.Mock<Promise<MockPrismaTrip>, [Prisma.TripCreateArgs]>;
      transactionMock: jest.Mock;
    } {
      const createMock = jest.fn<
        Promise<MockPrismaTrip>,
        [Prisma.TripCreateArgs]
      >();
      const transactionMock = jest.fn();
      const prismaStub = {
        trip: { create: createMock },
        $transaction: transactionMock,
      };
      const repository = new PrismaTripRepository(
        prismaStub as unknown as PrismaService,
      );
      return { repository, createMock, transactionMock };
    }

    it("calls prisma.trip.create exactly once", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());

      await repository.createWithOwner(buildCreateTripData());

      expect(createMock).toHaveBeenCalledTimes(1);
    });

    it("maps CreateTripData scalar fields into the create data", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());
      const data = buildCreateTripData({ description: "A trip to remember" });

      await repository.createWithOwner(data);

      const callArgs = createMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: create was not called");
      }
      expect(callArgs.data.name).toBe("Summer trip");
      expect(callArgs.data.description).toBe("A trip to remember");
      expect(callArgs.data.destination).toBe("Lisbon");
      expect(callArgs.data.baseCurrency).toBe("EUR");
      expect(callArgs.data.createdBy).toBe("owner-1");
    });

    it("converts dateRange into startDate and endDate", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());
      const data = buildCreateTripData();

      await repository.createWithOwner(data);

      const callArgs = createMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: create was not called");
      }
      expect(callArgs.data.startDate).toEqual(data.dateRange.startDate);
      expect(callArgs.data.endDate).toEqual(data.dateRange.endDate);
    });

    it("forces the trip status to 'Planning'", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());

      await repository.createWithOwner(buildCreateTripData());

      const callArgs = createMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: create was not called");
      }
      expect(callArgs.data.status).toBe("Planning");
    });

    it("creates a nested Owner member with status Accepted", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());
      const data = buildCreateTripData({ createdBy: "owner-42" });

      await repository.createWithOwner(data);

      const callArgs = createMock.mock.calls[0]?.[0];
      const nestedCreate = callArgs?.data.members?.create;
      if (!nestedCreate || Array.isArray(nestedCreate)) {
        throw new Error(
          "test setup failed: expected a single nested member create",
        );
      }
      expect(nestedCreate.userId).toBe("owner-42");
      expect(nestedCreate.role).toBe("Owner");
      expect(nestedCreate.status).toBe("Accepted");
    });

    it("sets invitedBy to null and joinedAt to a Date on the nested member", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());

      await repository.createWithOwner(buildCreateTripData());

      const callArgs = createMock.mock.calls[0]?.[0];
      const nestedCreate = callArgs?.data.members?.create;
      if (!nestedCreate || Array.isArray(nestedCreate)) {
        throw new Error(
          "test setup failed: expected a single nested member create",
        );
      }
      expect(nestedCreate.invitedBy).toBeNull();
      expect(nestedCreate.joinedAt).toBeInstanceOf(Date);
    });

    it("includes members ordered by createdAt ascending", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());

      await repository.createWithOwner(buildCreateTripData());

      const callArgs = createMock.mock.calls[0]?.[0];
      expect(callArgs?.include).toEqual({
        members: { orderBy: { createdAt: "asc" } },
      });
    });

    it("maps the Prisma result into a Domain Trip with its Owner member", async () => {
      const { repository, createMock } = buildCreateHarness();
      createMock.mockResolvedValue(
        buildCreatedPrismaTrip({ id: "trip-new", name: "Summer trip" }),
      );

      const result = await repository.createWithOwner(buildCreateTripData());

      expect(result.id).toBe("trip-new");
      expect(result.name).toBe("Summer trip");
      expect(result.status).toBe("Planning");
      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.role).toBe("Owner");
      expect(result.members[0]?.status).toBe("Accepted");
    });

    it("propagates a Prisma error unchanged", async () => {
      const { repository, createMock } = buildCreateHarness();
      const simulatedError = new Error("simulated P2003 foreign key violation");
      createMock.mockRejectedValue(simulatedError);

      await expect(
        repository.createWithOwner(buildCreateTripData()),
      ).rejects.toBe(simulatedError);
    });

    it("never calls $transaction", async () => {
      const { repository, createMock, transactionMock } = buildCreateHarness();
      createMock.mockResolvedValue(buildCreatedPrismaTrip());

      await repository.createWithOwner(buildCreateTripData());

      expect(transactionMock).not.toHaveBeenCalled();
    });
  });

  describe("updateDetails", () => {
    type UpdateMock = jest.Mock<
      Promise<MockPrismaTrip>,
      [Prisma.TripUpdateArgs]
    >;

    function buildUpdateHarness(): {
      repository: PrismaTripRepository;
      updateMock: UpdateMock;
    } {
      const updateMock = jest.fn<
        Promise<MockPrismaTrip>,
        [Prisma.TripUpdateArgs]
      >();
      const prismaStub = { trip: { update: updateMock } };
      const repository = new PrismaTripRepository(
        prismaStub as unknown as PrismaService,
      );
      return { repository, updateMock };
    }

    it("transmits only 'name' when only name is provided", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { name: "New name" });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ name: "New name" });
    });

    it("transmits only 'description' when set to a string", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { description: "New desc" });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ description: "New desc" });
    });

    it("transmits description: null explicitly", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { description: null });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ description: null });
    });

    it("transmits only 'destination' when set to a string", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { destination: "Porto" });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ destination: "Porto" });
    });

    it("transmits destination: null explicitly", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { destination: null });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ destination: null });
    });

    it("converts dateRange into startDate and endDate together", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());
      const dateRange = TripDateRange.create(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-10T00:00:00.000Z"),
      );

      await repository.updateDetails("trip-1", { dateRange });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
    });

    it("transmits null startDate and endDate when dateRange clears both bounds", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());
      const dateRange = TripDateRange.create(null, null);

      await repository.updateDetails("trip-1", { dateRange });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ startDate: null, endDate: null });
    });

    it("transmits only 'baseCurrency' when provided alone", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { baseCurrency: "USD" });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ baseCurrency: "USD" });
    });

    it("transmits multiple fields together", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", {
        name: "New name",
        baseCurrency: "USD",
      });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ name: "New name", baseCurrency: "USD" });
    });

    it("omits fields that are not provided", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { name: "Only name" });

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).not.toHaveProperty("description");
      expect(callArgs.data).not.toHaveProperty("destination");
      expect(callArgs.data).not.toHaveProperty("baseCurrency");
      expect(callArgs.data).not.toHaveProperty("startDate");
      expect(callArgs.data).not.toHaveProperty("endDate");
    });

    it("transmits an empty data object for an empty UpdateTripData", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());
      const emptyData: UpdateTripData = {};

      await repository.updateDetails("trip-1", emptyData);

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({});
    });

    it("includes members ordered by createdAt ascending", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip());

      await repository.updateDetails("trip-1", { name: "New name" });

      const callArgs = updateMock.mock.calls[0]?.[0];
      expect(callArgs?.include).toEqual({
        members: { orderBy: { createdAt: "asc" } },
      });
    });

    it("maps the Prisma result into a Domain Trip", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      updateMock.mockResolvedValue(buildPrismaTrip({ name: "Updated name" }));

      const result = await repository.updateDetails("trip-1", {
        name: "Updated name",
      });

      expect(result.name).toBe("Updated name");
      expect(result.members).toHaveLength(1);
    });

    it("translates a simulated P2025 into TripNotFoundError with the given tripId", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      const notFoundError = new Prisma.PrismaClientKnownRequestError(
        "An operation failed because it depends on one or more records that were required but not found.",
        { code: "P2025", clientVersion: "6.19.3" },
      );
      updateMock.mockRejectedValue(notFoundError);

      await expect(
        repository.updateDetails("unknown-trip", { name: "New name" }),
      ).rejects.toThrow(new TripNotFoundError("unknown-trip"));
    });

    it("propagates a non-P2025 error unchanged", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      const otherError = new Error("connection lost");
      updateMock.mockRejectedValue(otherError);

      await expect(
        repository.updateDetails("trip-1", { name: "New name" }),
      ).rejects.toBe(otherError);
    });

    it("propagates a simulated P2003 without translating it into TripNotFoundError or InvalidBaseCurrencyError", async () => {
      const { repository, updateMock } = buildUpdateHarness();
      const foreignKeyError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed on the field: `trips_base_currency_fkey`",
        {
          code: "P2003",
          clientVersion: "6.19.3",
          meta: { constraint: "trips_base_currency_fkey" },
        },
      );
      updateMock.mockRejectedValue(foreignKeyError);

      await expect(
        repository.updateDetails("trip-1", { baseCurrency: "XXX" }),
      ).rejects.toBe(foreignKeyError);
    });
  });

  describe("updateStatus", () => {
    type UpdateMock = jest.Mock<
      Promise<MockPrismaTrip>,
      [Prisma.TripUpdateArgs]
    >;

    function buildUpdateStatusHarness(): {
      repository: PrismaTripRepository;
      updateMock: UpdateMock;
    } {
      const updateMock = jest.fn<
        Promise<MockPrismaTrip>,
        [Prisma.TripUpdateArgs]
      >();
      const prismaStub = { trip: { update: updateMock } };
      const repository = new PrismaTripRepository(
        prismaStub as unknown as PrismaService,
      );
      return { repository, updateMock };
    }

    it("calls update with where: { id: tripId }", async () => {
      const { repository, updateMock } = buildUpdateStatusHarness();
      updateMock.mockResolvedValue(buildPrismaTrip({ status: "Archived" }));

      await repository.updateStatus("trip-1", "Archived");

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.where).toEqual({ id: "trip-1" });
    });

    it("transmits data: { status } exactly", async () => {
      const { repository, updateMock } = buildUpdateStatusHarness();
      updateMock.mockResolvedValue(buildPrismaTrip({ status: "Archived" }));

      await repository.updateStatus("trip-1", "Archived");

      const callArgs = updateMock.mock.calls[0]?.[0];
      if (!callArgs) {
        throw new Error("test setup failed: update was not called");
      }
      expect(callArgs.data).toEqual({ status: "Archived" });
    });

    it("includes all members ordered by createdAt ascending", async () => {
      const { repository, updateMock } = buildUpdateStatusHarness();
      updateMock.mockResolvedValue(buildPrismaTrip({ status: "Archived" }));

      await repository.updateStatus("trip-1", "Archived");

      const callArgs = updateMock.mock.calls[0]?.[0];
      expect(callArgs?.include).toEqual({
        members: { orderBy: { createdAt: "asc" } },
      });
    });

    it("maps the Prisma result into a Domain Trip", async () => {
      const { repository, updateMock } = buildUpdateStatusHarness();
      updateMock.mockResolvedValue(buildPrismaTrip({ status: "Archived" }));

      const result = await repository.updateStatus("trip-1", "Archived");

      expect(result.status).toBe("Archived");
      expect(result.members).toHaveLength(1);
    });

    it("translates a simulated P2025 into TripNotFoundError with the given tripId", async () => {
      const { repository, updateMock } = buildUpdateStatusHarness();
      const notFoundError = new Prisma.PrismaClientKnownRequestError(
        "An operation failed because it depends on one or more records that were required but not found.",
        { code: "P2025", clientVersion: "6.19.3" },
      );
      updateMock.mockRejectedValue(notFoundError);

      await expect(
        repository.updateStatus("unknown-trip", "Archived"),
      ).rejects.toThrow(new TripNotFoundError("unknown-trip"));
    });

    it("propagates a non-P2025 error unchanged", async () => {
      const { repository, updateMock } = buildUpdateStatusHarness();
      const otherError = new Error("connection lost");
      updateMock.mockRejectedValue(otherError);

      await expect(repository.updateStatus("trip-1", "Archived")).rejects.toBe(
        otherError,
      );
    });
  });
});
