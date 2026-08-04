import { ChangeTripMemberRoleUseCase } from "../application/use-cases/change-trip-member-role.use-case";
import { CannotRemoveLastOwnerError } from "../domain/cannot-remove-last-owner.error";
import { TripMember } from "../domain/entities/trip-member.entity";
import { Trip } from "../domain/entities/trip.entity";
import { InsufficientTripRoleError } from "../domain/insufficient-trip-role.error";
import { InvalidMemberStatusTransitionError } from "../domain/invalid-member-status-transition.error";
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

async function addAcceptedMember(
  repository: InMemoryTripRepository,
  tripId: string,
  userId: string,
): Promise<string> {
  await repository.upsertMember(tripId, { userId, invitedBy: "owner-1" });
  const afterInvite = await repository.findById(tripId);
  const member = afterInvite?.members.find(
    (candidate) => candidate.userId === userId,
  );
  if (!member) {
    throw new Error("test setup failed: invited member not found");
  }
  await repository.updateMemberStatus(
    tripId,
    member.id,
    "Accepted",
    new Date("2026-01-15T00:00:00.000Z"),
  );
  return member.id;
}

describe("ChangeTripMemberRoleUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: ChangeTripMemberRoleUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new ChangeTripMemberRoleUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("changes the role of an Accepted member from Member to Editor", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );

    const details = await useCase.execute(
      created.id,
      "owner-1",
      memberId,
      "Editor",
    );

    const changedMember = details.members.find((m) => m.id === memberId);
    if (!changedMember) {
      throw new Error(
        "test setup failed: changed member not found in response",
      );
    }
    expect(changedMember.role).toBe("Editor");
  });

  it("calls repository.updateMemberRole with the exact tripId, memberId, and newRole", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    const spy = jest.spyOn(repository, "updateMemberRole");

    await useCase.execute(created.id, "owner-1", memberId, "Editor");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(created.id, memberId, "Editor");
  });

  it("returns TripDetails built from the entity resolved by repository.updateMemberRole, not the local trip", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );

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
          role: "Editor",
          status: "Accepted",
          invitedBy: "owner-1",
          joinedAt: new Date("2026-01-15T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
    });
    jest
      .spyOn(repository, "updateMemberRole")
      .mockResolvedValueOnce(distinctTrip);

    const details = await useCase.execute(
      created.id,
      "owner-1",
      memberId,
      "Editor",
    );

    expect(details).toEqual(distinctTrip.toDetails("owner-1"));
  });

  it("returns TripDetails from the local entity and never calls updateMemberRole when the requested role is already assigned", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    const trip = await repository.findById(created.id);

    if (!trip) {
      throw new Error("test setup failed: created trip not found");
    }

    const findByIdSpy = jest
      .spyOn(repository, "findById")
      .mockResolvedValue(trip);
    const updateMemberRoleSpy = jest.spyOn(repository, "updateMemberRole");

    const details = await useCase.execute(
      created.id,
      "owner-1",
      memberId,
      "Member",
    );

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(updateMemberRoleSpy).not.toHaveBeenCalled();
    expect(details).toEqual(trip.toDetails("owner-1"));
  });

  it("calls findById, changeMemberRole, and updateMemberRole in order", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    const trip = await repository.findById(created.id);

    if (!trip) {
      throw new Error("test setup failed: created trip not found");
    }

    const findByIdSpy = jest
      .spyOn(repository, "findById")
      .mockResolvedValue(trip);
    const changeMemberRoleSpy = jest.spyOn(trip, "changeMemberRole");
    const updateMemberRoleSpy = jest.spyOn(repository, "updateMemberRole");

    await useCase.execute(created.id, "owner-1", memberId, "Editor");

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(changeMemberRoleSpy).toHaveBeenCalledTimes(1);
    expect(updateMemberRoleSpy).toHaveBeenCalledTimes(1);

    const findByIdOrder = findByIdSpy.mock.invocationCallOrder[0];
    const changeOrder = changeMemberRoleSpy.mock.invocationCallOrder[0];
    const updateOrder = updateMemberRoleSpy.mock.invocationCallOrder[0];

    if (
      findByIdOrder === undefined ||
      changeOrder === undefined ||
      updateOrder === undefined
    ) {
      throw new Error("test setup failed: expected calls were not recorded");
    }

    expect(findByIdOrder).toBeLessThan(changeOrder);
    expect(changeOrder).toBeLessThan(updateOrder);
  });

  it("throws TripNotFoundError for an unknown trip, and never calls repository.updateMemberRole", async () => {
    const spy = jest.spyOn(repository, "updateMemberRole");

    await expect(
      useCase.execute("unknown-trip", "owner-1", "some-member-id", "Editor"),
    ).rejects.toThrow(TripNotFoundError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InsufficientTripRoleError for a non-Owner caller, and never calls repository.updateMemberRole", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    const editorMemberId = await addAcceptedMember(
      repository,
      created.id,
      "editor-1",
    );
    await repository.updateMemberRole(created.id, editorMemberId, "Editor");
    const spy = jest.spyOn(repository, "updateMemberRole");

    await expect(
      useCase.execute(created.id, "editor-1", memberId, "Editor"),
    ).rejects.toThrow(InsufficientTripRoleError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws TripMemberNotFoundError for an unknown memberId, and never calls repository.updateMemberRole", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const spy = jest.spyOn(repository, "updateMemberRole");

    await expect(
      useCase.execute(created.id, "owner-1", "unknown-member-id", "Editor"),
    ).rejects.toThrow(TripMemberNotFoundError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError when the target is Declined, and never calls repository.updateMemberRole", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    await repository.updateMemberStatus(created.id, memberId, "Declined", null);
    const spy = jest.spyOn(repository, "updateMemberRole");

    await expect(
      useCase.execute(created.id, "owner-1", memberId, "Editor"),
    ).rejects.toThrow(InvalidMemberStatusTransitionError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError when the target is Removed, and never calls repository.updateMemberRole", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    await repository.updateMemberStatus(created.id, memberId, "Removed", null);
    const spy = jest.spyOn(repository, "updateMemberRole");

    await expect(
      useCase.execute(created.id, "owner-1", memberId, "Editor"),
    ).rejects.toThrow(InvalidMemberStatusTransitionError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws CannotRemoveLastOwnerError when the sole Accepted Owner demotes themselves, and never calls repository.updateMemberRole", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const afterCreate = await repository.findById(created.id);
    const ownerMember = afterCreate?.members.find(
      (candidate) => candidate.userId === "owner-1",
    );
    if (!ownerMember) {
      throw new Error("test setup failed: owner member not found");
    }
    const spy = jest.spyOn(repository, "updateMemberRole");

    await expect(
      useCase.execute(created.id, "owner-1", ownerMember.id, "Editor"),
    ).rejects.toThrow(CannotRemoveLastOwnerError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("allows the second Owner to demote themselves to Editor when another Accepted Owner remains", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const secondOwnerMemberId = await addAcceptedMember(
      repository,
      created.id,
      "owner-2",
    );
    await repository.updateMemberRole(created.id, secondOwnerMemberId, "Owner");
    const spy = jest.spyOn(repository, "updateMemberRole");

    const details = await useCase.execute(
      created.id,
      "owner-2",
      secondOwnerMemberId,
      "Editor",
    );

    const demotedOwner = details.members.find(
      (m) => m.id === secondOwnerMemberId,
    );
    const remainingOwner = details.members.find((m) => m.userId === "owner-1");
    if (!demotedOwner || !remainingOwner) {
      throw new Error("test setup failed: expected members not found");
    }
    expect(demotedOwner.role).toBe("Editor");
    expect(demotedOwner.status).toBe("Accepted");
    expect(remainingOwner.role).toBe("Owner");
    expect(remainingOwner.status).toBe("Accepted");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(created.id, secondOwnerMemberId, "Editor");
  });

  it("promotes an Accepted Member to Owner", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    const spy = jest.spyOn(repository, "updateMemberRole");

    const details = await useCase.execute(
      created.id,
      "owner-1",
      memberId,
      "Owner",
    );

    const promotedMember = details.members.find((m) => m.id === memberId);
    if (!promotedMember) {
      throw new Error("test setup failed: promoted member not found");
    }
    expect(promotedMember.role).toBe("Owner");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(created.id, memberId, "Owner");
  });
});
