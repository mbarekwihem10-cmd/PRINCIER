import { LeaveTripUseCase } from "../application/use-cases/leave-trip.use-case";
import { CannotRemoveLastOwnerError } from "../domain/cannot-remove-last-owner.error";
import { InvalidMemberStatusTransitionError } from "../domain/invalid-member-status-transition.error";
import type { CreateTripData } from "../domain/ports/trip.repository.port";
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

describe("LeaveTripUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: LeaveTripUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new LeaveTripUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("removes an Accepted Member from the trip, with joinedAt reset to null", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );

    await useCase.execute(created.id, "member-1");

    const trip = await repository.findById(created.id);
    const leftMember = trip?.members.find((m) => m.id === memberId);
    if (!leftMember) {
      throw new Error("test setup failed: member not found after leaving");
    }
    expect(leftMember.status).toBe("Removed");
    expect(leftMember.joinedAt).toBeNull();
  });

  it("calls repository.updateMemberStatus with the exact tripId, memberId, 'Removed', and null", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await useCase.execute(created.id, "member-1");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(created.id, memberId, "Removed", null);
  });

  it("resolves with undefined", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await addAcceptedMember(repository, created.id, "member-1");

    await expect(
      useCase.execute(created.id, "member-1"),
    ).resolves.toBeUndefined();
  });

  it("allows an Owner to leave when another Accepted Owner remains", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const secondOwnerMemberId = await addAcceptedMember(
      repository,
      created.id,
      "owner-2",
    );
    await repository.updateMemberRole(created.id, secondOwnerMemberId, "Owner");

    await useCase.execute(created.id, "owner-2");

    const trip = await repository.findById(created.id);
    const departedOwner = trip?.members.find((m) => m.userId === "owner-2");
    const remainingOwner = trip?.members.find((m) => m.userId === "owner-1");
    if (!departedOwner || !remainingOwner) {
      throw new Error("test setup failed: expected members not found");
    }
    expect(departedOwner.status).toBe("Removed");
    expect(remainingOwner.status).toBe("Accepted");
    expect(remainingOwner.role).toBe("Owner");
  });

  it("calls findById, trip.leave, and updateMemberStatus in order", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await addAcceptedMember(repository, created.id, "member-1");
    const trip = await repository.findById(created.id);

    if (!trip) {
      throw new Error("test setup failed: created trip not found");
    }

    const findByIdSpy = jest
      .spyOn(repository, "findById")
      .mockResolvedValue(trip);
    const leaveSpy = jest.spyOn(trip, "leave");
    const updateMemberStatusSpy = jest.spyOn(repository, "updateMemberStatus");

    await useCase.execute(created.id, "member-1");

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(leaveSpy).toHaveBeenCalledTimes(1);
    expect(updateMemberStatusSpy).toHaveBeenCalledTimes(1);

    const findByIdOrder = findByIdSpy.mock.invocationCallOrder[0];
    const leaveOrder = leaveSpy.mock.invocationCallOrder[0];
    const updateOrder = updateMemberStatusSpy.mock.invocationCallOrder[0];

    if (
      findByIdOrder === undefined ||
      leaveOrder === undefined ||
      updateOrder === undefined
    ) {
      throw new Error("test setup failed: expected calls were not recorded");
    }

    expect(findByIdOrder).toBeLessThan(leaveOrder);
    expect(leaveOrder).toBeLessThan(updateOrder);
  });

  it("throws TripNotFoundError for an unknown trip, and never calls repository.updateMemberStatus", async () => {
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute("unknown-trip", "member-1")).rejects.toThrow(
      TripNotFoundError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws TripNotFoundError for a caller with no membership row, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "stranger-1")).rejects.toThrow(
      TripNotFoundError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError when the caller is still Invited, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "member-1",
      invitedBy: "owner-1",
    });
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InvalidMemberStatusTransitionError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError when the caller is Declined, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "member-1",
      invitedBy: "owner-1",
    });
    const afterInvite = await repository.findById(created.id);
    const member = afterInvite?.members.find(
      (candidate) => candidate.userId === "member-1",
    );
    if (!member) {
      throw new Error("test setup failed: invited member not found");
    }
    await repository.updateMemberStatus(
      created.id,
      member.id,
      "Declined",
      null,
    );
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InvalidMemberStatusTransitionError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError when the caller is already Removed, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await addAcceptedMember(
      repository,
      created.id,
      "member-1",
    );
    await repository.updateMemberStatus(created.id, memberId, "Removed", null);
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InvalidMemberStatusTransitionError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws CannotRemoveLastOwnerError when the caller is the sole Accepted Owner, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "owner-1")).rejects.toThrow(
      CannotRemoveLastOwnerError,
    );

    expect(spy).not.toHaveBeenCalled();
  });
});
