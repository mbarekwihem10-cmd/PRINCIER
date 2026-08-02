import type { User } from "../entities/user.entity";

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
