import React, { useState, useEffect, useRef } from "react";
import { 
  Link as LinkIcon, 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Trash2, 
  BarChart2, 
  Sparkles,
  Shield,
  Wifi,
  Building2,
  Globe
} from "lucide-react";
import QRCode from "qrcode";

interface ShortenedUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  badge: "none" | "dict" | "pnpki" | "wifi";
  clicks: number;
  createdAt: string;
  qrDataUrl?: string;
}

export function UrlShortener() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [selectedBadge, setSelectedBadge] = useState<"none" | "dict" | "pnpki" | "wifi">("none");
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [activeShortUrl, setActiveShortUrl] = useState<string>("https://dict.gov.ph/s/preview");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local storage persisted URLs
  const [recentUrls, setRecentUrls] = useState<ShortenedUrl[]>(() => {
    try {
      const saved = localStorage.getItem("dict_shortened_urls");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("dict_shortened_urls", JSON.stringify(recentUrls));
    } catch {
      // ignore
    }
  }, [recentUrls]);

  // Generate QR code whenever activeShortUrl or selectedBadge changes
  useEffect(() => {
    generateQrImage(activeShortUrl, selectedBadge);
  }, [activeShortUrl, selectedBadge]);

  // Initial default QR code generation
  useEffect(() => {
    generateQrImage("https://dict.gov.ph", "none");
  }, []);

  const generateQrImage = async (urlToEncode: string, badge: string) => {
    try {
      // Generate high-resolution QR on canvas
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;

      await QRCode.toCanvas(canvas, urlToEncode, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H", // High error correction to allow center logos
      });

      const ctx = canvas.getContext("2d");
      if (ctx && badge !== "none") {
        const center = 200;
        const radius = 38;

        // Draw white circle background for badge
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#3B82F6";
        ctx.stroke();

        // Draw badge text / icon inside
        ctx.fillStyle = "#1E3A8A";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (badge === "dict") {
          ctx.fillStyle = "#0284C7";
          ctx.fillText("DICT", center, center);
        } else if (badge === "pnpki") {
          ctx.fillStyle = "#7C3AED";
          ctx.fillText("PNPKI", center, center);
        } else if (badge === "wifi") {
          ctx.fillStyle = "#10B981";
          ctx.fillText("WiFi", center, center);
        }
      }

      const dataUrl = canvas.toDataURL("image/png");
      setActiveQrUrl(dataUrl);
    } catch (err) {
      console.error("QR Code Generation Error", err);
    }
  };

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!originalUrl.trim()) {
      setErrorMsg("Please enter a valid destination URL.");
      return;
    }

    let formattedUrl = originalUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = "https://" + formattedUrl;
    }

    try {
      new URL(formattedUrl);
    } catch {
      setErrorMsg("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    // Generate unique alias or use custom
    const code = customAlias.trim()
      ? customAlias.trim().replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
      : Math.random().toString(36).substring(2, 8);

    // Check alias collision
    if (recentUrls.some((u) => u.shortCode === code)) {
      setErrorMsg(`Alias "${code}" is already in use. Please choose another.`);
      return;
    }

    const shortUrl = `https://dict.gov.ph/s/${code}`;

    const newEntry: ShortenedUrl = {
      id: Date.now().toString(),
      originalUrl: formattedUrl,
      shortCode: code,
      shortUrl,
      badge: selectedBadge,
      clicks: 0,
      createdAt: new Date().toLocaleDateString(),
    };

    setRecentUrls((prev) => [newEntry, ...prev]);
    setActiveShortUrl(shortUrl);
    setOriginalUrl("");
    setCustomAlias("");
    setSuccessMsg(`URL shortened successfully: ${shortUrl}`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = () => {
    if (!activeQrUrl) return;
    const a = document.createElement("a");
    a.href = activeQrUrl;
    a.download = `dict-qr-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleVisit = (item: ShortenedUrl) => {
    // Increment clicks
    setRecentUrls((prev) =>
      prev.map((u) => (u.id === item.id ? { ...u, clicks: u.clicks + 1 } : u))
    );
    window.open(item.originalUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = (id: string) => {
    setRecentUrls((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSelectQrPreview = (item: ShortenedUrl) => {
    setActiveShortUrl(item.shortUrl);
    setSelectedBadge(item.badge);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-200 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Notifications */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP SECTION: Create Short URL (Left) + QR Preview (Right)                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT CARD: Create Short URL */}
        <div className="lg:col-span-8 bg-[#0C101D] border border-[#18233C] rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl">
          
          {/* Card Header */}
          <div className="flex items-center gap-2.5 text-purple-400">
            <LinkIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Create Short URL
            </h2>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            
            {/* Input: Original URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Original URL
              </label>
              <input
                type="text"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans"
              />
            </div>

            {/* Input: Custom Alias (optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Custom Alias (optional)
              </label>
              <input
                type="text"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                placeholder="my-link"
                className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans"
              />
            </div>

            {/* Radio Options: Select Project Badge */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-medium text-slate-300">
                Select Project Badge
              </label>

              <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300">
                
                {/* No Logo */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="badge"
                    checked={selectedBadge === "none"}
                    onChange={() => setSelectedBadge("none")}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <span className="group-hover:text-white transition-colors">No Logo</span>
                </label>

                {/* DICT Logo */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="badge"
                    checked={selectedBadge === "dict"}
                    onChange={() => setSelectedBadge("dict")}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <span className="group-hover:text-white transition-colors">DICT Logo</span>
                </label>

                {/* PNPKI Logo */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="badge"
                    checked={selectedBadge === "pnpki"}
                    onChange={() => setSelectedBadge("pnpki")}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <span className="group-hover:text-white transition-colors">pnpki Logo</span>
                </label>

                {/* WiFi Logo */}
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="badge"
                    checked={selectedBadge === "wifi"}
                    onChange={() => setSelectedBadge("wifi")}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <span className="group-hover:text-white transition-colors">wifi Logo</span>
                </label>

              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-[0.98] text-white text-xs font-bold transition-all shadow-lg shadow-purple-900/30 cursor-pointer flex items-center gap-2"
              >
                Generate Short URL
              </button>
            </div>

          </form>

        </div>

        {/* RIGHT CARD: QR Preview */}
        <div className="lg:col-span-4 bg-[#0C101D] border border-[#18233C] rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-between gap-5 shadow-xl">
          
          {/* Card Header */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <QrCode className="w-6 h-6 text-purple-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              QR Preview
            </h2>
          </div>

          {/* QR Code Container */}
          <div className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] bg-white rounded-2xl p-3 sm:p-4 flex items-center justify-center shadow-inner">
            {activeQrUrl ? (
              <img
                src={activeQrUrl}
                alt="QR Preview"
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
                <QrCode className="w-12 h-12 text-slate-300 stroke-[1.5]" />
              </div>
            )}
          </div>

          {/* Download QR Button */}
          <button
            onClick={handleDownloadQr}
            className="w-full max-w-[200px] py-2 px-3 rounded-lg bg-[#141B2D] hover:bg-[#1C253D] border border-[#232F4D] text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download QR
          </button>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: Recent Short URLs Table                                   */}
      {/* ========================================================================= */}
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
        
        <h2 className="text-sm font-bold text-white tracking-tight">
          Recent Short URLs
        </h2>

        {/* Table Content */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#18233C]/80 text-slate-400 font-semibold pb-3">
                <th className="pb-3 px-2 font-medium">Original URL</th>
                <th className="pb-3 px-2 font-medium text-center sm:text-left">Short URL</th>
                <th className="pb-3 px-2 font-medium text-center">Clicks</th>
                <th className="pb-3 px-2 font-medium text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {recentUrls.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 text-xs font-normal">
                    No shortened URLs found
                  </td>
                </tr>
              ) : (
                recentUrls.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#18233C]/40 hover:bg-[#11172A]/50 transition-colors group"
                  >
                    {/* Original URL */}
                    <td className="py-3 px-2 max-w-[280px] truncate text-slate-300">
                      <div className="flex items-center gap-2 truncate">
                        <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate" title={item.originalUrl}>
                          {item.originalUrl}
                        </span>
                      </div>
                    </td>

                    {/* Short URL */}
                    <td className="py-3 px-2 text-purple-400 font-mono font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectQrPreview(item)}
                          className="hover:underline cursor-pointer flex items-center gap-1.5"
                          title="Click to preview QR code"
                        >
                          {item.shortUrl}
                        </button>
                        {item.badge !== "none" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Clicks */}
                    <td className="py-3 px-2 text-center text-slate-300 font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-[#162035] text-slate-300 text-[11px]">
                        {item.clicks}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Copy Link */}
                        <button
                          onClick={() => handleCopy(item.shortUrl, item.id)}
                          className="p-1.5 rounded-lg bg-[#141B2D] hover:bg-[#1E2842] text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Copy short link"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Visit Destination */}
                        <button
                          onClick={() => handleVisit(item)}
                          className="p-1.5 rounded-lg bg-[#141B2D] hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                          title="Visit original URL (tracks click)"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {/* View QR in preview */}
                        <button
                          onClick={() => handleSelectQrPreview(item)}
                          className="p-1.5 rounded-lg bg-[#141B2D] hover:bg-purple-600/20 text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                          title="View QR in Preview"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg bg-[#141B2D] hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
