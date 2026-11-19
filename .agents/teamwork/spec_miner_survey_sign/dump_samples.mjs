import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

const outDir = path.resolve(".agents/teamwork/spec_miner_survey_sign/samples");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function savePdf(raw, outPath) {
  let buf;
  if (raw.startsWith("data:")) {
    const b64 = raw.split(",")[1];
    buf = Buffer.from(b64, "base64");
  } else if (/^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 100))) {
    buf = Buffer.from(raw, "base64");
  } else {
    buf = Buffer.from(raw, "binary");
  }
  fs.writeFileSync(outPath, buf);
  console.log(`Saved ${outPath} (${buf.length} bytes)`);
}

async function run() {
  const ids = [
    { id: "doc-upload-1794895680225-38-cjzs", name: "sta_elena.pdf" },
    { id: "doc-upload-1794895680225-39-0k4l", name: "labo_signed.pdf" },
    { id: "doc-upload-1794895680225-40-8ny3", name: "irosin.pdf" }
  ];

  for (const item of ids) {
    const res = await client.execute({
      sql: "SELECT id, file_name, status, pdf_data FROM signing_workspace_documents WHERE id = ?",
      args: [item.id]
    });
    if (res.rows.length > 0 && res.rows[0].pdf_data) {
      savePdf(res.rows[0].pdf_data, path.join(outDir, item.name));
    } else {
      console.log(`No pdf data for ${item.id}`);
    }
  }
}

run().catch(console.error);
