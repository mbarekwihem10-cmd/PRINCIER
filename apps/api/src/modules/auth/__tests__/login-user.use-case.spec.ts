import type { UsersService } from "../../users/application/users.service";
import { LoginUserUseCase } from "../application/use-cases/login-user.use-case";
import { InvalidCredentialsError } from "../domain/invalid-credentials.error";
import type { PasswordHasherPort } from "../domain/ports/password-hasher.port";
import type {
  TokenGeneratorPort,
  TokenPair,
} from "../domain/ports/token-generator.port";

describe("LoginUserUseCase", () => {
  const fakeCredentials = {
    id: "user-1",
    email: "julie@example.com",
    passwordHash: "hashed",
  };

  function buildUseCase(passwordMatches: boolean): {
    useCase: LoginUserUseCase;
    tokenPair: TokenPair;
  } {
    const usersService = {
      findCredentialsByEmail: jest.fn().mockResolvedValue(fakeCredentials),
    } as unknown as UsersService;

    const passwordHasher: PasswordHasherPort = {
      hash: jest.fn(),
      verify: jest.fn().mockResolvedValue(passwordMatches),
    };

    const tokenPair: TokenPair = {
      accessToken: "access",
      refreshToken: "refresh",
    };
    const tokenGenerator: TokenGeneratorPort = {
      generateTokenPair: jest.fn().mockReturnValue(tokenPair),
    };

    return {
      useCase: new LoginUserUseCase(
        usersService,
        passwordHasher,
        tokenGenerator,
      ),
      tokenPair,
    };
  }

  it("returns a token pair when credentials are valid", async () => {
    const { useCase, tokenPair } = buildUseCase(true);

    const result = await useCase.execute({
      email: "julie@example.com",
      password: "correct-password",
    });

    expect(result).toEqual(tokenPair);
  });

  it("rejects an invalid password", async () => {
    const { useCase } = buildUseCase(false);

    await expect(
      useCase.execute({
        email: "julie@example.com",
        password: "wrong-password",
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
