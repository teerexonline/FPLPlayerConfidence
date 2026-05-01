import 'server-only';
import postgres from 'postgres';

// Transaction-mode pooler (port 6543) requires prepare:false — prepared statements
// are not supported across pooler connections.
function createPostgresClient(): postgres.Sql {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');
  return postgres(url, { prepare: false });
}

declare global {
  var __pgClient: postgres.Sql | undefined;
}

export function getPostgresClient(): postgres.Sql {
  if (process.env.NODE_ENV === 'production') {
    return createPostgresClient();
  }
  // In development, reuse a module-level singleton to avoid exhausting the
  // connection pool across hot-reloads.
  global.__pgClient ??= createPostgresClient();
  return global.__pgClient;
}
