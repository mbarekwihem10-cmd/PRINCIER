import { DeleteTripUseCase } from "../application/use-cases/delete-trip.use-case";
import { InsufficientTripRoleError } from "../domain/insufficient-trip-role.error";
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

describe("DeleteTripUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: DeleteTripUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new DeleteTripUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes the trip for the Owner", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());

    await expect(
      useCase.execute(created.id, "owner-1"),
    ).resolves.toBeUndefined();

    const found = await repository.findById(created.id);
    expect(found?.isDeleted).toBe(true);
  });

  it("calls repository.softDelete with the exact tripId", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const softDeleteSpy = jest.spyOn(repository, "softDelete");

    await useCase.execute(created.id, "owner-1");

    expect(softDeleteSpy).toHaveBeenCalledTimes(1);
    expect(softDeleteSpy).toHaveBeenCalledWith(created.id);
  });

  it("throws TripNotFoundError for an unknown trip", async () => {
    await expect(useCase.execute("unknown-trip", "owner-1")).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it("throws InsufficientTripRoleError for a non-Owner, and never calls repository.softDelete", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "member-1",
      invitedBy: "owner-1",
    });
    const afterInvite = await repository.findById(created.id);
    const memberId = afterInvite?.members.find((m) => m.userId === "member-1")
      ?.id as string;
    await repository.updateMemberStatus(
      created.id,
      memberId,
      "Accepted",
      new Date(),
    );
    const softDeleteSpy = jest.spyOn(repository, "softDelete");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InsufficientTripRoleError,
    );

    expect(softDeleteSpy).not.toHaveBeenCalled();

    const found = await repository.findById(created.id);
    expect(found?.isDeleted).toBe(false);
  });

  it("a second deletion by the Owner succeeds idempotently, without a second write", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await useCase.execute(created.id, "owner-1");
    const beforeSecondCall = await repository.findById(created.id);
    const deletedAtAfterFirst = beforeSecondCall?.deletedAt;
    const softDeleteSpy = jest.spyOn(repository, "softDelete");

    await expect(
      useCase.execute(created.id, "owner-1"),
    ).resolves.toBeUndefined();

    expect(softDeleteSpy).not.toHaveBeenCalled();
    const found = await repository.findById(created.id);
    expect(found?.deletedAt).toEqual(deletedAtAfterFirst);
  });

  it("a non-Owner on an already-deleted trip is still refused, and repository.softDelete is never called", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "member-1",
      invitedBy: "owner-1",
    });
    const afterInvite = await repository.findById(created.id);
    const memberId = afterInvite?.members.find((m) => m.userId === "member-1")
      ?.id as string;
    await repository.updateMemberStatus(
      created.id,
      memberId,
      "Accepted",
      new Date(),
    );
    await repository.softDelete(created.id);
    const softDeleteSpy = jest.spyOn(repository, "softDelete");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InsufficientTripRoleError,
    );

    expect(softDeleteSpy).not.toHaveBeenCalled();
  });
});
