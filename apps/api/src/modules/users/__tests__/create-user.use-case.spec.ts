import { CreateUserUseCase } from "../application/use-cases/create-user.use-case";
import { EmailAlreadyUsedError } from "../domain/email-already-used.error";
import { User } from "../domain/entities/user.entity";
import type {
  CreateUserData,
  UserRepositoryPort,
} from "../domain/ports/user-repository.port";

class InMemoryUserRepository implements UserRepositoryPort {
  private users: User[] = [];

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(
      this.users.find((user) => user.email === email) ?? null,
    );
  }

  create(data: CreateUserData): Promise<User> {
    const user = User.fromPersistence({
      id: String(this.users.length + 1),
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.push(user);
    return Promise.resolve(user);
  }
}

describe("CreateUserUseCase", () => {
  it("creates a new user and returns its public profile", async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new CreateUserUseCase(repository);

    const profile = await useCase.execute({
      email: "julie@example.com",
      passwordHash: "hashed",
      firstName: "Julie",
      lastName: "Martin",
    });

    expect(typeof profile.id).toBe("string");
    expect(profile).toMatchObject({
      email: "julie@example.com",
      firstName: "Julie",
      lastName: "Martin",
    });
  });

  it("rejects a duplicate email", async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new CreateUserUseCase(repository);

    await useCase.execute({
      email: "julie@example.com",
      passwordHash: "hashed",
      firstName: "Julie",
      lastName: "Martin",
    });

    await expect(
      useCase.execute({
        email: "julie@example.com",
        passwordHash: "hashed2",
        firstName: "Julie",
        lastName: "Duplicate",
      }),
    ).rejects.toThrow(EmailAlreadyUsedError);
  });
});
