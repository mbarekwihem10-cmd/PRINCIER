import { ArchiveTripUseCase } from "../application/use-cases/archive-trip.use-case";
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

describe("ArchiveTripUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: ArchiveTripUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
    repository = new InMemoryTripRepository();
    useCase = new ArchiveTripUseCase(repository);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("archives the trip for the Owner", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());

    const archived = await useCase.execute(created.id, "owner-1");

    expect(archived.status).toBe("Archived");
  });

  it("calls repository.updateStatus with the exact tripId and 'Archived'", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const updateStatusSpy = jest.spyOn(repository, "updateStatus");

    await useCase.execute(created.id, "owner-1");

    expect(updateStatusSpy).toHaveBeenCalledTimes(1);
    expect(updateStatusSpy).toHaveBeenCalledWith(created.id, "Archived");
  });

  it("returns the details from the repository-returned trip, with a refreshed updatedAt", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    const archived = await useCase.execute(created.id, "owner-1");

    expect(archived.updatedAt).toBe(
      new Date("2026-04-01T00:00:00.000Z").toISOString(),
    );
  });

  it("throws TripNotFoundError for an unknown trip", async () => {
    await expect(useCase.execute("unknown-trip", "owner-1")).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it("throws InsufficientTripRoleError for a non-Owner, and never calls repository.updateStatus", async () => {
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
    const updateStatusSpy = jest.spyOn(repository, "updateStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InsufficientTripRoleError,
    );

    expect(updateStatusSpy).not.toHaveBeenCalled();
  });

  it("a second archive by the Owner succeeds idempotently, without a second write, and updatedAt unchanged", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const first = await useCase.execute(created.id, "owner-1");
    const updateStatusSpy = jest.spyOn(repository, "updateStatus");
    jest.setSystemTime(new Date("2026-05-01T00:00:00.000Z"));

    const second = await useCase.execute(created.id, "owner-1");

    expect(second.status).toBe("Archived");
    expect(second.updatedAt).toBe(first.updatedAt);
    expect(updateStatusSpy).not.toHaveBeenCalled();
  });

  it("a non-Owner on an already-archived trip is still refused, and repository.updateStatus is never called", async () => {
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
    await repository.updateStatus(created.id, "Archived");
    const updateStatusSpy = jest.spyOn(repository, "updateStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InsufficientTripRoleError,
    );

    expect(updateStatusSpy).not.toHaveBeenCalled();
  });
});
