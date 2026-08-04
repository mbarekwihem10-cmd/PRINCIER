import {
  TripMember,
  type TripMemberProps,
} from "../domain/entities/trip-member.entity";

function buildProps(overrides: Partial<TripMemberProps> = {}): TripMemberProps {
  return {
    id: "member-1",
    tripId: "trip-1",
    userId: "user-1",
    role: "Member",
    status: "Invited",
    invitedBy: "owner-1",
    joinedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("TripMember", () => {
  it("exposes all getters from fromPersistence", () => {
    const props = buildProps({
      joinedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const member = TripMember.fromPersistence(props);

    expect(member.id).toBe(props.id);
    expect(member.tripId).toBe(props.tripId);
    expect(member.userId).toBe(props.userId);
    expect(member.role).toBe(props.role);
    expect(member.status).toBe(props.status);
    expect(member.invitedBy).toBe(props.invitedBy);
    expect(member.joinedAt).toEqual(props.joinedAt);
    expect(member.createdAt).toEqual(props.createdAt);
  });

  it("isOwner() returns true only when role is Owner", () => {
    expect(
      TripMember.fromPersistence(buildProps({ role: "Owner" })).isOwner(),
    ).toBe(true);
    expect(
      TripMember.fromPersistence(buildProps({ role: "Editor" })).isOwner(),
    ).toBe(false);
    expect(
      TripMember.fromPersistence(buildProps({ role: "Member" })).isOwner(),
    ).toBe(false);
  });

  it("isAccepted() returns true only when status is Accepted", () => {
    expect(
      TripMember.fromPersistence(
        buildProps({ status: "Accepted" }),
      ).isAccepted(),
    ).toBe(true);
    expect(
      TripMember.fromPersistence(
        buildProps({ status: "Invited" }),
      ).isAccepted(),
    ).toBe(false);
    expect(
      TripMember.fromPersistence(
        buildProps({ status: "Declined" }),
      ).isAccepted(),
    ).toBe(false);
    expect(
      TripMember.fromPersistence(
        buildProps({ status: "Removed" }),
      ).isAccepted(),
    ).toBe(false);
  });

  it("withStatus() returns a new instance and leaves the original unchanged", () => {
    const original = TripMember.fromPersistence(
      buildProps({ status: "Invited", joinedAt: null }),
    );
    const joinedAt = new Date("2026-02-01T00:00:00.000Z");

    const updated = original.withStatus("Accepted", joinedAt);

    expect(updated).not.toBe(original);
    expect(updated.status).toBe("Accepted");
    expect(updated.joinedAt).toEqual(joinedAt);
    expect(original.status).toBe("Invited");
    expect(original.joinedAt).toBeNull();
  });

  it("withRole() returns a new instance and leaves the original unchanged", () => {
    const original = TripMember.fromPersistence(buildProps({ role: "Member" }));

    const updated = original.withRole("Owner");

    expect(updated).not.toBe(original);
    expect(updated.role).toBe("Owner");
    expect(original.role).toBe("Member");
  });

  it("returns a defensive copy from the joinedAt getter", () => {
    const joinedAt = new Date("2026-02-01T00:00:00.000Z");
    const member = TripMember.fromPersistence(buildProps({ joinedAt }));

    const firstRead = member.joinedAt;
    firstRead?.setFullYear(1999);

    expect(member.joinedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });

  it("returns a defensive copy from the createdAt getter", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const member = TripMember.fromPersistence(buildProps({ createdAt }));

    const firstRead = member.createdAt;
    firstRead.setFullYear(1999);

    expect(member.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("toView() produces the expected shape with ISO date strings and handles a null joinedAt", () => {
    const withJoinedAt = TripMember.fromPersistence(
      buildProps({
        joinedAt: new Date("2026-02-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );

    expect(withJoinedAt.toView()).toEqual({
      id: "member-1",
      tripId: "trip-1",
      userId: "user-1",
      role: "Member",
      status: "Invited",
      invitedBy: "owner-1",
      joinedAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const withoutJoinedAt = TripMember.fromPersistence(
      buildProps({ joinedAt: null }),
    );
    expect(withoutJoinedAt.toView().joinedAt).toBeNull();
  });

  it("fromPersistence() protects joinedAt and createdAt against external mutation of the input", () => {
    const joinedAt = new Date("2026-02-01T00:00:00.000Z");
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const member = TripMember.fromPersistence(
      buildProps({ joinedAt, createdAt }),
    );

    joinedAt.setFullYear(1999);
    createdAt.setFullYear(1999);

    expect(member.joinedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    expect(member.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("withStatus() protects its joinedAt parameter against external mutation after the call", () => {
    const original = TripMember.fromPersistence(buildProps());
    const joinedAt = new Date("2026-02-01T00:00:00.000Z");

    const updated = original.withStatus("Accepted", joinedAt);
    joinedAt.setFullYear(1999);

    expect(updated.joinedAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });
});
