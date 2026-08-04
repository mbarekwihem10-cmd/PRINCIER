import type { TripMemberStatus } from "@tripplanner/shared-types";

import { TripMember } from "../../domain/entities/trip-member.entity";
import type { Trip } from "../../domain/entities/trip.entity";
import type { CreateTripData } from "../../domain/ports/trip.repository.port";
import { TripMemberNotFoundError } from "../../domain/trip-member-not-found.error";
import { TripNotFoundError } from "../../domain/trip-not-found.error";
import { TripDateRange } from "../../domain/value-objects/trip-date-range.value-object";

import { InMemoryTripRepository } from "./in-memory-trip.repository";

function buildCreateTripData(
  overrides: Partial<CreateTripData> = {},
): CreateTripData {
  return {
    name: "Summer trip",
    description: null,
    destination: "Lisbon",
    dateRange: TripDateRange.create(null, null),
    baseCurrency: "EUR",
    createdBy: "owner-1",
    ...overrides,
  };
}

describe("InMemoryTripRepository", () => {
  let repository: InMemoryTripRepository;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
    repository = new InMemoryTripRepository();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createWithOwner", () => {
    it("creates a trip with a single Accepted Owner and correct default fields", async () => {
      const trip = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );

      expect(trip.status).toBe("Planning");
      expect(trip.deletedAt).toBeNull();
      expect(trip.createdBy).toBe("owner-1");
      expect(trip.members).toHaveLength(1);

      const [owner] = trip.members;
      if (!owner) {
        throw new Error("expected the created trip to have an owner");
      }
      expect(owner.role).toBe("Owner");
      expect(owner.status).toBe("Accepted");
      expect(owner.userId).toBe("owner-1");
      expect(owner.invitedBy).toBeNull();
      expect(owner.joinedAt).toEqual(new Date("2026-03-01T10:00:00.000Z"));
    });

    it("returns a trip that already includes the initial member", async () => {
      const trip = await repository.createWithOwner(buildCreateTripData());

      expect(trip.members).toHaveLength(1);
      const [owner] = trip.members;
      expect(owner?.role).toBe("Owner");
    });
  });

  describe("findById", () => {
    it("returns a full trip with its members", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.members).toHaveLength(1);
    });

    it("returns null for an unknown id", async () => {
      expect(await repository.findById("unknown-trip")).toBeNull();
    });

    it("also returns a soft-deleted trip", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      await repository.softDelete(created.id);

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("findManyForUser", () => {
    const userId = "user-1";
    let tripA: Trip;
    let tripB: Trip;
    let tripC: Trip;
    let tripD: Trip;
    let tripE: Trip;

    async function memberIdFor(
      tripId: string,
      targetUserId: string,
    ): Promise<string> {
      const trip = await repository.findById(tripId);
      const member = trip?.members.find((m) => m.userId === targetUserId);
      if (!member) {
        throw new Error("member not found in test setup");
      }
      return member.id;
    }

    async function setStatusFor(
      tripId: string,
      targetUserId: string,
      status: TripMemberStatus,
    ): Promise<void> {
      const memberId = await memberIdFor(tripId, targetUserId);
      const joinedAt = status === "Accepted" ? new Date() : null;
      await repository.updateMemberStatus(tripId, memberId, status, joinedAt);
    }

    beforeEach(async () => {
      tripA = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-a" }),
      );
      await repository.upsertMember(tripA.id, {
        userId,
        invitedBy: "owner-a",
      });

      tripB = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-b" }),
      );
      await repository.upsertMember(tripB.id, {
        userId,
        invitedBy: "owner-b",
      });
      await setStatusFor(tripB.id, userId, "Accepted");

      tripC = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-c" }),
      );
      await repository.upsertMember(tripC.id, {
        userId,
        invitedBy: "owner-c",
      });
      await setStatusFor(tripC.id, userId, "Declined");

      tripD = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-d" }),
      );
      await repository.upsertMember(tripD.id, {
        userId,
        invitedBy: "owner-d",
      });
      await setStatusFor(tripD.id, userId, "Removed");

      tripE = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-e" }),
      );
      await repository.upsertMember(tripE.id, {
        userId,
        invitedBy: "owner-e",
      });
      await setStatusFor(tripE.id, userId, "Accepted");
      await repository.softDelete(tripE.id);
    });

    it("includes trips where the user is Invited", async () => {
      const trips = await repository.findManyForUser(userId);
      expect(trips.map((t) => t.id)).toEqual(
        expect.arrayContaining([tripA.id]),
      );
    });

    it("includes trips where the user is Accepted", async () => {
      const trips = await repository.findManyForUser(userId);
      expect(trips.map((t) => t.id)).toEqual(
        expect.arrayContaining([tripB.id]),
      );
    });

    it("excludes trips where the user is Declined", async () => {
      const trips = await repository.findManyForUser(userId);
      expect(trips.map((t) => t.id)).not.toContain(tripC.id);
    });

    it("excludes trips where the user is Removed", async () => {
      const trips = await repository.findManyForUser(userId);
      expect(trips.map((t) => t.id)).not.toContain(tripD.id);
    });

    it("excludes soft-deleted trips", async () => {
      const trips = await repository.findManyForUser(userId);
      expect(trips.map((t) => t.id)).not.toContain(tripE.id);
    });

    it("with memberStatus 'Invited' returns only Invited trips", async () => {
      const trips = await repository.findManyForUser(userId, {
        memberStatus: "Invited",
      });
      const ids = trips.map((t) => t.id);
      expect(ids).toEqual(expect.arrayContaining([tripA.id]));
      expect(ids).not.toContain(tripB.id);
    });

    it("with memberStatus 'Accepted' returns only Accepted trips", async () => {
      const trips = await repository.findManyForUser(userId, {
        memberStatus: "Accepted",
      });
      const ids = trips.map((t) => t.id);
      expect(ids).toEqual(expect.arrayContaining([tripB.id]));
      expect(ids).not.toContain(tripA.id);
    });
  });

  describe("updateDetails / updateStatus / softDelete", () => {
    it("persists name, description, destination and baseCurrency", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({
          name: "Old name",
          description: "Old desc",
          destination: "Porto",
          baseCurrency: "EUR",
        }),
      );

      const updated = await repository.updateDetails(created.id, {
        name: "New name",
        description: "New desc",
        destination: "Lisbon",
        baseCurrency: "USD",
      });

      expect(updated.name).toBe("New name");
      expect(updated.description).toBe("New desc");
      expect(updated.destination).toBe("Lisbon");
      expect(updated.baseCurrency).toBe("USD");
    });

    it("persists the TripDateRange", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      const dateRange = TripDateRange.create(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-10T00:00:00.000Z"),
      );

      const updated = await repository.updateDetails(created.id, {
        dateRange,
      });

      expect(updated.dateRange.startDate).toEqual(
        new Date("2026-06-01T00:00:00.000Z"),
      );
      expect(updated.dateRange.endDate).toEqual(
        new Date("2026-06-10T00:00:00.000Z"),
      );
    });

    it("updateDetails refreshes updatedAt", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

      const updated = await repository.updateDetails(created.id, {
        name: "New",
      });

      expect(updated.updatedAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
    });

    it("updateDetails on an unknown trip throws TripNotFoundError", async () => {
      await expect(
        repository.updateDetails("unknown-trip", { name: "x" }),
      ).rejects.toThrow(TripNotFoundError);
    });

    it("updateStatus persists the status and refreshes updatedAt", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

      const updated = await repository.updateStatus(created.id, "Archived");

      expect(updated.status).toBe("Archived");
      expect(updated.updatedAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
    });

    it("updateStatus on an unknown trip throws TripNotFoundError", async () => {
      await expect(
        repository.updateStatus("unknown-trip", "Archived"),
      ).rejects.toThrow(TripNotFoundError);
    });

    it("softDelete sets deletedAt on the first call", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());

      await repository.softDelete(created.id);

      const found = await repository.findById(created.id);
      expect(found?.deletedAt).toEqual(new Date("2026-03-01T10:00:00.000Z"));
    });

    it("softDelete keeps the original deletedAt on a second call", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      await repository.softDelete(created.id);

      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
      await repository.softDelete(created.id);

      const found = await repository.findById(created.id);
      expect(found?.deletedAt).toEqual(new Date("2026-03-01T10:00:00.000Z"));
    });

    it("softDelete keeps the original updatedAt on a second call", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      await repository.softDelete(created.id);
      const afterFirst = await repository.findById(created.id);
      const updatedAtAfterFirst = afterFirst?.updatedAt;

      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
      await repository.softDelete(created.id);

      const afterSecond = await repository.findById(created.id);
      expect(afterSecond?.updatedAt).toEqual(updatedAtAfterFirst);
    });

    it("softDelete refreshes updatedAt on the first call", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());
      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

      await repository.softDelete(created.id);

      const found = await repository.findById(created.id);
      expect(found?.updatedAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
    });

    it("softDelete on an unknown trip is a no-op", async () => {
      await expect(
        repository.softDelete("unknown-trip"),
      ).resolves.toBeUndefined();
    });
  });

  describe("upsertMember", () => {
    it("creates a new member with the default Member role", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );

      const updated = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });

      const member = updated.members.find((m) => m.userId === "invitee-1");
      expect(member?.role).toBe("Member");
      expect(member?.status).toBe("Invited");
      expect(member?.joinedAt).toBeNull();
      expect(member?.invitedBy).toBe("owner-1");
    });

    it("re-invites a Declined member: Invited, joinedAt null, new invitedBy, role preserved", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;
      await repository.updateMemberRole(created.id, memberId, "Editor");
      await repository.updateMemberStatus(
        created.id,
        memberId,
        "Declined",
        null,
      );

      const updated = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-2",
      });

      const reinvited = updated.members.find((m) => m.userId === "invitee-1");
      expect(reinvited?.status).toBe("Invited");
      expect(reinvited?.joinedAt).toBeNull();
      expect(reinvited?.invitedBy).toBe("owner-2");
      expect(reinvited?.role).toBe("Editor");
    });

    it("re-invites a Removed member: Invited, joinedAt null, new invitedBy, role preserved", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;
      await repository.updateMemberRole(created.id, memberId, "Editor");
      await repository.updateMemberStatus(
        created.id,
        memberId,
        "Removed",
        null,
      );

      const updated = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-2",
      });

      const reinvited = updated.members.find((m) => m.userId === "invitee-1");
      expect(reinvited?.status).toBe("Invited");
      expect(reinvited?.joinedAt).toBeNull();
      expect(reinvited?.invitedBy).toBe("owner-2");
      expect(reinvited?.role).toBe("Editor");
    });

    it("preserves a historical role distinct from Member on reinvitation", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;
      await repository.updateMemberRole(created.id, memberId, "Editor");
      await repository.updateMemberStatus(
        created.id,
        memberId,
        "Removed",
        null,
      );

      const reinvited = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });

      const member = reinvited.members.find((m) => m.userId === "invitee-1");
      expect(member?.role).not.toBe("Member");
      expect(member?.role).toBe("Editor");
    });

    it("creates a new member with the explicit role from data.role", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );

      const updated = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
        role: "Editor",
      });

      const member = updated.members.find((m) => m.userId === "invitee-1");
      expect(member?.role).toBe("Editor");
    });

    it("reinvitation with an explicit role replaces the previous role", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const member = afterInvite?.members.find(
        (candidate) => candidate.userId === "invitee-1",
      );

      if (!member) {
        throw new Error("test setup failed: invited member not found");
      }

      const memberId = member.id;
      await repository.updateMemberRole(created.id, memberId, "Editor");
      await repository.updateMemberStatus(
        created.id,
        memberId,
        "Removed",
        null,
      );

      const reinvited = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-2",
        role: "Member",
      });

      const reinvitedMember = reinvited.members.find(
        (candidate) => candidate.userId === "invitee-1",
      );
      expect(reinvitedMember?.role).toBe("Member");
    });

    it("reinvitation with an explicit role still resets status, joinedAt, and invitedBy", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const member = afterInvite?.members.find(
        (candidate) => candidate.userId === "invitee-1",
      );

      if (!member) {
        throw new Error("test setup failed: invited member not found");
      }

      const memberId = member.id;
      await repository.updateMemberRole(created.id, memberId, "Editor");
      await repository.updateMemberStatus(
        created.id,
        memberId,
        "Accepted",
        new Date("2026-01-15T00:00:00.000Z"),
      );

      const reinvited = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-2",
        role: "Member",
      });

      const reinvitedMember = reinvited.members.find(
        (candidate) => candidate.userId === "invitee-1",
      );
      expect(reinvitedMember?.role).toBe("Member");
      expect(reinvitedMember?.status).toBe("Invited");
      expect(reinvitedMember?.joinedAt).toBeNull();
      expect(reinvitedMember?.invitedBy).toBe("owner-2");
    });

    it("does not create a duplicate after several successive upserts", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );

      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const updated = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });

      const matches = updated.members.filter((m) => m.userId === "invitee-1");
      expect(matches).toHaveLength(1);
    });

    it("does not modify Trip.updatedAt", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      const before = created.updatedAt;
      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

      const updated = await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });

      expect(updated.updatedAt).toEqual(before);
    });

    it("on an unknown trip throws TripNotFoundError", async () => {
      await expect(
        repository.upsertMember("unknown-trip", {
          userId: "invitee-1",
          invitedBy: "owner-1",
        }),
      ).rejects.toThrow(TripNotFoundError);
    });
  });

  describe("updateMemberStatus", () => {
    it("persists the new status and joinedAt", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;
      const joinedAt = new Date("2026-05-01T00:00:00.000Z");

      const updated = await repository.updateMemberStatus(
        created.id,
        memberId,
        "Accepted",
        joinedAt,
      );

      const member = updated.members.find((m) => m.id === memberId);
      expect(member?.status).toBe("Accepted");
      expect(member?.joinedAt).toEqual(joinedAt);
    });

    it("does not modify Trip.updatedAt", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;
      const before = afterInvite?.updatedAt;
      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

      const updated = await repository.updateMemberStatus(
        created.id,
        memberId,
        "Accepted",
        new Date(),
      );

      expect(updated.updatedAt).toEqual(before);
    });

    it("with a nonexistent memberId throws TripMemberNotFoundError", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());

      await expect(
        repository.updateMemberStatus(
          created.id,
          "never-existed",
          "Accepted",
          null,
        ),
      ).rejects.toThrow(TripMemberNotFoundError);
    });

    it("with a member belonging to another trip throws and modifies nothing", async () => {
      const tripX = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-x" }),
      );
      const tripY = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-y" }),
      );
      await repository.upsertMember(tripY.id, {
        userId: "invitee-y",
        invitedBy: "owner-y",
      });
      const tripYWithMember = await repository.findById(tripY.id);
      const memberYId = tripYWithMember?.members.find(
        (m) => m.userId === "invitee-y",
      )?.id as string;

      await expect(
        repository.updateMemberStatus(
          tripX.id,
          memberYId,
          "Accepted",
          new Date(),
        ),
      ).rejects.toThrow(TripMemberNotFoundError);

      const tripYAfter = await repository.findById(tripY.id);
      const memberYAfter = tripYAfter?.members.find((m) => m.id === memberYId);
      expect(memberYAfter?.status).toBe("Invited");
      expect(memberYAfter?.joinedAt).toBeNull();
    });
  });

  describe("updateMemberRole", () => {
    it("persists the new role", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;

      const updated = await repository.updateMemberRole(
        created.id,
        memberId,
        "Editor",
      );

      expect(updated.members.find((m) => m.id === memberId)?.role).toBe(
        "Editor",
      );
    });

    it("does not modify Trip.updatedAt", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;
      const before = afterInvite?.updatedAt;
      jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

      const updated = await repository.updateMemberRole(
        created.id,
        memberId,
        "Editor",
      );

      expect(updated.updatedAt).toEqual(before);
    });

    it("with a nonexistent memberId throws TripMemberNotFoundError", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());

      await expect(
        repository.updateMemberRole(created.id, "never-existed", "Editor"),
      ).rejects.toThrow(TripMemberNotFoundError);
    });

    it("with a member belonging to another trip throws and modifies nothing", async () => {
      const tripX = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-x" }),
      );
      const tripY = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-y" }),
      );
      await repository.upsertMember(tripY.id, {
        userId: "invitee-y",
        invitedBy: "owner-y",
      });
      const tripYWithMember = await repository.findById(tripY.id);
      const memberYId = tripYWithMember?.members.find(
        (m) => m.userId === "invitee-y",
      )?.id as string;

      await expect(
        repository.updateMemberRole(tripX.id, memberYId, "Editor"),
      ).rejects.toThrow(TripMemberNotFoundError);

      const tripYAfter = await repository.findById(tripY.id);
      const memberYAfter = tripYAfter?.members.find((m) => m.id === memberYId);
      expect(memberYAfter?.role).toBe("Member");
    });
  });

  describe("defensive copies and isolation", () => {
    it("mutating the source dates used to build a TripDateRange does not affect stored dates", async () => {
      const start = new Date("2026-06-01T00:00:00.000Z");
      const end = new Date("2026-06-10T00:00:00.000Z");
      const dateRange = TripDateRange.create(start, end);
      const created = await repository.createWithOwner(
        buildCreateTripData({ dateRange }),
      );

      start.setFullYear(1999);
      end.setFullYear(1999);

      const found = await repository.findById(created.id);
      expect(found?.dateRange.startDate).toEqual(
        new Date("2026-06-01T00:00:00.000Z"),
      );
      expect(found?.dateRange.endDate).toEqual(
        new Date("2026-06-10T00:00:00.000Z"),
      );
    });

    it("mutating the joinedAt Date given to updateMemberStatus after the call does not affect storage", async () => {
      const created = await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );
      await repository.upsertMember(created.id, {
        userId: "invitee-1",
        invitedBy: "owner-1",
      });
      const afterInvite = await repository.findById(created.id);
      const memberId = afterInvite?.members.find(
        (m) => m.userId === "invitee-1",
      )?.id as string;

      const joinedAt = new Date("2026-05-01T00:00:00.000Z");
      await repository.updateMemberStatus(
        created.id,
        memberId,
        "Accepted",
        joinedAt,
      );
      joinedAt.setFullYear(1999);

      const found = await repository.findById(created.id);
      const member = found?.members.find((m) => m.id === memberId);
      expect(member?.joinedAt).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    });

    it("mutating a Trip returned by a read then re-reading does not affect storage", async () => {
      const created = await repository.createWithOwner(buildCreateTripData());

      const first = await repository.findById(created.id);
      (first?.members as TripMember[]).push(
        TripMember.fromPersistence({
          id: "intruder",
          tripId: created.id,
          userId: "intruder",
          role: "Member",
          status: "Accepted",
          invitedBy: null,
          joinedAt: null,
          createdAt: new Date(),
        }),
      );

      const second = await repository.findById(created.id);
      expect(second?.members).toHaveLength(1);
    });

    it("two fake instances do not share any state", async () => {
      const other = new InMemoryTripRepository();
      await repository.createWithOwner(
        buildCreateTripData({ createdBy: "owner-1" }),
      );

      const tripsInOther = await other.findManyForUser("owner-1");
      expect(tripsInOther).toHaveLength(0);
    });
  });
});
