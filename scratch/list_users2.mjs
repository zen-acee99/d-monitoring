import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjIwNzI3NzA2OTIsImlhdCI6MTc4ODE2OTA5MywiaWQiOiIwMWEwNTcyZS0zZjAxLTcxNDQtYjZkYy02OTdlZDZkMDYwYWYiLCJraWQiOiJ1VGxTd29hMzMzZkpBdTR1ajhJYTB0NDFrN0hoazczbmNGMUQ2N0g3NCJ9.y7l3tC4W1-5F_l6rV9o_v91K-83v3S0Z306rB7G8wB-7_0c_mB46-R5W-vPqYw9L",
});

async function listUsers() {
  const res = await client.execute("SELECT id, name, email, role FROM users");
  console.log(`Total users in DB: ${res.rows.length}`);
  for (const r of res.rows) {
    console.log(`- ${r.name} (${r.role}) [${r.email}] id=${r.id}`);
  }
}

listUsers().catch(console.error);
