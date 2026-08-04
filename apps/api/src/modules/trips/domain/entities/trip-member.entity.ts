import type {
  TripMemberRole,
  TripMemberStatus,
  TripMemberView,
} from "@tripplanner/shared-types";

export interface TripMemberProps {
  readonly id: string;
  readonly tripId: string;
  readonly userId: string;
  readonly role: TripMemberRole;
  readonly status: TripMemberStatus;
  readonly invitedBy: string | null;
  readonly joinedAt: Date | null;
  readonly createdAt: Date;
}

export class TripMember {
  private constructor(private readonly props: TripMemberProps) {}

  static fromPersistence(props: TripMemberProps): TripMember {
    return new TripMember({
      ...props,
      joinedAt: props.joinedAt ? new Date(props.joinedAt.getTime()) : null,
      createdAt: new Date(props.createdAt.getTime()),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get tripId(): string {
    return this.props.tripId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get role(): TripMemberRole {
    return this.props.role;
  }

  get status(): TripMemberStatus {
    return this.props.status;
  }

  get invitedBy(): string | null {
    return this.props.invitedBy;
  }

  get joinedAt(): Date | null {
    return this.props.joinedAt ? new Date(this.props.joinedAt.getTime()) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt.getTime());
  }

  isOwner(): boolean {
    return this.props.role === "Owner";
  }

  isAccepted(): boolean {
    return this.props.status === "Accepted";
  }

  withStatus(status: TripMemberStatus, joinedAt: Date | null): TripMember {
    return new TripMember({
      ...this.props,
      status,
      joinedAt: joinedAt ? new Date(joinedAt.getTime()) : null,
    });
  }

  withRole(role: TripMemberRole): TripMember {
    return new TripMember({ ...this.props, role });
  }

  toView(): TripMemberView {
    return {
      id: this.props.id,
      tripId: this.props.tripId,
      userId: this.props.userId,
      role: this.props.role,
      status: this.props.status,
      invitedBy: this.props.invitedBy,
      joinedAt: this.props.joinedAt ? this.props.joinedAt.toISOString() : null,
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}
