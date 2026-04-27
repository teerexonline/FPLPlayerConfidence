import type { DbUser } from '../types';

export interface UserRepository {
  /** Returns the user with the given id, or null if none exists. */
  findById(id: number): DbUser | null;

  /** Returns all users ordered by id ascending. */
  listAll(): readonly DbUser[];
}
