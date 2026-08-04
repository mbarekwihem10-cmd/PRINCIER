import type { TripDetails } from "@tripplanner/shared-types";

import { InviteeNotRegisteredError } from "../../domain/invitee-not-registered.error";
import type { RegisteredUserLookupPort } from "../../domain/ports/registered-user-lookup.port";
import type { TripRepositoryPort } from "../../domain/ports/trip.repository.port";
import { TripNotFoundError } from "../../domain/trip-not-found.error";

export class InviteTripMemberUseCase {
  constructor(
    private readonly tripRepository: TripRepositoryPort,
    private readonly registeredUserLookup: RegisteredUserLookupPort,
  ) {}

  async execute(
    tripId: string,
    callerId: string,
    targetUserId: string,
  ): Promise<TripDetails> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    trip.assertCanInviteMember(callerId, targetUserId);

    const isRegistered =
      await this.registeredUserLookup.existsById(targetUserId);
    if (!isRegistered) {
      throw new InviteeNotRegisteredError(targetUserId);
    }

    const updated = await this.tripRepository.upsertMember(tripId, {
      userId: targetUserId,
      invitedBy: callerId,
      role: "Member",
    });
    return updated.toDetails(callerId);
  }
}
