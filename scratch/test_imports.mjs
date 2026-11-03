import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import forge from 'node-forge';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { createClient } from '@libsql/client';

console.log('All core libraries imported successfully in Node ESM!');
