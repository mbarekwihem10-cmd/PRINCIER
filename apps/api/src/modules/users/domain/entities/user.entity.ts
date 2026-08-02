import type { UserProfile } from "@tripplanner/shared-types";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  toProfile(): UserProfile {
    return {
      id: this.props.id,
      email: this.props.email,
      firstName: this.props.firstName,
      lastName: this.props.lastName,
    };
  }
}
