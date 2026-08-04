import type {
  TripDetails,
  TripMemberRole,
  TripStatus,
  TripSummary,
} from "@tripplanner/shared-types";

import { CannotRemoveLastOwnerError } from "../cannot-remove-last-owner.error";
import { CannotRemoveSelfError } from "../cannot-remove-self.error";
import { DuplicateTripMemberError } from "../duplicate-trip-member.error";
import { InsufficientTripRoleError } from "../insufficient-trip-role.error";
import { InvalidMemberStatusTransitionError } from "../invalid-member-status-transition.error";
import { TripMemberNotFoundError } from "../trip-member-not-found.error";
import { TripNotFoundError } from "../trip-not-found.error";
import type { TripDateRange } from "../value-objects/trip-date-range.value-object";

import { TripMember } from "./trip-member.entity";

export interface UpdateTripData {
  readonly name?: string;
  readonly description?: string | null;
  readonly destination?: string | null;
  readonly dateRange?: TripDateRange;
  readonly baseCurrency?: string;
}

export interface TripProps {
  readonly id: string;
  name: string;
  description: string | null;
  destination: string | null;
  dateRange: TripDateRange;
  baseCurrency: string;
  status: TripStatus;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  deletedAt: Date | null;
  members: TripMember[];
}

export class Trip {
  private constructor(private readonly props: TripProps) {}

  static fromPersistence(props: TripProps): Trip {
    return new Trip({
      ...props,
      createdAt: new Date(props.createdAt.getTime()),
      updatedAt: new Date(props.updatedAt.getTime()),
      deletedAt: props.deletedAt ? new Date(props.deletedAt.getTime()) : null,
      members: [...props.members],
    });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get destination(): string | null {
    return this.props.destination;
  }

  get dateRange(): TripDateRange {
    return this.props.dateRange;
  }

  get baseCurrency(): string {
    return this.props.baseCurrency;
  }

  get status(): TripStatus {
    return this.props.status;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt.getTime());
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt
      ? new Date(this.props.deletedAt.getTime())
      : null;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  get members(): readonly TripMember[] {
    return [...this.props.members];
  }

  assertViewableBy(userId: string): void {
    this.assertNotDeleted();
    this.requireActiveMember(userId);
  }

  assertEditableBy(userId: string): void {
    this.assertNotDeleted();
    const member = this.requireActiveMember(userId);
    if (
      !member.isAccepted() ||
      (member.role !== "Owner" && member.role !== "Editor")
    ) {
      throw new InsufficientTripRoleError(this.props.id);
    }
  }

  assertManageableBy(userId: string): void {
    this.assertNotDeleted();
    const member = this.requireActiveMember(userId);
    if (!member.isAccepted() || !member.isOwner()) {
      throw new InsufficientTripRoleError(this.props.id);
    }
  }

  updateDetails(actorId: string, data: UpdateTripData): void {
    this.assertEditableBy(actorId);
    if (data.name !== undefined) {
      this.props.name = data.name;
    }
    if (data.description !== undefined) {
      this.props.description = data.description;
    }
    if (data.destination !== undefined) {
      this.props.destination = data.destination;
    }
    if (data.dateRange !== undefined) {
      this.props.dateRange = data.dateRange;
    }
    if (data.baseCurrency !== undefined) {
      this.props.baseCurrency = data.baseCurrency;
    }
  }

  archive(actorId: string): void {
    this.assertManageableBy(actorId);
    this.props.status = "Archived";
  }

  markDeleted(actorId: string): void {
    this.requireAcceptedOwner(actorId);

    if (this.props.deletedAt !== null) {
      return;
    }

    this.props.deletedAt = new Date();
  }

  assertCanInviteMember(actorId: string, targetUserId: string): void {
    this.assertManageableBy(actorId);
    const existing = this.findMember(targetUserId);
    if (
      existing &&
      (existing.status === "Invited" || existing.status === "Accepted")
    ) {
      throw new DuplicateTripMemberError(this.props.id);
    }
  }

  acceptInvitation(userId: string): void {
    this.assertNotDeleted();
    const member = this.requireMember(userId);
    if (member.status !== "Invited") {
      throw new InvalidMemberStatusTransitionError(member.id);
    }
    this.replaceMember(member.withStatus("Accepted", new Date()));
  }

  declineInvitation(userId: string): void {
    this.assertNotDeleted();
    const member = this.requireMember(userId);
    if (member.status !== "Invited") {
      throw new InvalidMemberStatusTransitionError(member.id);
    }
    this.replaceMember(member.withStatus("Declined", null));
  }

  removeMember(actorId: string, memberId: string): void {
    this.assertManageableBy(actorId);
    const target = this.requireMemberById(memberId);
    if (target.userId === actorId) {
      throw new CannotRemoveSelfError(this.props.id);
    }
    if (target.status === "Removed") {
      return;
    }
    this.replaceMember(target.withStatus("Removed", null));
  }

  changeMemberRole(
    actorId: string,
    memberId: string,
    newRole: TripMemberRole,
  ): void {
    this.assertManageableBy(actorId);
    const target = this.requireMemberById(memberId);
    if (target.status !== "Invited" && target.status !== "Accepted") {
      throw new InvalidMemberStatusTransitionError(memberId);
    }
    if (target.role === newRole) {
      return;
    }
    if (
      target.isOwner() &&
      target.isAccepted() &&
      newRole !== "Owner" &&
      this.countAcceptedOwners() <= 1
    ) {
      throw new CannotRemoveLastOwnerError(this.props.id);
    }
    this.replaceMember(target.withRole(newRole));
  }

  leave(userId: string): void {
    this.assertNotDeleted();
    const member = this.requireMember(userId);
    if (!member.isAccepted()) {
      throw new InvalidMemberStatusTransitionError(member.id);
    }
    if (member.isOwner() && this.countAcceptedOwners() <= 1) {
      throw new CannotRemoveLastOwnerError(this.props.id);
    }
    this.replaceMember(member.withStatus("Removed", null));
  }

  toDetails(callerId: string): TripDetails {
    this.assertNotDeleted();
    const caller = this.requireActiveMember(callerId);
    return {
      id: this.props.id,
      name: this.props.name,
      description: this.props.description,
      destination: this.props.destination,
      startDate: this.formatDateOnly(this.props.dateRange.startDate),
      endDate: this.formatDateOnly(this.props.dateRange.endDate),
      baseCurrency: this.props.baseCurrency,
      status: this.props.status,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      members: this.props.members.map((member) => member.toView()),
      callerRole: caller.role,
      callerStatus: caller.status,
    };
  }

  toSummary(callerId: string): TripSummary {
    this.assertNotDeleted();
    const caller = this.requireActiveMember(callerId);
    return {
      id: this.props.id,
      name: this.props.name,
      destination: this.props.destination,
      startDate: this.formatDateOnly(this.props.dateRange.startDate),
      endDate: this.formatDateOnly(this.props.dateRange.endDate),
      baseCurrency: this.props.baseCurrency,
      status: this.props.status,
      callerRole: caller.role,
      callerStatus: caller.status,
    };
  }

  private formatDateOnly(date: Date | null): string | null {
    return date ? date.toISOString().slice(0, 10) : null;
  }

  private assertNotDeleted(): void {
    if (this.props.deletedAt !== null) {
      throw new TripNotFoundError(this.props.id);
    }
  }

  private requireAcceptedOwner(userId: string): TripMember {
    const member = this.requireMember(userId);
    if (!member.isAccepted() || !member.isOwner()) {
      throw new InsufficientTripRoleError(this.props.id);
    }
    return member;
  }

  private findMember(userId: string): TripMember | undefined {
    return this.props.members.find((member) => member.userId === userId);
  }

  private findMemberById(memberId: string): TripMember | undefined {
    return this.props.members.find((member) => member.id === memberId);
  }

  private requireMember(userId: string): TripMember {
    const member = this.findMember(userId);
    if (!member) {
      throw new TripNotFoundError(this.props.id);
    }
    return member;
  }

  private requireMemberById(memberId: string): TripMember {
    const member = this.findMemberById(memberId);
    if (!member) {
      throw new TripMemberNotFoundError(memberId);
    }
    return member;
  }

  private requireActiveMember(userId: string): TripMember {
    const member = this.requireMember(userId);
    if (member.status !== "Invited" && member.status !== "Accepted") {
      throw new TripNotFoundError(this.props.id);
    }
    return member;
  }

  private countAcceptedOwners(): number {
    return this.props.members.filter(
      (member) => member.isOwner() && member.isAccepted(),
    ).length;
  }

  private replaceMember(updated: TripMember): void {
    this.props.members = this.props.members.map((member) =>
      member.id === updated.id ? updated : member,
    );
  }
}
