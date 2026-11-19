import { readFileSync, writeFileSync } from "fs";
import { signPdfBuffer } from "../server/services/pnpkiSigningService";
import { spawnSync } from "child_process";
import path from "path";
import assert from "assert";

async function runTest(name: string, fn: () => Promise<void>) {
    console.log(`Running: ${name}`);
    try {
        await fn();
        console.log(`Passed: ${name}`);
    } catch (e) {
        console.error(`Failed: ${name}`, e);
        process.exit(1);
    }
}

async function main() {
    const SAMPLES_DIR = path.join(process.cwd(), ".agents/teamwork/spec_miner_survey_sign/samples");
    const SCRATCH_DIR = path.join(process.cwd(), "scratch");
    const P12_PATH = path.join(SCRATCH_DIR, "rene_jane.p12");
    const VERIFIER_PS1 = path.join(process.cwd(), "tests/adobe_acrobat_verifier.ps1");

    const p12Buffer = readFileSync(P12_PATH);
    const p12Base64 = p12Buffer.toString("base64");
    const password = "1234567890Aa!";

    await runTest("Successful signing of sta_elena.pdf", async () => {
        const pdfPath = path.join(SAMPLES_DIR, "sta_elena.pdf");
        const pdfBuffer = readFileSync(pdfPath);
        
        const { signedBuffer } = await signPdfBuffer(pdfBuffer, p12Base64, password, {
            signerName: "TEST SIGNER",
            sigRect: [100, 100, 200, 200]
        });

        const outputPath = path.join(SCRATCH_DIR, "signed_sta_elena.pdf");
        writeFileSync(outputPath, signedBuffer);

        const result = spawnSync("powershell", ["-File", VERIFIER_PS1, "-PdfPath", outputPath]);
        if (result.status !== 0) {
            console.log("Verifier stdout:", result.stdout.toString());
            console.log("Verifier stderr:", result.stderr.toString());
        }
        assert.strictEqual(result.status, 0, `Verifier failed for ${outputPath}. Status: ${result.status}`);
    });

    await runTest("Signing with special characters in name", async () => {
        const pdfPath = path.join(SAMPLES_DIR, "sta_elena.pdf");
        const pdfBuffer = readFileSync(pdfPath);
        
        const { signedBuffer } = await signPdfBuffer(pdfBuffer, p12Base64, password, {
            signerName: "ANNABEL C. ODOÑO-CALIMPONG",
            sigRect: [100, 100, 200, 200]
        });

        const outputPath = path.join(SCRATCH_DIR, "signed_special_chars.pdf");
        writeFileSync(outputPath, signedBuffer);

        const result = spawnSync("powershell", ["-File", VERIFIER_PS1, "-PdfPath", outputPath]);
        if (result.status !== 0) {
            console.log("Verifier stdout:", result.stdout.toString());
            console.log("Verifier stderr:", result.stderr.toString());
        }
        assert.strictEqual(result.status, 0, `Verifier failed for ${outputPath}. Status: ${result.status}`);
    });

    await runTest("Negative test: Invalid password", async () => {
        const pdfPath = path.join(SAMPLES_DIR, "sta_elena.pdf");
        const pdfBuffer = readFileSync(pdfPath);
        
        await assert.rejects(async () => {
            await signPdfBuffer(pdfBuffer, p12Base64, "wrongpassword", {
                signerName: "TEST SIGNER",
                sigRect: [100, 100, 200, 200]
            });
        }, "Should reject with wrong password");
    });
}

main().catch(console.error);
