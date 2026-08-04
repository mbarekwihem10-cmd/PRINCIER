import { GetTripByIdUseCase } from "../application/use-cases/get-trip-by-id.use-case";
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

describe("GetTripByIdUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: GetTripByIdUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new GetTripByIdUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the details for an Accepted member and calls findById with the exact tripId", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const findByIdSpy = jest.spyOn(repository, "findById");

    const details = await useCase.execute(created.id, "owner-1");

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(findByIdSpy).toHaveBeenCalledWith(created.id);
    expect(details.id).toBe(created.id);
    expect(details.callerRole).toBe("Owner");
    expect(details.callerStatus).toBe("Accepted");
  });

  it("throws TripNotFoundError for an unknown trip", async () => {
    await expect(useCase.execute("unknown-trip", "owner-1")).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it("throws TripNotFoundError for a third party with no membership row", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());

    await expect(useCase.execute(created.id, "stranger")).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it("throws TripNotFoundError for a soft-deleted trip", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.softDelete(created.id);

    await expect(useCase.execute(created.id, "owner-1")).rejects.toThrow(
      TripNotFoundError,
    );
  });

  it("returns callerStatus 'Invited' and callerRole 'Member' for an invited member", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "invitee-1",
      invitedBy: "owner-1",
    });

    const details = await useCase.execute(created.id, "invitee-1");

    expect(details.callerStatus).toBe("Invited");
    expect(details.callerRole).toBe("Member");
  });
});
