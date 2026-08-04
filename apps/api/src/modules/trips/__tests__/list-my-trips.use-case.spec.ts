import { ListMyTripsUseCase } from "../application/use-cases/list-my-trips.use-case";
import type { CreateTripData } from "../domain/ports/trip.repository.port";
import { TripDateRange } from "../domain/value-objects/trip-date-range.value-object";

import { InMemoryTripRepository } from "./fakes/in-memory-trip.repository";

function buildCreateTripData(
  overrides: Partial<CreateTripData> = {},
): CreateTripData {
  return {
    name: "Trip",
    description: null,
    destination: null,
    dateRange: TripDateRange.create(null, null),
    baseCurrency: "EUR",
    createdBy: "owner-1",
    ...overrides,
  };
}

describe("ListMyTripsUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: ListMyTripsUseCase;
  const userId = "user-1";

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    useCase = new ListMyTripsUseCase(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function inviteAndSetStatus(
    createdBy: string,
    status: "Invited" | "Accepted" | "Declined" | "Removed",
    overrides: Partial<CreateTripData> = {},
  ): Promise<string> {
    const trip = await repository.createWithOwner(
      buildCreateTripData({ createdBy, ...overrides }),
    );
    await repository.upsertMember(trip.id, { userId, invitedBy: createdBy });

    if (status !== "Invited") {
      const afterInvite = await repository.findById(trip.id);
      const memberId = afterInvite?.members.find((m) => m.userId === userId)
        ?.id as string;
      const joinedAt = status === "Accepted" ? new Date() : null;
      await repository.updateMemberStatus(trip.id, memberId, status, joinedAt);
    }

    return trip.id;
  }

  it("returns only Invited and Accepted trips, excluding Declined, Removed and soft-deleted", async () => {
    const invitedTripId = await inviteAndSetStatus("owner-a", "Invited");
    const acceptedTripId = await inviteAndSetStatus("owner-b", "Accepted");
    const declinedTripId = await inviteAndSetStatus("owner-c", "Declined");
    const removedTripId = await inviteAndSetStatus("owner-d", "Removed");
    const softDeletedTripId = await inviteAndSetStatus("owner-e", "Accepted");
    await repository.softDelete(softDeletedTripId);

    const summaries = await useCase.execute(userId);
    const ids = summaries.map((s) => s.id);

    expect(ids).toHaveLength(2);
    expect(ids).toEqual(
      expect.arrayContaining([invitedTripId, acceptedTripId]),
    );
    expect(ids).not.toContain(declinedTripId);
    expect(ids).not.toContain(removedTripId);
    expect(ids).not.toContain(softDeletedTripId);
  });

  it("maps a trip into a complete TripSummary", async () => {
    const acceptedTripId = await inviteAndSetStatus("owner-b", "Accepted", {
      name: "Summer trip",
      destination: "Lisbon",
      baseCurrency: "EUR",
      dateRange: TripDateRange.create(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-10T00:00:00.000Z"),
      ),
    });

    const summaries = await useCase.execute(userId);
    const summary = summaries.find((s) => s.id === acceptedTripId);
    if (!summary) {
      throw new Error(
        "expected the accepted trip to be present in the summaries",
      );
    }

    expect(summary).toMatchObject({
      id: acceptedTripId,
      name: "Summer trip",
      destination: "Lisbon",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      baseCurrency: "EUR",
      status: "Planning",
      callerRole: "Member",
      callerStatus: "Accepted",
    });
  });

  it("filters by memberStatus 'Invited'", async () => {
    const invitedTripId = await inviteAndSetStatus("owner-a", "Invited");
    await inviteAndSetStatus("owner-b", "Accepted");

    const summaries = await useCase.execute(userId, {
      memberStatus: "Invited",
    });

    expect(summaries.map((s) => s.id)).toEqual([invitedTripId]);
  });

  it("filters by memberStatus 'Accepted'", async () => {
    await inviteAndSetStatus("owner-a", "Invited");
    const acceptedTripId = await inviteAndSetStatus("owner-b", "Accepted");

    const summaries = await useCase.execute(userId, {
      memberStatus: "Accepted",
    });

    expect(summaries.map((s) => s.id)).toEqual([acceptedTripId]);
  });

  it("returns an empty array when the caller has no trips", async () => {
    const summaries = await useCase.execute("nobody");
    expect(summaries).toEqual([]);
  });

  it("calls findManyForUser with the exact callerId and filter, or undefined when absent", async () => {
    const findManyForUserSpy = jest.spyOn(repository, "findManyForUser");

    await useCase.execute(userId, { memberStatus: "Accepted" });
    expect(findManyForUserSpy).toHaveBeenNthCalledWith(1, userId, {
      memberStatus: "Accepted",
    });

    await useCase.execute(userId);
    expect(findManyForUserSpy).toHaveBeenNthCalledWith(2, userId, undefined);

    expect(findManyForUserSpy).toHaveBeenCalledTimes(2);
  });
});
