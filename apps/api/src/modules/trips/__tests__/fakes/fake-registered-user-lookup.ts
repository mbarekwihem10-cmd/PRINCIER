import type { RegisteredUserLookupPort } from "../../domain/ports/registered-user-lookup.port";

export class FakeRegisteredUserLookup implements RegisteredUserLookupPort {
  private readonly registeredUserIds: Set<string>;

  constructor(registeredUserIds: readonly string[] = []) {
    this.registeredUserIds = new Set(registeredUserIds);
  }

  existsById(userId: string): Promise<boolean> {
    return Promise.resolve(this.registeredUserIds.has(userId));
  }
}
