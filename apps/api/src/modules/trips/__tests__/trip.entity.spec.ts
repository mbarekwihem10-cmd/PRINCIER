import type { TripMemberRole } from "@tripplanner/shared-types";

import { CannotRemoveLastOwnerError } from "../domain/cannot-remove-last-owner.error";
import { CannotRemoveSelfError } from "../domain/cannot-remove-self.error";
import { DuplicateTripMemberError } from "../domain/duplicate-trip-member.error";
import {
  TripMember,
  type TripMemberProps,
} from "../domain/entities/trip-member.entity";
import { Trip, type TripProps } from "../domain/entities/trip.entity";
import { InsufficientTripRoleError } from "../domain/insufficient-trip-role.error";
import { InvalidMemberStatusTransitionError } from "../domain/invalid-member-status-transition.error";
import { TripMemberNotFoundError } from "../domain/trip-member-not-found.error";
import { TripNotFoundError } from "../domain/trip-not-found.error";
import { TripDateRange } from "../domain/value-objects/trip-date-range.value-object";

const OWNER_ID = "owner-1";
const EDITOR_ID = "editor-1";
const MEMBER_ID = "member-1";

function buildMemberProps(
  overrides: Partial<TripMemberProps> = {},
): TripMemberProps {
  return {
    id: `tm-${overrides.userId ?? "default"}`,
    tripId: "trip-1",
    userId: "user-1",
    role: "Member",
    status: "Accepted",
    invitedBy: null,
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function ownerProps(overrides: Partial<TripMemberProps> = {}): TripMemberProps {
  return buildMemberProps({
    id: "tm-owner",
    userId: OWNER_ID,
    role: "Owner",
    status: "Accepted",
    ...overrides,
  });
}

function editorProps(
  overrides: Partial<TripMemberProps> = {},
): TripMemberProps {
  return buildMemberProps({
    id: "tm-editor",
    userId: EDITOR_ID,
    role: "Editor",
    status: "Accepted",
    ...overrides,
  });
}

function memberProps(
  overrides: Partial<TripMemberProps> = {},
): TripMemberProps {
  return buildMemberProps({
    id: "tm-member",
    userId: MEMBER_ID,
    role: "Member",
    status: "Accepted",
    ...overrides,
  });
}

function buildTripProps(overrides: Partial<TripProps> = {}): TripProps {
  return {
    id: "trip-1",
    name: "Summer trip",
    description: null,
    destination: "Lisbon",
    dateRange: TripDateRange.create(null, null),
    baseCurrency: "EUR",
    status: "Planning",
    createdBy: OWNER_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    members: [TripMember.fromPersistence(ownerProps())],
    ...overrides,
  };
}

function buildTrip(overrides: Partial<TripProps> = {}): Trip {
  return Trip.fromPersistence(buildTripProps(overrides));
}

function membersOf(...propsList: TripMemberProps[]): TripMember[] {
  return propsList.map((props) => TripMember.fromPersistence(props));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Trip — assertViewableBy", () => {
  it("passes for an Invited member", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });
    expect(() => trip.assertViewableBy(MEMBER_ID)).not.toThrow();
  });

  it("passes for an Accepted member", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });
    expect(() => trip.assertViewableBy(MEMBER_ID)).not.toThrow();
  });

  it("throws TripNotFoundError for a Declined member", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Declined" })),
    });
    expect(() => trip.assertViewableBy(MEMBER_ID)).toThrow(TripNotFoundError);
  });

  it("throws TripNotFoundError for a Removed member", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Removed" })),
    });
    expect(() => trip.assertViewableBy(MEMBER_ID)).toThrow(TripNotFoundError);
  });

  it("throws TripNotFoundError for a stranger with no membership row", () => {
    const trip = buildTrip({ members: membersOf(ownerProps()) });
    expect(() => trip.assertViewableBy("stranger-1")).toThrow(
      TripNotFoundError,
    );
  });

  it("throws TripNotFoundError when the trip is soft-deleted, even for an Accepted member", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
      deletedAt: new Date("2026-02-15T00:00:00.000Z"),
    });
    expect(() => trip.assertViewableBy(MEMBER_ID)).toThrow(TripNotFoundError);
  });
});

describe("Trip — assertEditableBy", () => {
  it("passes for an Accepted Owner", () => {
    const trip = buildTrip();
    expect(() => trip.assertEditableBy(OWNER_ID)).not.toThrow();
  });

  it("passes for an Accepted Editor", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), editorProps()) });
    expect(() => trip.assertEditableBy(EDITOR_ID)).not.toThrow();
  });

  it("throws InsufficientTripRoleError for an Accepted Member", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), memberProps()) });
    expect(() => trip.assertEditableBy(MEMBER_ID)).toThrow(
      InsufficientTripRoleError,
    );
  });

  it("throws InsufficientTripRoleError for an Editor who has not yet accepted", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), editorProps({ status: "Invited" })),
    });
    expect(() => trip.assertEditableBy(EDITOR_ID)).toThrow(
      InsufficientTripRoleError,
    );
  });

  it("throws TripNotFoundError for a Declined or a Removed member", () => {
    const declinedTrip = buildTrip({
      members: membersOf(ownerProps(), editorProps({ status: "Declined" })),
    });

    const removedTrip = buildTrip({
      members: membersOf(ownerProps(), editorProps({ status: "Removed" })),
    });

    expect(() => declinedTrip.assertEditableBy(EDITOR_ID)).toThrow(
      TripNotFoundError,
    );
    expect(() => removedTrip.assertEditableBy(EDITOR_ID)).toThrow(
      TripNotFoundError,
    );
  });

  it("throws TripNotFoundError when the trip is soft-deleted, even for an Accepted Editor", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), editorProps()),
      deletedAt: new Date("2026-02-15T00:00:00.000Z"),
    });
    expect(() => trip.assertEditableBy(EDITOR_ID)).toThrow(TripNotFoundError);
  });
});

describe("Trip — assertManageableBy", () => {
  it("passes for an Accepted Owner", () => {
    const trip = buildTrip();
    expect(() => trip.assertManageableBy(OWNER_ID)).not.toThrow();
  });

  it("throws InsufficientTripRoleError for an Accepted Editor", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), editorProps()) });
    expect(() => trip.assertManageableBy(EDITOR_ID)).toThrow(
      InsufficientTripRoleError,
    );
  });

  it("throws InsufficientTripRoleError for an Accepted Member", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), memberProps()) });
    expect(() => trip.assertManageableBy(MEMBER_ID)).toThrow(
      InsufficientTripRoleError,
    );
  });

  it("throws TripNotFoundError when the trip is soft-deleted, even for an Accepted Owner", () => {
    const trip = buildTrip({ deletedAt: new Date("2026-02-15T00:00:00.000Z") });
    expect(() => trip.assertManageableBy(OWNER_ID)).toThrow(TripNotFoundError);
  });
});

describe("Trip — updateDetails / archive / markDeleted", () => {
  it("updateDetails applies only the provided fields, leaving the rest untouched", () => {
    const trip = buildTrip({
      name: "Old name",
      destination: "Porto",
      baseCurrency: "EUR",
    });

    trip.updateDetails(OWNER_ID, { name: "New name" });

    expect(trip.name).toBe("New name");
    expect(trip.destination).toBe("Porto");
    expect(trip.baseCurrency).toBe("EUR");
  });

  it("updateDetails throws InsufficientTripRoleError for a Member", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), memberProps()) });
    expect(() => trip.updateDetails(MEMBER_ID, { name: "New name" })).toThrow(
      InsufficientTripRoleError,
    );
  });

  it("archive() sets status to Archived", () => {
    const trip = buildTrip({ status: "Confirmed" });
    trip.archive(OWNER_ID);
    expect(trip.status).toBe("Archived");
  });

  it("archive() is idempotent", () => {
    const trip = buildTrip({ status: "Archived" });
    expect(() => trip.archive(OWNER_ID)).not.toThrow();
    expect(trip.status).toBe("Archived");
  });

  it("archive() throws InsufficientTripRoleError for a non-Owner", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), editorProps()) });
    expect(() => trip.archive(EDITOR_ID)).toThrow(InsufficientTripRoleError);
  });

  it("markDeleted() sets deletedAt on the first call by an Accepted Owner", () => {
    const trip = buildTrip({ deletedAt: null });
    trip.markDeleted(OWNER_ID);
    expect(trip.deletedAt).toEqual(new Date("2026-03-01T10:00:00.000Z"));
  });

  it("markDeleted() throws InsufficientTripRoleError for a non-Owner (not yet deleted)", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), editorProps()),
      deletedAt: null,
    });
    expect(() => trip.markDeleted(EDITOR_ID)).toThrow(
      InsufficientTripRoleError,
    );
    expect(trip.deletedAt).toBeNull();
  });

  it("markDeleted() keeps the original date on a second call", () => {
    const trip = buildTrip({ deletedAt: null });

    trip.markDeleted(OWNER_ID);
    const firstDeletionDate = trip.deletedAt;

    jest.setSystemTime(new Date("2026-03-05T00:00:00.000Z"));
    trip.markDeleted(OWNER_ID);

    expect(trip.deletedAt).toEqual(firstDeletionDate);
    expect(trip.deletedAt).toEqual(new Date("2026-03-01T10:00:00.000Z"));
  });

  it("markDeleted() throws InsufficientTripRoleError for a non-Owner even when the trip is already deleted", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), editorProps()),
      deletedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(() => trip.markDeleted(EDITOR_ID)).toThrow(
      InsufficientTripRoleError,
    );
    expect(trip.deletedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });
});

describe("Trip — assertCanInviteMember", () => {
  it("throws DuplicateTripMemberError when the target is Invited", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });
    expect(() => trip.assertCanInviteMember(OWNER_ID, MEMBER_ID)).toThrow(
      DuplicateTripMemberError,
    );
  });

  it("throws DuplicateTripMemberError when the target is Accepted", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });
    expect(() => trip.assertCanInviteMember(OWNER_ID, MEMBER_ID)).toThrow(
      DuplicateTripMemberError,
    );
  });

  it("passes without mutating the aggregate for a Declined target", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Declined" })),
    });
    const before = trip.members.map((m) => m.status);

    expect(() => trip.assertCanInviteMember(OWNER_ID, MEMBER_ID)).not.toThrow();

    expect(trip.members.map((m) => m.status)).toEqual(before);
  });

  it("passes without mutating the aggregate for a Removed target", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Removed" })),
    });
    const before = trip.members.map((m) => m.status);

    expect(() => trip.assertCanInviteMember(OWNER_ID, MEMBER_ID)).not.toThrow();

    expect(trip.members.map((m) => m.status)).toEqual(before);
  });

  it("passes without mutating the aggregate for a target with no existing row", () => {
    const trip = buildTrip();
    const beforeCount = trip.members.length;

    expect(() =>
      trip.assertCanInviteMember(OWNER_ID, "brand-new-user"),
    ).not.toThrow();

    expect(trip.members.length).toBe(beforeCount);
  });

  it("throws InsufficientTripRoleError for an Editor caller", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), editorProps()) });
    expect(() =>
      trip.assertCanInviteMember(EDITOR_ID, "brand-new-user"),
    ).toThrow(InsufficientTripRoleError);
  });
});

describe("Trip — acceptInvitation / declineInvitation", () => {
  it("acceptInvitation transitions Invited to Accepted and sets joinedAt", () => {
    const trip = buildTrip({
      members: membersOf(
        ownerProps(),
        memberProps({ status: "Invited", joinedAt: null }),
      ),
    });

    trip.acceptInvitation(MEMBER_ID);

    const updated = trip.members.find((m) => m.userId === MEMBER_ID);
    expect(updated?.status).toBe("Accepted");
    expect(updated?.joinedAt).toEqual(new Date("2026-03-01T10:00:00.000Z"));
  });

  it("acceptInvitation throws InvalidMemberStatusTransitionError when status is not Invited", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });
    expect(() => trip.acceptInvitation(MEMBER_ID)).toThrow(
      InvalidMemberStatusTransitionError,
    );
  });

  it("acceptInvitation throws TripNotFoundError when the caller has no membership row", () => {
    const trip = buildTrip();
    expect(() => trip.acceptInvitation("stranger-1")).toThrow(
      TripNotFoundError,
    );
  });

  it("declineInvitation transitions Invited to Declined", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });

    trip.declineInvitation(MEMBER_ID);

    expect(trip.members.find((m) => m.userId === MEMBER_ID)?.status).toBe(
      "Declined",
    );
  });

  it("declineInvitation throws InvalidMemberStatusTransitionError when status is not Invited", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });
    expect(() => trip.declineInvitation(MEMBER_ID)).toThrow(
      InvalidMemberStatusTransitionError,
    );
  });
});

describe("Trip — removeMember", () => {
  it("transitions an Accepted target to Removed", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });

    trip.removeMember(OWNER_ID, "tm-member");

    expect(trip.members.find((m) => m.id === "tm-member")?.status).toBe(
      "Removed",
    );
  });

  it("transitions a Declined target to Removed", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Declined" })),
    });

    trip.removeMember(OWNER_ID, "tm-member");

    expect(trip.members.find((m) => m.id === "tm-member")?.status).toBe(
      "Removed",
    );
  });

  it("throws TripMemberNotFoundError for an unknown memberId", () => {
    const trip = buildTrip();
    expect(() => trip.removeMember(OWNER_ID, "unknown-id")).toThrow(
      TripMemberNotFoundError,
    );
  });

  it("throws InsufficientTripRoleError for a non-Owner caller", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), editorProps(), memberProps()),
    });
    expect(() => trip.removeMember(EDITOR_ID, "tm-member")).toThrow(
      InsufficientTripRoleError,
    );
  });

  it("throws CannotRemoveSelfError when the sole Accepted Owner targets their own membership row", () => {
    const trip = buildTrip();
    expect(() => trip.removeMember(OWNER_ID, "tm-owner")).toThrow(
      CannotRemoveSelfError,
    );
  });

  it("throws CannotRemoveSelfError even when other Accepted Owners exist", () => {
    const secondOwner = ownerProps({ id: "tm-owner-2", userId: "owner-2" });
    const trip = buildTrip({ members: membersOf(ownerProps(), secondOwner) });

    expect(() => trip.removeMember(OWNER_ID, "tm-owner")).toThrow(
      CannotRemoveSelfError,
    );
  });

  it("succeeds removing an Owner when another Accepted Owner remains", () => {
    const secondOwner = ownerProps({ id: "tm-owner-2", userId: "owner-2" });
    const trip = buildTrip({ members: membersOf(ownerProps(), secondOwner) });

    expect(() => trip.removeMember(OWNER_ID, "tm-owner-2")).not.toThrow();
    expect(trip.members.find((m) => m.id === "tm-owner-2")?.status).toBe(
      "Removed",
    );
  });

  it("is idempotent when the target is already Removed", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Removed" })),
    });

    expect(() => trip.removeMember(OWNER_ID, "tm-member")).not.toThrow();
    expect(trip.members.find((m) => m.id === "tm-member")?.status).toBe(
      "Removed",
    );
  });

  it("successfully removes an Invited (not yet accepted) Owner", () => {
    const invitedOwner = ownerProps({
      id: "tm-owner-2",
      userId: "owner-2",
      status: "Invited",
    });
    const trip = buildTrip({ members: membersOf(ownerProps(), invitedOwner) });

    expect(() => trip.removeMember(OWNER_ID, "tm-owner-2")).not.toThrow();
    expect(trip.members.find((m) => m.id === "tm-owner-2")?.status).toBe(
      "Removed",
    );
  });
});

describe("Trip — changeMemberRole", () => {
  it("updates the role of an Invited or an Accepted target", () => {
    const invitedTrip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });
    const acceptedTrip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });

    invitedTrip.changeMemberRole(OWNER_ID, "tm-member", "Editor");
    acceptedTrip.changeMemberRole(OWNER_ID, "tm-member", "Editor");

    expect(invitedTrip.members.find((m) => m.id === "tm-member")?.role).toBe(
      "Editor",
    );
    expect(acceptedTrip.members.find((m) => m.id === "tm-member")?.role).toBe(
      "Editor",
    );
  });

  it("throws InvalidMemberStatusTransitionError for a Declined target", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Declined" })),
    });
    expect(() =>
      trip.changeMemberRole(OWNER_ID, "tm-member", "Editor"),
    ).toThrow(InvalidMemberStatusTransitionError);
  });

  it("throws InvalidMemberStatusTransitionError for a Removed target", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Removed" })),
    });
    expect(() =>
      trip.changeMemberRole(OWNER_ID, "tm-member", "Editor"),
    ).toThrow(InvalidMemberStatusTransitionError);
  });

  it("throws CannotRemoveLastOwnerError when demoting the sole Accepted Owner", () => {
    const trip = buildTrip();
    expect(() =>
      trip.changeMemberRole(OWNER_ID, "tm-owner", "Editor" as TripMemberRole),
    ).toThrow(CannotRemoveLastOwnerError);
  });

  it("allows promoting an Accepted Member to Owner (co-organizer)", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });

    trip.changeMemberRole(OWNER_ID, "tm-member", "Owner");

    expect(trip.members.find((m) => m.id === "tm-member")?.role).toBe("Owner");
    expect(
      trip.members.filter((m) => m.isOwner() && m.isAccepted()),
    ).toHaveLength(2);
  });

  it("is idempotent when changing to the same role", () => {
    const trip = buildTrip();
    expect(() =>
      trip.changeMemberRole(OWNER_ID, "tm-owner", "Owner"),
    ).not.toThrow();
    expect(trip.members.find((m) => m.id === "tm-owner")?.role).toBe("Owner");
  });

  it("does not trigger the last-owner protection when demoting an Invited (not yet accepted) Owner", () => {
    const invitedOwner = ownerProps({
      id: "tm-owner-2",
      userId: "owner-2",
      status: "Invited",
    });
    const trip = buildTrip({ members: membersOf(ownerProps(), invitedOwner) });

    expect(() =>
      trip.changeMemberRole(OWNER_ID, "tm-owner-2", "Member"),
    ).not.toThrow();
    expect(trip.members.find((m) => m.id === "tm-owner-2")?.role).toBe(
      "Member",
    );
  });
});

describe("Trip — leave", () => {
  it("transitions the caller to Removed", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Accepted" })),
    });
    trip.leave(MEMBER_ID);
    expect(trip.members.find((m) => m.userId === MEMBER_ID)?.status).toBe(
      "Removed",
    );
  });

  it("throws InvalidMemberStatusTransitionError when the caller is not Accepted", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });
    expect(() => trip.leave(MEMBER_ID)).toThrow(
      InvalidMemberStatusTransitionError,
    );
  });

  it("throws CannotRemoveLastOwnerError when the caller is the sole Accepted Owner", () => {
    const trip = buildTrip();
    expect(() => trip.leave(OWNER_ID)).toThrow(CannotRemoveLastOwnerError);
  });

  it("throws TripNotFoundError when the caller has no membership row", () => {
    const trip = buildTrip();
    expect(() => trip.leave("stranger-1")).toThrow(TripNotFoundError);
  });
});

describe("Trip — defensive copies and mappings", () => {
  it("members getter returns a new shallow copy on every call", () => {
    const trip = buildTrip();
    const firstRead = trip.members as TripMember[];
    firstRead.push(TripMember.fromPersistence(memberProps()));

    expect(trip.members).toHaveLength(1);
  });

  it("createdAt and updatedAt getters return defensive copies", () => {
    const trip = buildTrip();

    const createdAt = trip.createdAt;
    createdAt.setFullYear(1999);
    const updatedAt = trip.updatedAt;
    updatedAt.setFullYear(1999);

    expect(trip.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(trip.updatedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("deletedAt getter returns a defensive copy", () => {
    const trip = buildTrip({ deletedAt: new Date("2026-02-01T00:00:00.000Z") });

    const firstRead = trip.deletedAt;
    firstRead?.setFullYear(1999);

    expect(trip.deletedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });

  it("fromPersistence() protects createdAt, updatedAt and deletedAt against external mutation", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-05T00:00:00.000Z");
    const deletedAt = new Date("2026-02-01T00:00:00.000Z");
    const trip = buildTrip({ createdAt, updatedAt, deletedAt });

    createdAt.setFullYear(1999);
    updatedAt.setFullYear(1999);
    deletedAt.setFullYear(1999);

    expect(trip.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(trip.updatedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
    expect(trip.deletedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });

  it("fromPersistence() protects the aggregate against later mutation of the input members array", () => {
    const members = membersOf(ownerProps());
    const trip = buildTrip({ members });

    members.push(TripMember.fromPersistence(memberProps()));

    expect(trip.members).toHaveLength(1);
  });

  it("toDetails(callerId) returns the expected shape", () => {
    const trip = buildTrip({
      dateRange: TripDateRange.create(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-10T00:00:00.000Z"),
      ),
    });

    const details = trip.toDetails(OWNER_ID);

    expect(details.id).toBe("trip-1");
    expect(details.name).toBe("Summer trip");
    expect(details.startDate).toBe("2026-06-01");
    expect(details.endDate).toBe("2026-06-10");
    expect(details.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(details.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(details.members).toHaveLength(1);
  });

  it("toDetails(callerId) populates callerRole and callerStatus from the caller's own row", () => {
    const trip = buildTrip({ members: membersOf(ownerProps(), editorProps()) });

    const details = trip.toDetails(EDITOR_ID);

    expect(details.callerRole).toBe("Editor");
    expect(details.callerStatus).toBe("Accepted");
  });

  it("toDetails(callerId) throws TripNotFoundError for an absent, Declined or Removed caller", () => {
    const declinedTrip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Declined" })),
    });
    const removedTrip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Removed" })),
    });

    expect(() => declinedTrip.toDetails("stranger-1")).toThrow(
      TripNotFoundError,
    );
    expect(() => declinedTrip.toDetails(MEMBER_ID)).toThrow(TripNotFoundError);
    expect(() => removedTrip.toDetails(MEMBER_ID)).toThrow(TripNotFoundError);
  });

  it("toDetails(callerId) throws TripNotFoundError when the trip is soft-deleted", () => {
    const trip = buildTrip({ deletedAt: new Date("2026-02-01T00:00:00.000Z") });
    expect(() => trip.toDetails(OWNER_ID)).toThrow(TripNotFoundError);
  });

  it("toSummary(callerId) returns callerRole and callerStatus matching the caller's own row", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });

    const summary = trip.toSummary(MEMBER_ID);

    expect(summary.callerRole).toBe("Member");
    expect(summary.callerStatus).toBe("Invited");
  });

  it("toSummary(callerId) throws TripNotFoundError when the caller has no membership row", () => {
    const trip = buildTrip();
    expect(() => trip.toSummary("stranger-1")).toThrow(TripNotFoundError);
  });

  it("toSummary(callerId) throws TripNotFoundError when the trip is soft-deleted", () => {
    const trip = buildTrip({ deletedAt: new Date("2026-02-01T00:00:00.000Z") });
    expect(() => trip.toSummary(OWNER_ID)).toThrow(TripNotFoundError);
  });

  it("updatedAt exposed by toDetails/toSummary is never altered by in-memory mutations", () => {
    const trip = buildTrip({
      members: membersOf(ownerProps(), memberProps({ status: "Invited" })),
    });
    const originalUpdatedAt = trip.updatedAt;

    jest.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    trip.updateDetails(OWNER_ID, { name: "Renamed trip" });
    trip.archive(OWNER_ID);
    trip.acceptInvitation(MEMBER_ID);

    expect(trip.updatedAt).toEqual(originalUpdatedAt);
    expect(trip.toDetails(OWNER_ID).updatedAt).toBe(
      originalUpdatedAt.toISOString(),
    );
  });
});
