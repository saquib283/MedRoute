import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string | undefined {
  const directUrl = process.env.DATABASE_URL?.trim();
  if (directUrl) {
    return directUrl;
  }

  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USERNAME?.trim();
  const password = process.env.DB_PASSWORD?.trim();
  if (!host || !user || password === undefined) {
    return undefined;
  }

  const port = process.env.DB_PORT?.trim() || '3306';
  const rawDb = process.env.DB_DATABASE?.trim();
  const database = !rawDb || rawDb === 'sys' ? 'medroute' : rawDb;
  const needsStrictTls = host.includes('tidbcloud.com') || port === '4000';
  const query = needsStrictTls ? '?sslaccept=strict' : '';

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}${query}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaUrl: string | undefined;
};

const resolvedUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaUrl === resolvedUrl
    ? globalForPrisma.prisma
    : new PrismaClient({
        ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
        log:
          process.env.PRISMA_LOG_QUERIES === 'true'
            ? ['query', 'error', 'warn']
            : ['error'],
      });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = resolvedUrl;
}

export default prisma;
