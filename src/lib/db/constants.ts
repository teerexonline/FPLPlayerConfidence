/**
 * The single system-level user that owns all data in Phase 1.
 * Every repository call that requires a user_id receives this value until
 * real authentication is introduced in Phase 2.
 *
 * This value matches the row seeded by the SYSTEM_USER migration in schema.ts.
 */
export const SYSTEM_USER_ID = 1;
