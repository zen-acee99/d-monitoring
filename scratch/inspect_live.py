import pypdf

reader = pypdf.PdfReader('scratch/live_api_pass2.pdf')
print('Num pages:', len(reader.pages))
fields = reader.get_fields()
print('Form Fields:', list(fields.keys()) if fields else 'None')
if '/Root' in reader.trailer:
    root = reader.trailer['/Root']
    if '/AcroForm' in root:
        af = root['/AcroForm']
        print('AcroForm SigFlags:', af.get('/SigFlags'))
        print('AcroForm Fields count:', len(af.get('/Fields', [])))
print('Annots count on page 0:', len(reader.pages[0].get('/Annots', [])))
for idx, a in enumerate(reader.pages[0].get('/Annots', [])):
    obj = a.get_object()
    st = obj.get('/Subtype')
    t = obj.get('/T')
    rect = obj.get('/Rect')
    print(f'Annot {idx+1}: Subtype={st}, T={t}, Rect={rect}')
