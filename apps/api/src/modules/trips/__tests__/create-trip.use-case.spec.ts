import { CreateTripUseCase } from "../application/use-cases/create-trip.use-case";
import { InvalidTripDateRangeError } from "../domain/invalid-trip-date-range.error";

import { InMemoryTripRepository } from "./fakes/in-memory-trip.repository";

describe("CreateTripUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: CreateTripUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new CreateTripUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a trip with all fields transmitted, and returns an Owner Accepted, status Planning", async () => {
    const createWithOwnerSpy = jest.spyOn(repository, "createWithOwner");

    const trip = await useCase.execute("owner-1", {
      name: "Summer trip",
      description: "A trip to remember",
      destination: "Lisbon",
      startDate: null,
      endDate: null,
      baseCurrency: "EUR",
    });

    expect(createWithOwnerSpy).toHaveBeenCalledTimes(1);
    const callArg = createWithOwnerSpy.mock.calls[0]?.[0];
    if (!callArg) {
      throw new Error("expected createWithOwner to have been called with data");
    }
    expect(callArg.createdBy).toBe("owner-1");
    expect(callArg.name).toBe("Summer trip");
    expect(callArg.description).toBe("A trip to remember");
    expect(callArg.destination).toBe("Lisbon");
    expect(callArg.baseCurrency).toBe("EUR");
    expect(callArg.dateRange.startDate).toBeNull();
    expect(callArg.dateRange.endDate).toBeNull();

    expect(trip.status).toBe("Planning");
    expect(trip.name).toBe("Summer trip");
    expect(trip.description).toBe("A trip to remember");
    expect(trip.destination).toBe("Lisbon");
    expect(trip.baseCurrency).toBe("EUR");
    expect(trip.createdBy).toBe("owner-1");
    expect(trip.callerRole).toBe("Owner");
    expect(trip.callerStatus).toBe("Accepted");
  });

  it("creates a trip with real dates, correctly represented in TripDetails", async () => {
    const trip = await useCase.execute("owner-1", {
      name: "Summer trip",
      description: null,
      destination: "Lisbon",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-10T00:00:00.000Z"),
      baseCurrency: "EUR",
    });

    expect(trip.startDate).toBe("2026-06-01");
    expect(trip.endDate).toBe("2026-06-10");
  });

  it("propagates InvalidTripDateRangeError and never calls repository.createWithOwner", async () => {
    const createWithOwnerSpy = jest.spyOn(repository, "createWithOwner");

    await expect(
      useCase.execute("owner-1", {
        name: "Summer trip",
        description: null,
        destination: null,
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-01T00:00:00.000Z"),
        baseCurrency: "EUR",
      }),
    ).rejects.toThrow(InvalidTripDateRangeError);

    expect(createWithOwnerSpy).not.toHaveBeenCalled();

    const trips = await repository.findManyForUser("owner-1");
    expect(trips).toHaveLength(0);
  });
});
