export const REGISTERED_USER_LOOKUP = Symbol("REGISTERED_USER_LOOKUP");

export interface RegisteredUserLookupPort {
  existsById(userId: string): Promise<boolean>;
}
