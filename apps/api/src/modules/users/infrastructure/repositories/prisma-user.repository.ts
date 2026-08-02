import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../common/prisma/prisma.service";
import { User } from "../../domain/entities/user.entity";
import type {
  CreateUserData,
  UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? User.fromPersistence(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    return record ? User.fromPersistence(record) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const record = await this.prisma.user.create({ data });
    return User.fromPersistence(record);
  }
}
