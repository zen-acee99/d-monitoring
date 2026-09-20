import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, X } from "lucide-react";

interface DtrSignatureValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  signerName?: string;
  signatureDate?: string;
  certificateIssuer?: string;
  certificateValidity?: string;
}

export const DtrSignatureValidationModal: React.FC<DtrSignatureValidationModalProps> = ({
  isOpen,
  onClose,
  signerName = "Malto Ace Mata",
  signatureDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  certificateIssuer = "DICT Philippine National Public Key Infrastructure (PNPKI)",
  certificateValidity = "Valid until 2028-08-31",
}) => {
  const [showProperties, setShowProperties] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
      {/* Classic Adobe Acrobat Native Window Frame */}
      <div className="bg-[#ECE9D8] sm:bg-[#F0F0F0] text-black border border-[#7F9DB9] rounded-sm shadow-2xl w-full max-w-[530px] font-sans text-[12px] overflow-hidden">
        
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#FFFFFF] to-[#E3E3E3] border-b border-[#D0D0D0] px-3 py-1.5 flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-[12px]">
            Signature Validation Status
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-red-600 hover:bg-red-100 p-0.5 rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body Matching Image 2 */}
        <div className="p-5 bg-white space-y-4">
          <div className="flex items-start gap-3.5">
            {/* Warning / Caution Icon exactly like Adobe Acrobat */}
            <div className="mt-0.5 shrink-0">
              <div className="w-7 h-7 rounded-sm flex items-center justify-center bg-amber-50 border border-amber-300 shadow-2xs">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            {/* Validation Text Clauses */}
            <div className="space-y-1.5 leading-relaxed text-slate-900 text-[12px]">
              <div className="font-bold text-[13px] text-slate-950">
                Signature validity is UNKNOWN.
              </div>
              <ul className="space-y-1 text-slate-800">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold">-</span>
                  <span>The document has not been modified since this signature was applied.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold">-</span>
                  <span>
                    The signer's identity is unknown because it has not been included in your list of trusted certificates and none of its parent certificates are trusted certificates.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Expanded Signature Properties Drawer */}
          {showProperties && (
            <div className="mt-3 p-3 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-2 animate-in fade-in">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Certificate & Cryptographic Details</span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-[10.5px]">
                <span className="text-slate-500">Signer Name:</span>
                <span className="col-span-2 font-bold text-slate-900">{signerName}</span>

                <span className="text-slate-500">Issuer:</span>
                <span className="col-span-2 text-slate-800">{certificateIssuer}</span>

                <span className="text-slate-500">Signing Date:</span>
                <span className="col-span-2 text-slate-800">{signatureDate}</span>

                <span className="text-slate-500">Validity:</span>
                <span className="col-span-2 text-emerald-700 font-semibold">{certificateValidity}</span>

                <span className="text-slate-500">Algorithm:</span>
                <span className="col-span-2 text-slate-800">SHA-256 with RSA (2048 bits)</span>

                <span className="text-slate-500">Filter / Sub:</span>
                <span className="col-span-2 text-slate-800">Adobe.PPKLite / adbe.pkcs7.detached</span>
              </div>
            </div>
          )}
        </div>

        {/* Buttons Bar Matching Image 2 */}
        <div className="bg-[#F0F0F0] border-t border-[#D9D9D9] px-4 py-2.5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setShowProperties(!showProperties)}
            className="px-3 py-1 bg-[#E1E1E1] hover:bg-[#D5D5D5] active:bg-[#CCCCCC] border border-[#ADADAD] text-slate-900 text-[11px] rounded-xs transition-colors cursor-pointer shadow-2xs"
          >
            {showProperties ? "Hide Properties..." : "Signature Properties..."}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1 bg-white hover:bg-blue-50 active:bg-blue-100 border border-[#0078D7] text-slate-900 text-[11px] font-medium rounded-xs transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};