import pypdf
import sys

pdf_path = r"C:\Users\Ace\.gemini\antigravity\brain\1b01b64c-6b31-4d10-a765-fcb7ef57f509\.user_uploaded\media_1794462315678_2f794efa.pdf"
reader = pypdf.PdfReader(pdf_path)
print(f"Pages: {len(reader.pages)}")
page = reader.pages[0]
print(f"MediaBox: {page.mediabox}")
text = page.extract_text()
print(f"Extracted text length: {len(text)}")
print("--- Extracted text snippet ---")
print(repr(text))

# Also extract text with visitor
visitor_texts = []
def visitor_body(text, cm, tm, fontDict, fontSize):
    if text.strip():
        visitor_texts.append((text, tm, cm, fontSize))

page.extract_text(visitor_text=visitor_body)
print(f"Visitor text count: {len(visitor_texts)}")
for t, tm, cm, fs in visitor_texts[:50]:
    print(f"text: {repr(t)}, tm: {tm}, fs: {fs}")
