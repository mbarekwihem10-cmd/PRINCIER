import { RemoveTripMemberUseCase } from "../application/use-cases/remove-trip-member.use-case";
import { CannotRemoveSelfError } from "../domain/cannot-remove-self.error";
import { TripMember } from "../domain/entities/trip-member.entity";
import { Trip } from "../domain/entities/trip.entity";
import { InsufficientTripRoleError } from "../domain/insufficient-trip-role.error";
import type { CreateTripData } from "../domain/ports/trip.repository.port";
import { TripMemberNotFoundError } from "../domain/trip-member-not-found.error";
import { TripNotFoundError } from "../domain/trip-not-found.error";
import { TripDateRange } from "../domain/value-objects/trip-date-range.value-object";

import { InMemoryTripRepository } from "./fakes/in-memory-trip.repository";

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

async function inviteMember(
  repository: InMemoryTripRepository,
  tripId: string,
  userId: string,
): Promise<string> {
  await repository.upsertMember(tripId, { userId, invitedBy: "owner-1" });
  const trip = await repository.findById(tripId);
  const member = trip?.members.find((m) => m.userId === userId);
  if (!member) {
    throw new Error("test setup failed: invited member not found");
  }
  return member.id;
}

describe("RemoveTripMemberUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: RemoveTripMemberUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new RemoveTripMemberUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("removes another member, transitioning them to Removed", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");

    const details = await useCase.execute(created.id, "owner-1", memberId);

    const removedMember = details.members.find((m) => m.id === memberId);
    if (!removedMember) {
      throw new Error(
        "test setup failed: removed member not found in response",
      );
    }
    expect(removedMember.status).toBe("Removed");
    expect(removedMember.joinedAt).toBeNull();
  });

  it("calls repository.updateMemberStatus with the exact tripId, memberId, 'Removed', and null", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await useCase.execute(created.id, "owner-1", memberId);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(created.id, memberId, "Removed", null);
  });

  it("returns TripDetails built from the entity resolved by repository.updateMemberStatus, not the local trip", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");

    const distinctTrip = Trip.fromPersistence({
      id: created.id,
      name: "Repository-sourced trip",
      description: null,
      destination: "Lisbon",
      dateRange: TripDateRange.create(null, null),
      baseCurrency: "EUR",
      status: "Planning",
      createdBy: "owner-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
      members: [
        TripMember.fromPersistence({
          id: "tm-owner",
          tripId: created.id,
          userId: "owner-1",
          role: "Owner",
          status: "Accepted",
          invitedBy: null,
          joinedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        TripMember.fromPersistence({
          id: memberId,
          tripId: created.id,
          userId: "member-1",
          role: "Member",
          status: "Removed",
          invitedBy: "owner-1",
          joinedAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
    });
    jest
      .spyOn(repository, "updateMemberStatus")
      .mockResolvedValueOnce(distinctTrip);

    const details = await useCase.execute(created.id, "owner-1", memberId);

    expect(details).toEqual(distinctTrip.toDetails("owner-1"));
  });

  it("throws TripNotFoundError for an unknown trip, and never calls repository.updateMemberStatus", async () => {
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(
      useCase.execute("unknown-trip", "owner-1", "some-member-id"),
    ).rejects.toThrow(TripNotFoundError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InsufficientTripRoleError for a non-Owner caller, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    const editorMemberId = await inviteMember(
      repository,
      created.id,
      "editor-1",
    );
    await repository.updateMemberRole(created.id, editorMemberId, "Editor");
    await repository.updateMemberStatus(
      created.id,
      editorMemberId,
      "Accepted",
      new Date("2026-01-15T00:00:00.000Z"),
    );
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(
      useCase.execute(created.id, "editor-1", memberId),
    ).rejects.toThrow(InsufficientTripRoleError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws TripMemberNotFoundError for an unknown memberId, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(
      useCase.execute(created.id, "owner-1", "unknown-member-id"),
    ).rejects.toThrow(TripMemberNotFoundError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws CannotRemoveSelfError when memberId targets the caller's own row, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const afterCreate = await repository.findById(created.id);
    const ownerMember = afterCreate?.members.find(
      (candidate) => candidate.userId === "owner-1",
    );
    if (!ownerMember) {
      throw new Error("test setup failed: owner member not found");
    }
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(
      useCase.execute(created.id, "owner-1", ownerMember.id),
    ).rejects.toThrow(CannotRemoveSelfError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("is idempotent when the target is already Removed, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    await repository.updateMemberStatus(created.id, memberId, "Removed", null);
    const spy = jest.spyOn(repository, "updateMemberStatus");

    const details = await useCase.execute(created.id, "owner-1", memberId);

    const member = details.members.find((m) => m.id === memberId);
    expect(member?.status).toBe("Removed");
    expect(spy).not.toHaveBeenCalled();
  });

  it("calls findById, removeMember, and updateMemberStatus in order", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    const trip = await repository.findById(created.id);

    if (!trip) {
      throw new Error("test setup failed: created trip not found");
    }

    const findByIdSpy = jest
      .spyOn(repository, "findById")
      .mockResolvedValue(trip);
    const removeMemberSpy = jest.spyOn(trip, "removeMember");
    const updateMemberStatusSpy = jest.spyOn(repository, "updateMemberStatus");

    await useCase.execute(created.id, "owner-1", memberId);

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(removeMemberSpy).toHaveBeenCalledTimes(1);
    expect(updateMemberStatusSpy).toHaveBeenCalledTimes(1);

    const findByIdOrder = findByIdSpy.mock.invocationCallOrder[0];
    const removeOrder = removeMemberSpy.mock.invocationCallOrder[0];
    const updateOrder = updateMemberStatusSpy.mock.invocationCallOrder[0];

    if (
      findByIdOrder === undefined ||
      removeOrder === undefined ||
      updateOrder === undefined
    ) {
      throw new Error("test setup failed: expected calls were not recorded");
    }

    expect(findByIdOrder).toBeLessThan(removeOrder);
    expect(removeOrder).toBeLessThan(updateOrder);
  });
});
