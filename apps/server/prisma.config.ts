import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use process.env directly since env() doesn't allow defaults
    // Provide a sensible default for development
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
});
