export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenGeneratorPort {
  generateTokenPair(userId: string): TokenPair;
}

export const TOKEN_GENERATOR = Symbol("TOKEN_GENERATOR");
