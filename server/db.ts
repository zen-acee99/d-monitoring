import { createClient, Client } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const url =
  process.env.TURSO_DATABASE_URL ||
  "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io";
const authToken =
  process.env.TURSO_AUTH_TOKEN ||
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjIwNzI3NzA2OTIsImlhdCI6MTc4ODE2OTA5MywiaWQiOiIwMWEwNTcyZS0zZjAxLTcxNDQtYjZkYy02OTdlZDZkMDYwYWYiLCJraWQiOiJ1VGxTd29hMzMzZkpBdTR1ajhJYTB0NDFrN0hoazczbmNGMUQxNXRsTDNBIiwicmlkIjoiMjQzYTEyY2UtNDgzNi00MGNiLTk0MDAtMjA2MDc2MGQ0NWQ2In0.dASX0AvMtRm-kTMKc0l8vcb5xwo2HzBi2EsOG9SpGxRibExgcCrtQf3Avp9BeOwrcZZUroCk7ZpaDLE28M45Cw";

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
