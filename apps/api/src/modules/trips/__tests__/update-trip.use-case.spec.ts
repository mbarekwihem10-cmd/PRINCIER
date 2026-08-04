import { UpdateTripUseCase } from "../application/use-cases/update-trip.use-case";
import { InsufficientTripRoleError } from "../domain/insufficient-trip-role.error";
import { InvalidTripDateRangeError } from "../domain/invalid-trip-date-range.error";
import type { CreateTripData } from "../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../domain/trip-not-found.error";
import { TripDateRange } from "../domain/value-objects/trip-date-range.value-object";

import { InMemoryTripRepository } from "./fakes/in-memory-trip.repository";

function buildCreateTripData(
  overrides: Partial<CreateTripData> = {},
): CreateTripData {
  return {
    name: "Summer trip",
    description: "Original description",
    destination: "Lisbon",
    dateRange: TripDateRange.create(null, null),
    baseCurrency: "EUR",
    createdBy: "owner-1",
    ...overrides,
  };
}

describe("UpdateTripUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: UpdateTripUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
    repository = new InMemoryTripRepository();
    useCase = new UpdateTripUseCase(repository);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("Owner updates simple fields and updatedAt is refreshed", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    const updated = await useCase.execute(created.id, "owner-1", {
      name: "New name",
      description: "New desc",
      destination: "Porto",
      baseCurrency: "USD",
    });

    expect(updated.name).toBe("New name");
    expect(updated.description).toBe("New desc");
    expect(updated.destination).toBe("Porto");
    expect(updated.baseCurrency).toBe("USD");
    expect(updated.updatedAt).toBe(
      new Date("2026-04-01T00:00:00.000Z").toISOString(),
    );
  });

  it("updates only name, leaving description, destination and baseCurrency unchanged", async () => {
    const created = await repository.createWithOwner(
      buildCreateTripData({
        name: "Old name",
        description: "Original description",
        destination: "Lisbon",
        baseCurrency: "EUR",
      }),
    );

    const updated = await useCase.execute(created.id, "owner-1", {
      name: "New name only",
    });

    expect(updated.name).toBe("New name only");
    expect(updated.description).toBe("Original description");
    expect(updated.destination).toBe("Lisbon");
    expect(updated.baseCurrency).toBe("EUR");
  });

  it("erases description with null (and destination with null in the same call)", async () => {
    const created = await repository.createWithOwner(
      buildCreateTripData({
        description: "Original description",
        destination: "Lisbon",
      }),
    );

    const updated = await useCase.execute(created.id, "owner-1", {
      description: null,
      destination: null,
    });

    expect(updated.description).toBeNull();
    expect(updated.destination).toBeNull();
  });

  it("an Accepted Editor is allowed to update", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "editor-1",
      invitedBy: "owner-1",
    });
    const afterInvite = await repository.findById(created.id);
    const memberId = afterInvite?.members.find((m) => m.userId === "editor-1")
      ?.id as string;
    await repository.updateMemberRole(created.id, memberId, "Editor");
    await repository.updateMemberStatus(
      created.id,
      memberId,
      "Accepted",
      new Date(),
    );

    const updated = await useCase.execute(created.id, "editor-1", {
      name: "New",
    });

    expect(updated.name).toBe("New");
  });

  it("an Accepted Member is refused with InsufficientTripRoleError", async () => {
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

    await expect(
      useCase.execute(created.id, "member-1", { name: "New" }),
    ).rejects.toThrow(InsufficientTripRoleError);
  });

  it("an Accepted Member with an empty body is still refused, and repository.updateDetails is never called", async () => {
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
    const updateDetailsSpy = jest.spyOn(repository, "updateDetails");

    await expect(useCase.execute(created.id, "member-1", {})).rejects.toThrow(
      InsufficientTripRoleError,
    );

    expect(updateDetailsSpy).not.toHaveBeenCalled();
  });

  it("throws TripNotFoundError for an unknown trip", async () => {
    await expect(
      useCase.execute("unknown-trip", "owner-1", { name: "New" }),
    ).rejects.toThrow(TripNotFoundError);
  });

  it("throws InvalidTripDateRangeError for two explicit invalid dates, and never calls repository.updateDetails", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const updateDetailsSpy = jest.spyOn(repository, "updateDetails");

    await expect(
      useCase.execute(created.id, "owner-1", {
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(InvalidTripDateRangeError);

    expect(updateDetailsSpy).not.toHaveBeenCalled();
  });

  it("a stranger with no membership row sending invalid dates gets TripNotFoundError, and repository.updateDetails is never called", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const updateDetailsSpy = jest.spyOn(repository, "updateDetails");

    await expect(
      useCase.execute(created.id, "stranger", {
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(TripNotFoundError);

    expect(updateDetailsSpy).not.toHaveBeenCalled();
  });

  it("an Accepted Member sending invalid dates gets InsufficientTripRoleError, and repository.updateDetails is never called", async () => {
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
    const updateDetailsSpy = jest.spyOn(repository, "updateDetails");

    await expect(
      useCase.execute(created.id, "member-1", {
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(InsufficientTripRoleError);

    expect(updateDetailsSpy).not.toHaveBeenCalled();
  });

  it("updates only startDate, preserving the existing endDate", async () => {
    const created = await repository.createWithOwner(
      buildCreateTripData({
        dateRange: TripDateRange.create(
          new Date("2026-06-01T00:00:00.000Z"),
          new Date("2026-06-10T00:00:00.000Z"),
        ),
      }),
    );

    const updated = await useCase.execute(created.id, "owner-1", {
      startDate: new Date("2026-06-05T00:00:00.000Z"),
    });

    expect(updated.startDate).toBe("2026-06-05");
    expect(updated.endDate).toBe("2026-06-10");
  });

  it("updates only endDate, preserving the existing startDate", async () => {
    const created = await repository.createWithOwner(
      buildCreateTripData({
        dateRange: TripDateRange.create(
          new Date("2026-06-01T00:00:00.000Z"),
          new Date("2026-06-10T00:00:00.000Z"),
        ),
      }),
    );

    const updated = await useCase.execute(created.id, "owner-1", {
      endDate: new Date("2026-06-15T00:00:00.000Z"),
    });

    expect(updated.startDate).toBe("2026-06-01");
    expect(updated.endDate).toBe("2026-06-15");
  });

  it("startDate: null clears only that bound", async () => {
    const created = await repository.createWithOwner(
      buildCreateTripData({
        dateRange: TripDateRange.create(
          new Date("2026-06-01T00:00:00.000Z"),
          new Date("2026-06-10T00:00:00.000Z"),
        ),
      }),
    );

    const updated = await useCase.execute(created.id, "owner-1", {
      startDate: null,
    });

    expect(updated.startDate).toBeNull();
    expect(updated.endDate).toBe("2026-06-10");
  });

  it("throws InvalidTripDateRangeError for an invalid combination after merge, and never calls repository.updateDetails", async () => {
    const created = await repository.createWithOwner(
      buildCreateTripData({
        dateRange: TripDateRange.create(
          new Date("2026-06-10T00:00:00.000Z"),
          new Date("2026-06-20T00:00:00.000Z"),
        ),
      }),
    );
    const updateDetailsSpy = jest.spyOn(repository, "updateDetails");

    await expect(
      useCase.execute(created.id, "owner-1", {
        endDate: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(InvalidTripDateRangeError);

    expect(updateDetailsSpy).not.toHaveBeenCalled();
  });

  it("an empty input succeeds, leaves updatedAt unchanged and does not call repository.updateDetails", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const originalUpdatedAt = created.updatedAt.toISOString();
    const updateDetailsSpy = jest.spyOn(repository, "updateDetails");
    jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    const updated = await useCase.execute(created.id, "owner-1", {});

    expect(updated.updatedAt).toBe(originalUpdatedAt);
    expect(updateDetailsSpy).not.toHaveBeenCalled();
  });
});
