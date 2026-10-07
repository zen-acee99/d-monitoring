import fs from "fs";

async function testSignApi() {
  const filePath = "test_signed_output.pdf";
  const buf = fs.readFileSync(filePath);
  const pdfBase64 = buf.toString("base64");

  const res = await fetch("http://localhost:3001/api/dtr-generator/sign-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdfBase64,
      user_Id: "usr-mu3eob3l",
      profileId: "dtr-sig-usr-mu3eob3l",
      reason: "Official Digital Signature - DICT Region V Signing Workspace",
      sigRect: [53, 304, 125, 28],
      pageIndex: 2,
    }),
  });

  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response data:", {
    success: data.success,
    signerName: data.signerName,
    error: data.error,
    hasSignedPdf: Boolean(data.signedPdfBase64),
  });
}

testSignApi();
