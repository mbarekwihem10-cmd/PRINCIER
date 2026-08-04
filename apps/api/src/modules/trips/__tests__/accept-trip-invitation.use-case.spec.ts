import { AcceptTripInvitationUseCase } from "../application/use-cases/accept-trip-invitation.use-case";
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

describe("AcceptTripInvitationUseCase", () => {
  let repository: InMemoryTripRepository;
  let useCase: AcceptTripInvitationUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
    repository = new InMemoryTripRepository();
    useCase = new AcceptTripInvitationUseCase(repository);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("accepts the invitation for an Invited member, setting status to Accepted and a deterministic joinedAt", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await inviteMember(repository, created.id, "member-1");

    const details = await useCase.execute(created.id, "member-1");

    const member = details.members.find((m) => m.userId === "member-1");
    expect(member?.status).toBe("Accepted");
    expect(member?.joinedAt).toBe(
      new Date("2026-03-01T10:00:00.000Z").toISOString(),
    );
  });

  it("calls repository.updateMemberStatus with the exact tripId, memberId, 'Accepted', and joinedAt", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await useCase.execute(created.id, "member-1");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      created.id,
      memberId,
      "Accepted",
      new Date("2026-03-01T10:00:00.000Z"),
    );
  });

  it("returns TripDetails built from the entity resolved by repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await inviteMember(repository, created.id, "member-1");
    const spy = jest.spyOn(repository, "updateMemberStatus");

    const details = await useCase.execute(created.id, "member-1");

    expect(details.callerStatus).toBe("Accepted");
    const result = spy.mock.results[0];
    if (!result || result.type !== "return") {
      throw new Error("expected repository.updateMemberStatus to return");
    }
    const repoTrip = await result.value;
    expect(details).toEqual(repoTrip.toDetails("member-1"));
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

  it("throws InvalidMemberStatusTransitionError when already Accepted, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    await repository.updateMemberStatus(
      created.id,
      memberId,
      "Accepted",
      new Date(),
    );
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InvalidMemberStatusTransitionError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError when already Declined, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    await repository.updateMemberStatus(created.id, memberId, "Declined", null);
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InvalidMemberStatusTransitionError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws InvalidMemberStatusTransitionError for a Removed member, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const memberId = await inviteMember(repository, created.id, "member-1");
    await repository.updateMemberStatus(created.id, memberId, "Removed", null);
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      InvalidMemberStatusTransitionError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("throws TripNotFoundError when the trip is soft-deleted, even for an Invited member, and never calls repository.updateMemberStatus", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await inviteMember(repository, created.id, "member-1");
    await repository.softDelete(created.id);
    const spy = jest.spyOn(repository, "updateMemberStatus");

    await expect(useCase.execute(created.id, "member-1")).rejects.toThrow(
      TripNotFoundError,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("succeeds accepting an invitation on an Archived (non-deleted) trip", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await inviteMember(repository, created.id, "member-1");
    await repository.updateStatus(created.id, "Archived");

    const details = await useCase.execute(created.id, "member-1");

    const member = details.members.find((m) => m.userId === "member-1");
    expect(member?.status).toBe("Accepted");
  });
});
