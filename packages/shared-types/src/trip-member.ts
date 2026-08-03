export type TripMemberRole = "Owner" | "Editor" | "Member";

export type TripMemberStatus = "Invited" | "Accepted" | "Declined" | "Removed";

export interface TripMemberView {
  id: string;
  tripId: string;
  userId: string;
  role: TripMemberRole;
  status: TripMemberStatus;
  invitedBy: string | null;
  joinedAt: string | null;
  createdAt: string;
}
