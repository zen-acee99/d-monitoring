import { db } from "./server/db";

async function main() {
    const res = await db.execute("SELECT * FROM dtr_generator WHERE Name LIKE '%Rene Jane%'");
    console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
