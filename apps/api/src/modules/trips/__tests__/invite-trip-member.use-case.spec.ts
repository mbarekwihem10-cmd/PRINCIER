import { InviteTripMemberUseCase } from "../application/use-cases/invite-trip-member.use-case";
import { DuplicateTripMemberError } from "../domain/duplicate-trip-member.error";
import { InsufficientTripRoleError } from "../domain/insufficient-trip-role.error";
import { InviteeNotRegisteredError } from "../domain/invitee-not-registered.error";
import type { CreateTripData } from "../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../domain/trip-not-found.error";
import { TripDateRange } from "../domain/value-objects/trip-date-range.value-object";

import { FakeRegisteredUserLookup } from "./fakes/fake-registered-user-lookup";
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

describe("InviteTripMemberUseCase", () => {
  let repository: InMemoryTripRepository;
  let registeredUserLookup: FakeRegisteredUserLookup;
  let useCase: InviteTripMemberUseCase;

  beforeEach(() => {
    repository = new InMemoryTripRepository();
    registeredUserLookup = new FakeRegisteredUserLookup(["invitee-1"]);
    useCase = new InviteTripMemberUseCase(repository, registeredUserLookup);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("invites a registered user, adding a Member with status Invited and joinedAt null", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());

    const details = await useCase.execute(created.id, "owner-1", "invitee-1");

    const member = details.members.find((m) => m.userId === "invitee-1");
    expect(member?.role).toBe("Member");
    expect(member?.status).toBe("Invited");
    expect(member?.joinedAt).toBeNull();
  });

  it("calls registeredUserLookup.existsById exactly once with the exact targetUserId", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const existsByIdSpy = jest.spyOn(registeredUserLookup, "existsById");

    await useCase.execute(created.id, "owner-1", "invitee-1");

    expect(existsByIdSpy).toHaveBeenCalledTimes(1);
    expect(existsByIdSpy).toHaveBeenCalledWith("invitee-1");
  });

  it("calls tripRepository.upsertMember exactly once with the exact data", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await useCase.execute(created.id, "owner-1", "invitee-1");

    expect(upsertMemberSpy).toHaveBeenCalledTimes(1);
    expect(upsertMemberSpy).toHaveBeenCalledWith(created.id, {
      userId: "invitee-1",
      invitedBy: "owner-1",
      role: "Member",
    });
  });

  it("returns TripDetails built from the entity resolved by tripRepository.upsertMember", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    const details = await useCase.execute(created.id, "owner-1", "invitee-1");

    const result = upsertMemberSpy.mock.results[0];
    if (!result || result.type !== "return") {
      throw new Error("expected tripRepository.upsertMember to return");
    }
    const repoTrip = await result.value;
    expect(details).toEqual(repoTrip.toDetails("owner-1"));
  });

  it("throws TripNotFoundError for an unknown trip, and never calls existsById or upsertMember", async () => {
    const existsByIdSpy = jest.spyOn(registeredUserLookup, "existsById");
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await expect(
      useCase.execute("unknown-trip", "owner-1", "invitee-1"),
    ).rejects.toThrow(TripNotFoundError);

    expect(existsByIdSpy).not.toHaveBeenCalled();
    expect(upsertMemberSpy).not.toHaveBeenCalled();
  });

  it("throws InsufficientTripRoleError for a non-Owner caller, and never calls existsById or upsertMember", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "editor-1",
      invitedBy: "owner-1",
      role: "Editor",
    });
    const afterInvite = await repository.findById(created.id);
    const member = afterInvite?.members.find(
      (candidate) => candidate.userId === "editor-1",
    );
    if (!member) {
      throw new Error("test setup failed: invited member not found");
    }
    await repository.updateMemberStatus(
      created.id,
      member.id,
      "Accepted",
      new Date("2026-01-15T00:00:00.000Z"),
    );
    const existsByIdSpy = jest.spyOn(registeredUserLookup, "existsById");
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await expect(
      useCase.execute(created.id, "editor-1", "invitee-1"),
    ).rejects.toThrow(InsufficientTripRoleError);

    expect(existsByIdSpy).not.toHaveBeenCalled();
    expect(upsertMemberSpy).not.toHaveBeenCalled();
  });

  it("throws DuplicateTripMemberError when the target is already Invited, and never calls existsById or upsertMember", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "invitee-1",
      invitedBy: "owner-1",
    });
    const existsByIdSpy = jest.spyOn(registeredUserLookup, "existsById");
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await expect(
      useCase.execute(created.id, "owner-1", "invitee-1"),
    ).rejects.toThrow(DuplicateTripMemberError);

    expect(existsByIdSpy).not.toHaveBeenCalled();
    expect(upsertMemberSpy).not.toHaveBeenCalled();
  });

  it("throws DuplicateTripMemberError when the target is already Accepted, and never calls existsById or upsertMember", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "invitee-1",
      invitedBy: "owner-1",
    });
    const afterInvite = await repository.findById(created.id);
    const member = afterInvite?.members.find(
      (candidate) => candidate.userId === "invitee-1",
    );
    if (!member) {
      throw new Error("test setup failed: invited member not found");
    }
    await repository.updateMemberStatus(
      created.id,
      member.id,
      "Accepted",
      new Date("2026-01-15T00:00:00.000Z"),
    );
    const existsByIdSpy = jest.spyOn(registeredUserLookup, "existsById");
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await expect(
      useCase.execute(created.id, "owner-1", "invitee-1"),
    ).rejects.toThrow(DuplicateTripMemberError);

    expect(existsByIdSpy).not.toHaveBeenCalled();
    expect(upsertMemberSpy).not.toHaveBeenCalled();
  });

  it("throws InviteeNotRegisteredError when the target user does not exist, and never calls upsertMember", async () => {
    const unregisteredLookup = new FakeRegisteredUserLookup([]);
    const useCaseWithUnregisteredLookup = new InviteTripMemberUseCase(
      repository,
      unregisteredLookup,
    );
    const created = await repository.createWithOwner(buildCreateTripData());
    const existsByIdSpy = jest.spyOn(unregisteredLookup, "existsById");
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await expect(
      useCaseWithUnregisteredLookup.execute(created.id, "owner-1", "invitee-1"),
    ).rejects.toThrow(InviteeNotRegisteredError);

    expect(existsByIdSpy).toHaveBeenCalledTimes(1);
    expect(existsByIdSpy).toHaveBeenCalledWith("invitee-1");
    expect(upsertMemberSpy).not.toHaveBeenCalled();
  });

  it("calls findById, assertCanInviteMember, existsById, and upsertMember in order", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    const trip = await repository.findById(created.id);

    if (!trip) {
      throw new Error("test setup failed: created trip not found");
    }

    const findByIdSpy = jest
      .spyOn(repository, "findById")
      .mockResolvedValue(trip);
    const assertCanInviteMemberSpy = jest.spyOn(trip, "assertCanInviteMember");
    const existsByIdSpy = jest.spyOn(registeredUserLookup, "existsById");
    const upsertMemberSpy = jest.spyOn(repository, "upsertMember");

    await useCase.execute(created.id, "owner-1", "invitee-1");

    expect(findByIdSpy).toHaveBeenCalledTimes(1);
    expect(assertCanInviteMemberSpy).toHaveBeenCalledTimes(1);
    expect(existsByIdSpy).toHaveBeenCalledTimes(1);
    expect(upsertMemberSpy).toHaveBeenCalledTimes(1);

    const findByIdOrder = findByIdSpy.mock.invocationCallOrder[0];
    const assertionOrder = assertCanInviteMemberSpy.mock.invocationCallOrder[0];
    const lookupOrder = existsByIdSpy.mock.invocationCallOrder[0];
    const upsertOrder = upsertMemberSpy.mock.invocationCallOrder[0];

    if (
      findByIdOrder === undefined ||
      assertionOrder === undefined ||
      lookupOrder === undefined ||
      upsertOrder === undefined
    ) {
      throw new Error("test setup failed: expected calls were not recorded");
    }

    expect(findByIdOrder).toBeLessThan(assertionOrder);
    expect(assertionOrder).toBeLessThan(lookupOrder);
    expect(lookupOrder).toBeLessThan(upsertOrder);
  });

  it("reinvites a Declined member: single row, same id, role reset to Member, status Invited, joinedAt null, invitedBy updated", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "invitee-1",
      invitedBy: "former-inviter",
    });
    const afterInvite = await repository.findById(created.id);
    const member = afterInvite?.members.find(
      (candidate) => candidate.userId === "invitee-1",
    );
    if (!member) {
      throw new Error("test setup failed: invited member not found");
    }
    const memberId = member.id;
    await repository.updateMemberRole(created.id, memberId, "Editor");
    await repository.updateMemberStatus(created.id, memberId, "Declined", null);

    const details = await useCase.execute(created.id, "owner-1", "invitee-1");

    const matches = details.members.filter((m) => m.userId === "invitee-1");
    expect(matches).toHaveLength(1);
    const reinvitedMember = matches[0];
    expect(reinvitedMember?.id).toBe(memberId);
    expect(reinvitedMember?.role).toBe("Member");
    expect(reinvitedMember?.status).toBe("Invited");
    expect(reinvitedMember?.joinedAt).toBeNull();
    expect(reinvitedMember?.invitedBy).toBe("owner-1");
  });

  it("reinvites a Removed member: single row, same id, role reset to Member, status Invited, joinedAt null, invitedBy updated", async () => {
    const created = await repository.createWithOwner(buildCreateTripData());
    await repository.upsertMember(created.id, {
      userId: "invitee-1",
      invitedBy: "former-inviter",
    });
    const afterInvite = await repository.findById(created.id);
    const member = afterInvite?.members.find(
      (candidate) => candidate.userId === "invitee-1",
    );
    if (!member) {
      throw new Error("test setup failed: invited member not found");
    }
    const memberId = member.id;
    await repository.updateMemberRole(created.id, memberId, "Owner");
    await repository.updateMemberStatus(
      created.id,
      memberId,
      "Accepted",
      new Date("2026-01-10T00:00:00.000Z"),
    );
    await repository.updateMemberStatus(created.id, memberId, "Removed", null);

    const details = await useCase.execute(created.id, "owner-1", "invitee-1");

    const matches = details.members.filter((m) => m.userId === "invitee-1");
    expect(matches).toHaveLength(1);
    const reinvitedMember = matches[0];
    expect(reinvitedMember?.id).toBe(memberId);
    expect(reinvitedMember?.role).toBe("Member");
    expect(reinvitedMember?.status).toBe("Invited");
    expect(reinvitedMember?.joinedAt).toBeNull();
    expect(reinvitedMember?.invitedBy).toBe("owner-1");
  });
});
