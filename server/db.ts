import { createClient, Client } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const db: Client = createClient({
  url,
  authToken,
});

export const isRemoteTurso = Boolean(
  url.startsWith("libsql://") || url.startsWith("https://")
);

export const dbConfig = {
  url: url.startsWith("libsql://") ? url.replace(/\/\/.*@/, "//***@") : url,
  isRemoteTurso,
};
