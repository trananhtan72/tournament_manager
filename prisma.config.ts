import { defineConfig, env } from "prisma/config";

try {
  process.loadEnvFile();
} catch {
  // .env is optional (e.g. env vars provided by the platform instead)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
