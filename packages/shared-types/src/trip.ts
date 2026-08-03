import type {
  TripMemberRole,
  TripMemberStatus,
  TripMemberView,
} from "./trip-member";

export type TripStatus = "Planning" | "Confirmed" | "Completed" | "Archived";

export interface TripSummary {
  id: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  baseCurrency: string;
  status: TripStatus;
  callerRole: TripMemberRole;
  callerStatus: TripMemberStatus;
}

export interface TripDetails {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  baseCurrency: string;
  status: TripStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: TripMemberView[];
}
