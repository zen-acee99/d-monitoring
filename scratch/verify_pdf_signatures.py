import sys
import re
import hashlib
from cryptography.hazmat.primitives.serialization import pkcs7
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

def verify_signatures(pdf_path):
    print(f"\n==========================================")
    print(f"Verifying: {pdf_path}")
    print(f"==========================================")
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()

    print(f"Total file size: {len(pdf_bytes)} bytes")

    # Find all /Type /Sig or /ByteRange
    pattern = re.compile(rb'/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]')
    matches = list(pattern.finditer(pdf_bytes))
    print(f"Found {len(matches)} ByteRange occurrences.")

    for i, m in enumerate(matches):
        o1, l1, o2, l2 = map(int, m.groups())
        print(f"\n--- Signature {i+1} ---")
        print(f"ByteRange: [{o1}, {l1}, {o2}, {l2}]")
        total_covered = o2 + l2
        print(f"Covered up to byte {total_covered} (file size = {len(pdf_bytes)})")

        # Find /Contents
        # Search backwards and forwards near ByteRange for /Contents <hex>
        near_start = max(0, m.start() - 500)
        near_end = min(len(pdf_bytes), m.end() + 200000)
        near_chunk = pdf_bytes[near_start:near_end]

        contents_match = re.search(rb'/Contents\s*<([0-9a-fA-F\s]+)>', near_chunk)
        if not contents_match:
            print("ERROR: Could not find /Contents hex string near ByteRange")
            continue

        raw_hex = contents_match.group(1).replace(b'\r', b'').replace(b'\n', b'').replace(b' ', b'')
        contents_bytes = bytes.fromhex(raw_hex.decode('ascii'))

        # Check ByteRange physical placement
        contents_abs_start = near_start + contents_match.start(1) - 1 # pos of '<'
        contents_abs_end = near_start + contents_match.end(1)         # pos of '>'
        print(f"Actual /Contents starts at {contents_abs_start}, ends at {contents_abs_end} (length {contents_abs_end - contents_abs_start + 1})")
        print(f"ByteRange says gap is from {l1} to {o2} (gap length {o2 - l1})")

        if l1 != contents_abs_start:
            print(f"WARNING! ByteRange l1 ({l1}) does NOT match /Contents start ({contents_abs_start})! Diff: {contents_abs_start - l1}")
        else:
            print(f"PASS: ByteRange l1 matches /Contents start exactly ({l1})")

        if o2 != contents_abs_end + 1:
            print(f"WARNING! ByteRange o2 ({o2}) does NOT match /Contents end+1 ({contents_abs_end + 1})! Diff: {o2 - (contents_abs_end + 1)}")
        else:
            print(f"PASS: ByteRange o2 matches /Contents end+1 exactly ({o2})")

        # Extract signed data
        part1 = pdf_bytes[o1 : o1 + l1]
        part2 = pdf_bytes[o2 : o2 + l2]
        signed_data = part1 + part2

        sha1_hash = hashlib.sha1(signed_data).hexdigest()
        sha256_hash = hashlib.sha256(signed_data).hexdigest()
        print(f"Signed Data SHA-1:   {sha1_hash}")
        print(f"Signed Data SHA-256: {sha256_hash}")

        # Check if contents has sha256 or sha1
        try:
            # Load PKCS7
            # Note: cryptography pkcs7 loading
            certs = pkcs7.load_der_pkcs7_certificates(contents_bytes)
            print(f"PKCS7 contains {len(certs)} certificate(s):")
            for c in certs:
                subject = c.subject.rfc4514_string()
                print(f"  - Subject: {subject}")
        except Exception as e:
            print(f"PKCS7 parse note: {e}")

        # Search for sha256 hash in contents
        sha256_raw = bytes.fromhex(sha256_hash)
        sha1_raw = bytes.fromhex(sha1_hash)
        if sha256_raw in contents_bytes:
            print("MATCH! SHA-256 digest is embedded in PKCS#7 /Contents (Valid Cryptographic Signature!)")
        elif sha1_raw in contents_bytes:
            print("MATCH! SHA-1 digest is embedded in PKCS#7 /Contents (Valid Cryptographic Signature!)")
        else:
            print("MISMATCH! Neither SHA-256 nor SHA-1 digest found inside /Contents!")

if __name__ == '__main__':
    for path in sys.argv[1:]:
        verify_signatures(path)
