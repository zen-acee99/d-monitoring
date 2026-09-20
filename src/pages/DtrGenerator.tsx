import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Sparkles, 
  Calendar, 
  Printer, 
  Trash2, 
  Clock, 
  Check, 
  Info, 
  Download, 
  FileText,
  Building2,
  Users2,
  MapPin,
  Save,
  PlusCircle,
  FolderLock,
  Layers,
  Archive,
  FileDown,
  Merge,
  Split,
  ShieldCheck,
  FileKey,
  UploadCloud,
  Lock,
  Image as ImageIcon,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  UserCheck
} from "lucide-react";
import { 
  dtrGeneratorApi, 
  DtrGeneratorSignatureRecord,
  administrationApi 
} from "@/services/api";
import { getCurrentUser } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { 
  DtrRow, 
  DtrConfig, 
  MONTH_NAMES, 
  DTR_PROVINCE_OPTIONS,
  createEmptyDtrRows, 
  autoFillWeekendsAndHolidays, 
  parseOtcLogStream, 
  exportDtrToExcel 
} from "@/utils/dtrUtils";
import { downloadDtrVectorPdf, generateDtrVectorPdf, preloadFonts } from "@/utils/dtrVectorPdf";
import { DtrStorageView } from "@/components/dtr/DtrStorageView";
import { 
  DtrModuleCategory, 
  ProvincialTab, 
  PROVINCIAL_TABS, 
  addDtrRecord,
  getDtrStorage,
  syncDtrStorageWithBackend
} from "@/data/dtrStorage";
import { DtrPdfModal } from "@/components/dtr/DtrPdfModal";
import { DtrSignatureValidationModal } from "@/components/dtr/DtrSignatureValidationModal";
import { subscribeToDtrRealtime } from "@/services/dtrRealtime";

type ActiveSubModule = "generator" | "hrm" | "tod" | "provincial";

export function DtrGenerator() {
  // Sub-module navigation state
  const [activeSubModule, setActiveSubModule] = useState<ActiveSubModule>("generator");
  const [activeProvinceTab, setActiveProvinceTab] = useState<ProvincialTab>("Regional Off");

  // Storage record counts for badges
  const [storageCounts, setStorageCounts] = useState<{
    hrm: number;
    tod: number;
    provincial: Record<ProvincialTab, number>;
  }>({
    hrm: 0,
    tod: 0,
    provincial: {
      "Regional Off": 0,
      "Albay": 0,
      "Sorsogon": 0,
      "Catanduanes": 0,
      "Camarines Sur": 0,
      "Camarines Norte": 0,
      "Masbate": 0
    }
  });

  const refreshCounts = () => {
    const all = getDtrStorage();
    const hrmCount = all.filter((r) => r.module === "HRM").length;
    const todCount = all.filter((r) => r.module === "TOD").length;
    const provCounts: Record<ProvincialTab, number> = {
      "Regional Off": 0,
      "Albay": 0,
      "Sorsogon": 0,
      "Catanduanes": 0,
      "Camarines Sur": 0,
      "Camarines Norte": 0,
      "Masbate": 0
    };

    all.filter((r) => r.module === "PROVINCIAL").forEach((r) => {
      if (r.province && provCounts[r.province] !== undefined) {
        provCounts[r.province]++;
      }
    });

    setStorageCounts({
      hrm: hrmCount,
      tod: todCount,
      provincial: provCounts
    });
  };

  useEffect(() => {
    refreshCounts();
    syncDtrStorageWithBackend().then(() => refreshCounts()).catch(() => {});

    // Realtime Event Subscription for instant badge updates
    const unsubscribeRealtime = subscribeToDtrRealtime(() => {
      refreshCounts();
    });

    // Fallback background polling every 3 seconds
    const pollInterval = setInterval(() => {
      syncDtrStorageWithBackend().then(() => refreshCounts()).catch(() => {});
    }, 3000);

    const handleFocus = () => {
      refreshCounts();
      syncDtrStorageWithBackend().then(() => refreshCounts()).catch(() => {});
    };

    window.addEventListener("dict_dtr_storage_updated", refreshCounts);
    window.addEventListener("storage", refreshCounts);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribeRealtime();
      clearInterval(pollInterval);
      window.removeEventListener("dict_dtr_storage_updated", refreshCounts);
      window.removeEventListener("storage", refreshCounts);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // ==========================================
  // GENERATOR SUB-MODULE STATE & HANDLERS
  // ==========================================
  const [config, setConfig] = useState<DtrConfig>({
    employeeName: "PERSONNEL",
    province: "Regional Office (RO)",
    supervisorName: "NORLY A. TABO",
    supervisorTitle: "OIC Chief - Technical Operations Division",
    periodText: "AUGUST 01-31, 2026",
    regularHours: "",
    saturdayHours: "",
    month: 7, // August (0-indexed)
    year: 2026,
    scope: "full",
  });

  const [otcRawText, setOtcRawText] = useState("");
  const [rows, setRows] = useState<DtrRow[]>(() => {
    return createEmptyDtrRows();
  });

  const [notification, setNotification] = useState<string | null>(null);

  // PNPKI Digital Signature & .p12 KeyStore state (connected to Turso dtr_generator table)
  const [signatureProfiles, setSignatureProfiles] = useState<DtrGeneratorSignatureRecord[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [p12File, setP12File] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [p12Password, setP12Password] = useState("");
  const [showP12Password, setShowP12Password] = useState(false);
  const [isP12Unlocked, setIsP12Unlocked] = useState(false);
  const [isP12PasswordSaved, setIsP12PasswordSaved] = useState<boolean>(false);
  const [savePasswordToDb, setSavePasswordToDb] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isSavingSig, setIsSavingSig] = useState(false);

  // Digital Signer Identity strictly derived from P12 certificate
  const [p12SignerIdentity, setP12SignerIdentity] = useState<{
    commonName: string;
    subjectDN: string;
    organization?: string;
    issuerCN?: string;
    issuerDN?: string;
    serialNumber?: string;
    sha256Fingerprint: string;
    validFrom: string;
    validTo: string;
  } | null>(null);

  // Active user session & authentication provider
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(() => getCurrentUser());
  useEffect(() => {
    setCurrentUserState(getCurrentUser());
  }, []);

  const isGovMailAuth = Boolean(
    currentUser?.authProvider === "google" ||
    currentUser?.authProvider === "govmail" ||
    currentUser?.lastLogin?.toLowerCase().includes("govmail") ||
    currentUser?.lastLogin?.toLowerCase().includes("sso") ||
    currentUser?.lastLogin?.toLowerCase().includes("google") ||
    currentUser?.lastLogin?.toLowerCase().includes("gmail") ||
    currentUser?.email?.toLowerCase().endsWith(".gov.ph") ||
    currentUser?.email?.toLowerCase().includes("dict.gov.ph") ||
    currentUser?.email?.toLowerCase().endsWith("@gmail.com")
  );

  const isGoogleAuth = isGovMailAuth;

  const isNormalAuth = Boolean(currentUser && !isGovMailAuth);

  // Password requirement modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalReason, setPasswordModalReason] = useState<"save" | "sign" | "apply" | "account_sign">("sign");
  const [pendingApplyProfile, setPendingApplyProfile] = useState<DtrGeneratorSignatureRecord | null>(null);
  const [modalPasswordInput, setModalPasswordInput] = useState("");
  const [modalPasswordError, setModalPasswordError] = useState("");
  const [showValidationStatusModal, setShowValidationStatusModal] = useState(false);

  // Registered personnel list for Verifying Officer (Supervisor) dropdown (PO, TOD, RD, ARD)
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [selectedOfficerOption, setSelectedOfficerOption] = useState<string>("norly-tabo");

  useEffect(() => {
    administrationApi.getAdministrators()
      .then((list) => {
        if (Array.isArray(list)) {
          setPersonnelList(list);
        }
      })
      .catch((err) => {
        console.warn("Could not load administrators list for DTR supervisor dropdown:", err);
      });
  }, []);

  // Filtered supervisor personnel lists by role
  const registeredRd = personnelList.filter(
    (u) => u.role === "Regional Director" || (u.role && u.role.toLowerCase().includes("regional director") && !u.role.toLowerCase().includes("asst"))
  );
  const registeredArd = personnelList.filter(
    (u) => u.role === "Asst. Regional Director" || u.role === "Assistant Regional Director" || (u.role && u.role.toLowerCase().includes("asst"))
  );
  const registeredTod = personnelList.filter(
    (u) => u.role === "OIC Chief - Technical Operations Division" || u.role === "Technical Operations Division" || (u.role && u.role.toLowerCase().includes("technical operations"))
  );
  const registeredPo = personnelList.filter(
    (u) => u.role === "Provincial Officer" || (u.role && u.role.toLowerCase().includes("provincial officer"))
  );

  const handleSelectSupervisorOption = (val: string) => {
    setSelectedOfficerOption(val);
    if (!val || val === "custom") return;

    if (val === "norly-tabo") {
      setConfig((prev) => ({
        ...prev,
        supervisorName: "NORLY A. TABO",
        supervisorTitle: "OIC Chief - Technical Operations Division",
      }));
      return;
    }

    if (val.startsWith("u-")) {
      const uId = val.replace("u-", "");
      const found = personnelList.find((p) => String(p.id) === uId);
      if (found) {
        setConfig((prev) => ({
          ...prev,
          supervisorName: found.name,
          supervisorTitle: found.role || "Officer in Charge",
        }));
      }
      return;
    }

    if (val.startsWith("po-")) {
      const provName = val.replace("po-", "").replace(/-/g, " ").toUpperCase();
      setConfig((prev) => ({
        ...prev,
        supervisorName: "Provincial Officer",
        supervisorTitle: `Provincial Officer - ${provName}`,
      }));
      return;
    }

    if (val === "default-rd") {
      setConfig((prev) => ({
        ...prev,
        supervisorName: "Regional Director",
        supervisorTitle: "Regional Director - DICT Region V",
      }));
      return;
    }

    if (val === "default-ard") {
      setConfig((prev) => ({
        ...prev,
        supervisorName: "Asst. Regional Director",
        supervisorTitle: "Assistant Regional Director - DICT Region V",
      }));
      return;
    }
  };

  // Load signature profiles from Turso (STRICT USER ISOLATION)
  const loadSignatureProfiles = async () => {
    try {
      const user = getCurrentUser();
      if (!user || !user.id) {
        setSignatureProfiles([]);
        return;
      }

      // Query database ONLY for the active user's signature profile
      const records = await dtrGeneratorApi.getRecords({
        user_Id: String(user.id),
      });
      setSignatureProfiles(records);

      // Auto-load and bind active user's own profile if available and not yet manually loaded
      const userProfile = records.find(
        (r) => r.user_Id === String(user.id) || r.id === `dtr-sig-${user.id}`
      ) || records[0];

      if (userProfile && !p12File && !signatureImage) {
        setSelectedProfileId(userProfile.id);
        setSelectedUserId(String(user.id));
        if (userProfile.image_digiSigned) {
          setSignatureImage(userProfile.image_digiSigned);
        }
        if (userProfile.p12 && userProfile.p12_filename) {
          setP12File({
            name: userProfile.p12_filename,
            size: userProfile.p12_filesize || 0,
            base64: userProfile.p12,
          });

          if (userProfile.hasP12Password) {
            setIsP12Unlocked(true);
            setIsP12PasswordSaved(true);
            dtrGeneratorApi.getP12Identity({
              profileId: userProfile.id,
              user_Id: String(user.id),
            }).then((idRes) => {
              if (idRes.success && idRes.identity) {
                setP12SignerIdentity(idRes.identity);
              }
            }).catch(() => {});
          } else {
            setIsP12PasswordSaved(false);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load signature profiles:", err);
    }
  };

  useEffect(() => {
    loadSignatureProfiles();
    preloadFonts().catch((err) => console.warn("Failed to preload fonts:", err));
  }, []);

  // Handle .p12 / .pfx file upload (re-upload resets saved password state to prompt entry)
  const handleP12Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setP12File({
        name: file.name,
        size: file.size,
        base64,
      });
      setP12SignerIdentity(null);
      setIsP12Unlocked(false);
      setIsP12PasswordSaved(false);
      setP12Password("");
      setSavePasswordToDb(true);
      showNotification(`PNPKI .p12 certificate "${file.name}" (${(file.size / 1024).toFixed(1)} KB) loaded! Please enter password to unlock.`);
    };
    reader.readAsDataURL(file);
  };

  // Handle digital signature image upload
  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSignatureImage(base64);
      showNotification("Digital signature image loaded! Ready to stamp on CS Form 48.");
    };
    reader.readAsDataURL(file);
  };

  // Save digital signature profile to Turso database (dtr_generator table)
  const handleSaveSignatureProfile = async () => {
    const user = getCurrentUser();
    const nameToSave = (config.employeeName || user?.name || "PERSONNEL").trim();
    if (!nameToSave) {
      showNotification("Please enter or select Employee Full Name first.");
      return;
    }
    if (!p12File && !signatureImage) {
      showNotification("Please upload a .p12 certificate file or a digital signature image first.");
      return;
    }

    // If .p12 is attached and no password has been entered yet, require password before saving!
    if (p12File && !p12Password.trim()) {
      setPasswordModalReason("save");
      setModalPasswordInput("");
      setModalPasswordError("");
      setShowPasswordModal(true);
      return;
    }

    proceedSaveSignatureProfile(p12Password);
  };

  const proceedSaveSignatureProfile = async (pwdToSave?: string) => {
    const user = getCurrentUser();
    const nameToSave = (config.employeeName || user?.name || "PERSONNEL").trim();
    setIsSavingSig(true);
    const effectivePwd = pwdToSave || p12Password;
    const res = await dtrGeneratorApi.saveSignatureProfile({
      id: user?.id ? `dtr-sig-${user.id}` : selectedProfileId || undefined,
      user_Id: user?.id ? String(user.id) : selectedUserId || undefined,
      Name: nameToSave,
      p12: p12File?.base64,
      p12_filename: p12File?.name,
      p12_filesize: p12File?.size,
      p12_password: savePasswordToDb || pwdToSave ? effectivePwd : undefined,
      image_digiSigned: signatureImage,
    });
    setIsSavingSig(false);

    if (res.success) {
      showNotification(`✅ Digital signature profile for "${nameToSave}" saved and linked to your account!`);
      if (effectivePwd || savePasswordToDb) {
        setIsP12Unlocked(true);
        setIsP12PasswordSaved(true);
        setP12Password("");
      }
      setShowPasswordModal(false);
      await loadSignatureProfiles();
    } else {
      showNotification(`⚠️ Error saving signature profile: ${res.error}`);
    }
  };

  // Trigger vector PDF download (Supports generating WITH or WITHOUT .p12 digital signature)
  const handleRequestPdfExport = async () => {
    // Determine whether an actual .p12 certificate is loaded in memory or saved in user's profile
    const matchedProfile = signatureProfiles.find(
      (p) => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id))
    );
    
    const hasP12Keystore = Boolean(p12File?.base64 || (matchedProfile && (matchedProfile.hasP12 || matchedProfile.p12_filename)));
    const hasDbPassword = Boolean(matchedProfile?.hasP12Password);

    // =========================================================================
    // SCENARIO 1: NO .P12 KEYSTORE -> INSTANT CLEAN CS FORM 48 VECTOR PDF
    // Users WITHOUT a .p12 can freely export authentic CS Form 48 vector PDFs
    // (with or without signature image, official manual signature line).
    // No password prompt required!
    // =========================================================================
    if (!hasP12Keystore) {
      try {
        await downloadDtrVectorPdf(
          config,
          rows,
          signatureImage,
          false, // hasP12 = false
          null   // p12Options = null
        );
        showNotification("✓ Generated Civil Service Form 48 vector PDF (Standard / Manual Mode)!");
        return;
      } catch (err: any) {
        console.error("PDF Export error:", err);
        showNotification(`⚠️ PDF Generation Failed: ${err.message || "Error creating document"}`);
        return;
      }
    }

    // =========================================================================
    // SCENARIO 2: USER HAS .P12 KEYSTORE -> PNPKI CRYPTOGRAPHIC DIGITAL SIGNING
    // =========================================================================
    // Rule 1: GovMail / Google Account (GovMail SSO / Google Auth)
    // Once authenticated via GovMail or Google, GovMail users do NOT need to enter any account password!
    if (isGovMailAuth) {
      if (hasDbPassword || isP12Unlocked || p12Password.trim()) {
        const p12Options = {
          profileId: selectedProfileId || matchedProfile?.id || (currentUser?.id ? `dtr-sig-${currentUser.id}` : undefined),
          user_Id: selectedUserId || matchedProfile?.user_Id || (currentUser?.id ? String(currentUser.id) : undefined),
          p12Base64: p12File?.base64,
          p12Password: p12Password || undefined,
          isGoogleAuth: true,
          signerName: p12SignerIdentity?.commonName,
        };

        try {
          await downloadDtrVectorPdf(
            config,
            rows,
            signatureImage,
            true,
            p12Options
          );
          showNotification("✓ GovMail authenticated! Digitally signed & exported DTR vector PDF.");
          return;
        } catch (err: any) {
          console.error("PDF Export error:", err);
          showNotification(`⚠️ Signing Failed: ${err.message || "Invalid certificate"}`);
          return;
        }
      } else {
        // If a newly uploaded raw .p12 file is not yet unlocked and has no saved password,
        // prompt for certificate keystore password/PIN (NOT account password)
        setPasswordModalReason("sign");
        setModalPasswordInput("");
        setModalPasswordError("");
        setShowPasswordModal(true);
        return;
      }
    }

    // Rule 2: Normal Account (Email + Password) - Only for non-GovMail local accounts
    if (isNormalAuth) {
      setPasswordModalReason("account_sign");
      setModalPasswordInput("");
      setModalPasswordError("");
      setShowPasswordModal(true);
      return;
    }

    // Rule 3: Guest / Unregistered user with .p12 needing password
    if (!hasDbPassword && !isP12Unlocked && !p12Password.trim()) {
      setPasswordModalReason("sign");
      setModalPasswordInput("");
      setModalPasswordError("");
      setShowPasswordModal(true);
      return;
    }

    const p12Options = {
      profileId: selectedProfileId || (selectedUserId ? `dtr-sig-${selectedUserId}` : undefined),
      user_Id: selectedUserId || (currentUser?.id ? String(currentUser.id) : undefined),
      p12Base64: p12File?.base64,
      p12Password: p12Password || undefined,
      isGoogleAuth,
      signerName: p12SignerIdentity?.commonName,
    };

    try {
      await downloadDtrVectorPdf(
        config,
        rows,
        signatureImage,
        true,
        p12Options
      );
      showNotification("✓ Generated authentic vector PDF! Digitally signed with PNPKI .p12 certificate.");
    } catch (err: any) {
      console.error("PDF Export error:", err);
      if (err.message && (err.message.includes("password") || err.message.includes("MAC") || err.message.includes("Private Key"))) {
        setPasswordModalReason("sign");
        setModalPasswordInput("");
        setModalPasswordError(err.message);
        setShowPasswordModal(true);
      } else {
        showNotification(`⚠️ Signing Failed: ${err.message || "Invalid certificate or password"}`);
      }
    }
  };

  // Confirm password in modal
  const handleConfirmPasswordModal = async () => {
    if (!modalPasswordInput.trim()) {
      setModalPasswordError(
        passwordModalReason === "account_sign"
          ? "Account login password is required to authorize signing."
          : "Password / PIN is required to unlock this PNPKI .p12 keystore."
      );
      return;
    }

    // Handle normal account password signing
    if (passwordModalReason === "account_sign") {
      const matchedProfile = signatureProfiles.find(
        (p) => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id))
      );
      const hasP12Keystore = Boolean(p12File?.base64 || (matchedProfile && (matchedProfile.hasP12 || matchedProfile.p12_filename)));

      const p12Options = hasP12Keystore
        ? {
            profileId: selectedProfileId || matchedProfile?.id || (currentUser?.id ? `dtr-sig-${currentUser.id}` : undefined),
            user_Id: selectedUserId || matchedProfile?.user_Id || (currentUser?.id ? String(currentUser.id) : undefined),
            p12Base64: p12File?.base64,
            account_password: modalPasswordInput,
            isGoogleAuth: false,
            signerName: p12SignerIdentity?.commonName,
          }
        : null;

      try {
        await downloadDtrVectorPdf(
          config,
          rows,
          signatureImage,
          hasP12Keystore,
          p12Options
        );
        setShowPasswordModal(false);
        setModalPasswordInput("");
        showNotification("✓ Account authorized! Digitally signed & exported DTR vector PDF.");
      } catch (err: any) {
        console.error("Account sign error:", err);
        setModalPasswordError(err.message || "Incorrect account password. Please enter your valid web login password.");
      }
      return;
    }

    // Validate password and inspect identity from certificate
    let inspectedCertName: string | undefined;
    const hasP12Source = Boolean(p12File?.base64 || pendingApplyProfile?.p12 || selectedProfileId || selectedUserId);
    
    if (hasP12Source) {
      const idRes = await dtrGeneratorApi.getP12Identity({
        p12: p12File?.base64,
        p12_password: modalPasswordInput,
        profileId: pendingApplyProfile?.id || selectedProfileId,
        user_Id: pendingApplyProfile?.user_Id || selectedUserId,
      });

      if (!idRes.success || !idRes.identity) {
        setModalPasswordError(idRes.error || "Incorrect password / PIN for this .p12 keystore. Please try again.");
        return;
      }

      setP12SignerIdentity(idRes.identity);
      inspectedCertName = idRes.identity.commonName;
    }

    setP12Password(modalPasswordInput);
    setIsP12Unlocked(true);
    setShowPasswordModal(false);

    if (passwordModalReason === "apply") {
      const certSigner = inspectedCertName || pendingApplyProfile?.Name || config.employeeName;
      showNotification(`✓ PNPKI .p12 unlocked & applied (Signer: ${certSigner})!`);
      setPendingApplyProfile(null);
    } else if (passwordModalReason === "save") {
      proceedSaveSignatureProfile(modalPasswordInput);
    } else {
      const p12Options = (p12File || selectedProfileId || selectedUserId)
        ? {
            profileId: selectedProfileId || (selectedUserId ? `dtr-sig-${selectedUserId}` : undefined),
            user_Id: selectedUserId || undefined,
            p12Base64: p12File?.base64,
            p12Password: modalPasswordInput,
            signerName: inspectedCertName || p12SignerIdentity?.commonName,
          }
        : null;

      try {
        await downloadDtrVectorPdf(
          config,
          rows,
          signatureImage,
          Boolean(p12File?.base64 || selectedProfileId || selectedUserId),
          p12Options
        );
        showNotification("✓ PNPKI .p12 Keystore unlocked! Generated digitally signed vector PDF.");
      } catch (err: any) {
        console.error("PDF Export error:", err);
        showNotification(`⚠️ Signing Failed: ${err.message || "Invalid certificate or password"}`);
      }
    }
  };

  // Apply a saved signature profile from Turso
  const handleApplySavedProfile = async (profile: DtrGeneratorSignatureRecord) => {
    setSelectedProfileId(profile.id);
    if (profile.Name) {
      setConfig((prev) => ({ ...prev, employeeName: profile.Name }));
    }
    if (profile.user_Id) {
      setSelectedUserId(profile.user_Id);
    } else {
      setSelectedUserId("");
    }
    if (profile.image_digiSigned) {
      setSignatureImage(profile.image_digiSigned);
    }
    if (profile.p12 && profile.p12_filename) {
      setP12File({
        name: profile.p12_filename,
        size: profile.p12_filesize || 0,
        base64: profile.p12,
      });

      // If password was saved in Turso DB, auto-unlock and fetch certificate identity seamlessly
      if (profile.hasP12Password) {
        setIsP12Unlocked(true);
        setIsP12PasswordSaved(true);
        setP12Password("");
        try {
          const idRes = await dtrGeneratorApi.getP12Identity({
            profileId: profile.id,
            user_Id: profile.user_Id,
          });
          if (idRes.success && idRes.identity) {
            setP12SignerIdentity(idRes.identity);
            showNotification(`✅ Applied PNPKI profile for ${profile.Name} (Signer: ${idRes.identity.commonName})!`);
            return;
          }
        } catch (e) {
          console.warn("Could not pre-fetch identity for saved profile:", e);
        }
        showNotification(`✅ Applied saved PNPKI profile for ${profile.Name} (Keystore unlocked)!`);
        return;
      }

      // If no password saved in DB, staged for signing
      setIsP12Unlocked(false);
      setIsP12PasswordSaved(false);
      setP12SignerIdentity(null);
      showNotification(`✅ Applied profile for ${profile.Name}.`);
      return;
    }
    showNotification(`✅ Applied digital signature profile for ${profile.Name}!`);
  };

  // Delete signature profile from Turso
  const handleDeleteSavedProfile = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete signature profile for "${name}" from Turso?`)) return;
    const ok = await dtrGeneratorApi.deleteRecord(id);
    if (ok) {
      showNotification(`Deleted signature profile for "${name}".`);
      await loadSignatureProfiles();
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 8000);
  };

  // Update Period text when month or year changes
  const handleMonthYearChange = (newMonth: number, newYear: number, newScope: "full" | "first-half" | "second-half") => {
    const mName = MONTH_NAMES[newMonth].toUpperCase();
    const daysInMonth = new Date(newYear, newMonth + 1, 0).getDate();
    let pText = `${mName} 01-${daysInMonth}, ${newYear}`;
    if (newScope === "first-half") pText = `${mName} 01-15, ${newYear}`;
    if (newScope === "second-half") pText = `${mName} 16-${daysInMonth}, ${newYear}`;

    setConfig((prev) => ({
      ...prev,
      month: newMonth,
      year: newYear,
      scope: newScope,
      periodText: pText,
    }));
  };

  // Execute OTC Input Parser
  const handleExecuteParse = () => {
    if (!otcRawText.trim()) {
      showNotification("⚠️ No text detected — paste OTC data into the text box first.");
      return;
    }
    const textLen = otcRawText.trim().split("\n").filter(Boolean).length;
    const result = parseOtcLogStream(otcRawText, rows, config.year, config.scope);

    // Debug to browser console — press F12 → Console to inspect
    console.log("[DTR Parse] Input lines:", textLen, "| Detected days:", result.detectedCount, "| Month:", result.detectedMonth, "| Name:", result.detectedEmployeeName);
    console.log("[DTR Parse] Updated rows:", result.rows.filter(r => r.amArrival || r.pmArrival).map(r => `Day${r.day}: ${r.amArrival}-${r.amDeparture} / ${r.pmArrival}-${r.pmDeparture}`));

    setRows(result.rows);

    let infoMsg = result.detectedCount > 0
      ? `✅ Parsed ${result.detectedCount} day(s) from ${textLen} lines!`
      : `⚠️ Parsed 0 days from ${textLen} lines — check format.`;

    if (result.detectedEmployeeName) {
      setConfig((prev) => ({
        ...prev,
        employeeName: result.detectedEmployeeName!,
      }));
      infoMsg += ` Name: ${result.detectedEmployeeName}.`;
    }

    if (result.detectedMonth !== undefined) {
      handleMonthYearChange(result.detectedMonth, config.year, config.scope);
    }

    showNotification(infoMsg);
  };

  // Apply Holiday / Weekend Smart Tags
  const handleApplySmartTags = () => {
    const updated = autoFillWeekendsAndHolidays(rows, config.month, config.year, config.scope);
    setRows(updated);
    showNotification(`Smart tags applied for ${MONTH_NAMES[config.month]} ${config.year}!`);
  };

  // Fill Standard Official Hours (8:00 AM - 12:00 PM, 1:00 PM - 5:00 PM) for non-weekend days
  const handleFillStandardTimes = () => {
    const daysInMonth = new Date(config.year, config.month + 1, 0).getDate();
    const updated = rows.map((row) => {
      if (row.day > daysInMonth) return row;
      if (row.isCustomLabel) return row; // skip weekends & holidays

      return {
        ...row,
        amArrival: "07:55",
        amDeparture: "12:00",
        pmArrival: "12:58",
        pmDeparture: "05:00",
        undertimeHours: "",
        undertimeMinutes: "",
      };
    });
    setRows(updated);
    showNotification("Standard working hours filled for weekdays!");
  };

  // Clear All
  const handleClearEntries = () => {
    setRows(createEmptyDtrRows());
    showNotification("All entries cleared.");
  };

  // Direct cell editing
  const handleCellChange = (dayIndex: number, field: keyof DtrRow, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[dayIndex] = {
        ...copy[dayIndex],
        [field]: value,
      };
      return copy;
    });
  };

  // Toggle Custom Label (e.g. toggle SATURDAY / SUNDAY / LEAVE)
  const handleToggleRowType = (dayIndex: number) => {
    setRows((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (current.isCustomLabel) {
        copy[dayIndex] = {
          ...current,
          isCustomLabel: false,
          customLabel: "",
        };
      } else {
        copy[dayIndex] = {
          ...current,
          isCustomLabel: true,
          customLabel: "OFFICIAL BUSINESS",
          amArrival: "",
          amDeparture: "",
          pmArrival: "",
          pmDeparture: "",
        };
      }
      return copy;
    });
  };

  // Move current generated DTR to Provincial Office (PO) Archive
  const handleMoveToPo = () => {
    const safeName = (config.employeeName || "PERSONNEL").trim().toUpperCase();
    const renderedDays = rows.filter((r) => !r.isCustomLabel && r.amArrival).length;
    const renderedHours = renderedDays * 8;
    const fileName = `DTR_${safeName.replace(/[^a-zA-Z0-9]/g, "_")}_${MONTH_NAMES[config.month]}_${config.year}.pdf`;

    const selectedProv = config.province || "Regional Office (RO)";
    let targetProvinceTab: ProvincialTab = "Regional Off";
    if (selectedProv === "Regional Office (RO)" || selectedProv === "RO") {
      targetProvinceTab = "Regional Off";
    } else if (PROVINCIAL_TABS.includes(selectedProv as ProvincialTab)) {
      targetProvinceTab = selectedProv as ProvincialTab;
    }

    const activeUser = getCurrentUser();
    const userAuditId = activeUser?.id || currentUser?.id || "";

    // Generate vector PDF data URL for immediate viewing in modal viewer
    let pdfDataUrl: string | undefined;
    const empHasP12 = Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12);
    const empSignerName = p12SignerIdentity?.commonName || config.employeeName;
    try {
      const { doc } = generateDtrVectorPdf(
        {
          ...config,
          status: "Submitted",
          employeeSignatureImage: signatureImage || undefined,
          employeeHasP12: empHasP12,
          employeeSignerName: empSignerName,
          supervisorSignatureImage: undefined,
          supervisorHasP12: false,
        },
        rows,
        signatureImage,
        empHasP12,
        null,
        empSignerName
      );
      pdfDataUrl = doc.output("datauristring");
    } catch (e) {
      console.warn("Could not generate PDF data URL for storage:", e);
    }

    addDtrRecord({
      userId: userAuditId ? String(userAuditId) : undefined,
      employeeName: safeName,
      employeeId: `DICT-R5-${config.year}-${Math.floor(100 + Math.random() * 900)}`,
      position: "Technical Specialist / Engineer",
      employmentStatus: "Regular",
      module: "PROVINCIAL",
      province: targetProvinceTab,
      sectionDivision: targetProvinceTab === "Regional Off" ? "Regional Operations (RO)" : `${targetProvinceTab} Provincial Office`,
      periodText: config.periodText,
      month: config.month,
      year: config.year,
      scope: config.scope,
      regularHours: config.regularHours,
      saturdayHours: config.saturdayHours,
      supervisorName: config.supervisorName,
      supervisorTitle: config.supervisorTitle,
      totalDaysRendered: renderedDays,
      totalHoursRendered: renderedHours,
      undertimeHours: totalUndertime.hours,
      undertimeMinutes: totalUndertime.minutes,
      status: "Submitted",
      pdfFileName: fileName,
      pdfFileSize: "325 KB",
      pdfDataUrl: pdfDataUrl,
      hasP12: Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12),
      signatureImage: signatureImage || undefined,
      employeeSignatureImage: signatureImage || undefined,
      employeeHasP12: Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12),
      employeeSignerName: p12SignerIdentity?.commonName || config.employeeName,
      supervisorSignatureImage: undefined,
      supervisorHasP12: false,
      signerName: undefined,
      rows: rows,
      remarks: `Moved to ${targetProvinceTab} Provincial Archive by ${activeUser?.name || "User"}`
    });

    refreshCounts();
    // Switch active view directly to the 4th tab: Provincial Module -> Selected Province Sub-Tab
    setActiveSubModule("provincial");
    setActiveProvinceTab(targetProvinceTab);
    showNotification(`✓ Moved DTR for "${safeName}" to ${targetProvinceTab} Provincial Module!`);
  };

  // Save current generated DTR to Storage Repository
  const handleSaveToStorage = () => {
    const safeName = (config.employeeName || "PERSONNEL").trim().toUpperCase();
    const renderedDays = rows.filter((r) => !r.isCustomLabel && r.amArrival).length;
    const renderedHours = renderedDays * 8;
    const fileName = `DTR_${safeName.replace(/[^a-zA-Z0-9]/g, "_")}_${MONTH_NAMES[config.month]}_${config.year}.pdf`;

    const selectedProv = config.province || "Regional Office (RO)";
    let targetProvinceTab: ProvincialTab = "Regional Off";
    if (selectedProv === "Regional Office (RO)" || selectedProv === "RO") {
      targetProvinceTab = "Regional Off";
    } else {
      targetProvinceTab = selectedProv as ProvincialTab;
    }

    const activeUser = getCurrentUser();
    const userAuditId = activeUser?.id || currentUser?.id || "";

    let pdfDataUrl: string | undefined;
    const empHasP12 = Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12);
    const empSignerName = p12SignerIdentity?.commonName || config.employeeName;
    try {
      const { doc } = generateDtrVectorPdf(
        {
          ...config,
          status: "Submitted",
          employeeSignatureImage: signatureImage || undefined,
          employeeHasP12: empHasP12,
          employeeSignerName: empSignerName,
          supervisorSignatureImage: undefined,
          supervisorHasP12: false,
        },
        rows,
        signatureImage,
        empHasP12,
        null,
        empSignerName
      );
      pdfDataUrl = doc.output("datauristring");
    } catch (e) {
      console.warn("Could not generate PDF data URL for storage:", e);
    }

    addDtrRecord({
      userId: userAuditId ? String(userAuditId) : undefined,
      employeeName: safeName,
      employeeId: `DICT-R5-${config.year}-${Math.floor(100 + Math.random() * 900)}`,
      position: "Technical Specialist / Engineer",
      employmentStatus: "Regular",
      module: "PROVINCIAL",
      province: targetProvinceTab,
      sectionDivision: selectedProv === "Regional Office (RO)" ? "Regional Operations (RO)" : `${selectedProv} Provincial Office`,
      periodText: config.periodText,
      month: config.month,
      year: config.year,
      scope: config.scope,
      regularHours: config.regularHours,
      saturdayHours: config.saturdayHours,
      supervisorName: config.supervisorName,
      supervisorTitle: config.supervisorTitle,
      totalDaysRendered: renderedDays,
      totalHoursRendered: renderedHours,
      undertimeHours: totalUndertime.hours,
      undertimeMinutes: totalUndertime.minutes,
      status: "Submitted",
      pdfFileName: fileName,
      pdfFileSize: "325 KB",
      pdfDataUrl: pdfDataUrl,
      hasP12: Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12),
      signatureImage: signatureImage || undefined,
      employeeSignatureImage: signatureImage || undefined,
      employeeHasP12: Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12),
      employeeSignerName: p12SignerIdentity?.commonName || config.employeeName,
      supervisorSignatureImage: undefined,
      supervisorHasP12: false,
      signerName: undefined,
      rows: rows,
      remarks: `Generated via CS Form 48 Interactive Generator for ${selectedProv}`
    });

    refreshCounts();
    showNotification(`DTR for ${safeName} saved to ${selectedProv} Archive!`);
  };

  // Calculate totals
  const totalUndertime = rows.reduce(
    (acc, r) => {
      const h = parseInt(r.undertimeHours, 10) || 0;
      const m = parseInt(r.undertimeMinutes, 10) || 0;
      return { hours: acc.hours + h, minutes: acc.minutes + m };
    },
    { hours: 0, minutes: 0 }
  );

  const totalProvincialCount = (Object.values(storageCounts.provincial) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-200 flex flex-col max-w-[1920px] mx-auto print:min-h-0 print:h-auto print:bg-white print:text-black print:m-0 print:p-0 print:block">
      
      {/* Top Bar Banner & Sub-Module Selector */}
      <div className="bg-[#0C101A] border-b border-[#1A2235] px-6 py-4 space-y-4 print:hidden">
        
        {/* Header Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  DICT Region V
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Civil Service Form No. 48 System
                </span>
              </div>
              <h1 className="text-lg font-black text-white tracking-tight mt-0.5">
                Daily Time Record Management & Generator Module
              </h1>
            </div>
          </div>

          {notification && (
            <div className="px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl animate-in fade-in flex items-center gap-1.5 shadow-md">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {notification}
            </div>
          )}
        </div>

        {/* Sub-Module Navigation Switcher */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Sub-Module 1: Generator */}
          <button
            type="button"
            onClick={() => setActiveSubModule("generator")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubModule === "generator"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                : "bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            DTR Generator (CS Form 48)
          </button>

          {/* Sub-Module 2: HRM - Module */}
          <button
            type="button"
            onClick={() => setActiveSubModule("hrm")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubModule === "hrm"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                : "bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Users2 className="w-4 h-4" />
            HRM - module
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubModule === "hrm" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {storageCounts.hrm}
            </span>
          </button>

          {/* Sub-Module 3: TOD - Module */}
          <button
            type="button"
            onClick={() => setActiveSubModule("tod")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubModule === "tod"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                : "bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Building2 className="w-4 h-4" />
            TOD - module
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubModule === "tod" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {storageCounts.tod}
            </span>
          </button>

          {/* Sub-Module 4: Provincial - Module */}
          <button
            type="button"
            onClick={() => setActiveSubModule("provincial")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubModule === "provincial"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-900/40"
                : "bg-[#111728] border border-[#1C2844] text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Provincial - module
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeSubModule === "provincial" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {totalProvincialCount}
            </span>
          </button>
        </div>

        {/* Nested Tabs inside Provincial - module */}
        {activeSubModule === "provincial" && (
          <div className="pt-2 border-t border-[#1A2235] flex flex-wrap items-center gap-1.5 animate-in fade-in">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mr-2 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Provincial Units:
            </span>
            {PROVINCIAL_TABS.map((p) => {
              const isActive = activeProvinceTab === p;
              const count = storageCounts.provincial[p] || 0;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActiveProvinceTab(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-950/40"
                      : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  <span>{p}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? "bg-amber-400/20 text-amber-300" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SUB-MODULE VIEW 1: HRM - MODULE (STORAGE & VERIFICATION)                 */}
      {/* ========================================================================= */}
      {activeSubModule === "hrm" && (
        <div className="p-6">
          <DtrStorageView
            module="HRM"
            title="Human Resource Management (HRM) DTR Storage Archive"
            description="Centralized daily time record document repository for DICT Region 5 HR personnel, administrative officers, and regional plantilla submissions. View official PDF Form 48 documents, download archives, or verify compliance."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODULE VIEW 2: TOD - MODULE (STORAGE & VERIFICATION)                 */}
      {/* ========================================================================= */}
      {activeSubModule === "tod" && (
        <div className="p-6">
          <DtrStorageView
            module="TOD"
            title="Technical Operations Division (TOD) DTR Storage Archive"
            description="Official daily time record storage for Technical Operations Division engineers, project focal leads (Free Wi-Fi, GovNet, GECS, Cybersecurity), and technical field specialists under TOD supervision."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODULE VIEW 3: PROVINCIAL - MODULE (7 PROVINCIAL TABS)               */}
      {/* ========================================================================= */}
      {activeSubModule === "provincial" && (
        <div className="p-6">
          <DtrStorageView
            module="PROVINCIAL"
            province={activeProvinceTab}
            title={`Provincial Field DTR Archive • ${activeProvinceTab}`}
            description={`Dedicated DTR document storage and verification queue for personnel stationed in ${activeProvinceTab}. Browse submitted Form 48s, preview authentic PDF formats with official signatures, and trigger instant PDF downloads.`}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODULE VIEW 4: DTR GENERATOR (INTERACTIVE CS FORM 48 BUILDER)         */}
      {/* ========================================================================= */}
      {activeSubModule === "generator" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-x-auto">
          
          {/* LEFT COLUMN: DTR GENERATOR CONTROLS */}
          <div className="w-full lg:w-[380px] xl:w-[410px] bg-[#0C101A] border-r border-[#1A2235] p-5 space-y-6 shrink-0 print:hidden overflow-y-auto custom-scrollbar">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black tracking-wide text-white uppercase">
                  DTR GENERATOR FOR PERSONNEL
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Civil Service Form No. 48 Dual Strip Builder
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveToStorage}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30 cursor-pointer"
                title="Save current generated DTR into Storage repository"
              >
                <Save className="w-3.5 h-3.5" />
                Save Record
              </button>
            </div>

            {/* Section 1: PERSONNEL CONFIGURATIONS */}
            <div className="space-y-3.5">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                1. PERSONNEL CONFIGURATIONS
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Employee Full Name
                  </label>
                  <input
                    type="text"
                    value={config.employeeName}
                    onChange={(e) => setConfig({ ...config, employeeName: e.target.value })}
                    placeholder="PERSONNEL"
                    className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Province / Station Assignment Dropdown */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <MapPin className="w-3.5 h-3.5" />
                      Station / Province Location
                    </span>
                    <span className="text-[10px] text-amber-400/90 font-mono px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                      Includes RO
                    </span>
                  </label>
                  <select
                    value={config.province || "Regional Office (RO)"}
                    onChange={(e) => setConfig({ ...config, province: e.target.value })}
                    className="w-full bg-[#151D2F] border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-semibold text-amber-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors cursor-pointer"
                  >
                    {DTR_PROVINCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#0C101A] text-slate-200">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <UserCheck className="w-3.5 h-3.5" />
                      Select Verifying Officer / Supervisor
                    </span>
                    <span className="text-[9.5px] text-blue-400/90 font-mono px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      PO • TOD • RD • ARD
                    </span>
                  </label>
                  <select
                    value={selectedOfficerOption}
                    onChange={(e) => handleSelectSupervisorOption(e.target.value)}
                    className="w-full bg-[#151D2F] border border-blue-500/40 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-colors cursor-pointer"
                  >
                    <option value="">-- Choose Verifying Officer (PO / TOD / RD / ARD) --</option>
                    <optgroup label="Technical Operations Division (TOD)">
                      <option value="norly-tabo">NORLY A. TABO — OIC Chief, TOD (Default)</option>
                      {registeredTod.map((u) => (
                        <option key={u.id} value={`u-${u.id}`}>{u.name} — {u.role}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Regional Director (RD)">
                      {registeredRd.map((u) => (
                        <option key={u.id} value={`u-${u.id}`}>{u.name} — Regional Director</option>
                      ))}
                      {registeredRd.length === 0 && (
                        <option value="default-rd">Regional Director — Regional Office (RO)</option>
                      )}
                    </optgroup>
                    <optgroup label="Asst. Regional Director (ARD)">
                      {registeredArd.map((u) => (
                        <option key={u.id} value={`u-${u.id}`}>{u.name} — Asst. Regional Director</option>
                      ))}
                      {registeredArd.length === 0 && (
                        <option value="default-ard">Asst. Regional Director — Regional Office (RO)</option>
                      )}
                    </optgroup>
                    <optgroup label="Provincial Officers (PO)">
                      {registeredPo.map((u) => (
                        <option key={u.id} value={`u-${u.id}`}>
                          {u.name} — Provincial Officer {u.focalProvince || u.region ? `(${u.focalProvince || u.region})` : ""}
                        </option>
                      ))}
                      <option value="po-albay">Provincial Officer — Albay</option>
                      <option value="po-cam-sur">Provincial Officer — Camarines Sur</option>
                      <option value="po-cam-norte">Provincial Officer — Camarines Norte</option>
                      <option value="po-catanduanes">Provincial Officer — Catanduanes</option>
                      <option value="po-masbate">Provincial Officer — Masbate</option>
                      <option value="po-sorsogon">Provincial Officer — Sorsogon</option>
                    </optgroup>
                    <option value="custom">✎ Custom / Type Manually...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Supervisor Name
                  </label>
                  <input
                    type="text"
                    value={config.supervisorName}
                    onChange={(e) => {
                      setSelectedOfficerOption("custom");
                      setConfig({ ...config, supervisorName: e.target.value });
                    }}
                    placeholder="NORLY A. TABO"
                    className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Supervisor Title
                  </label>
                  <input
                    type="text"
                    value={config.supervisorTitle}
                    onChange={(e) => {
                      setSelectedOfficerOption("custom");
                      setConfig({ ...config, supervisorTitle: e.target.value });
                    }}
                    placeholder="OIC Chief - Technical Operations Division"
                    className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Period / Target Month Range
                  </label>
                  <input
                    type="text"
                    value={config.periodText}
                    onChange={(e) => setConfig({ ...config, periodText: e.target.value })}
                    placeholder="MM DD-DD YYYY"
                    className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: OTC INPUT PARSER */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    2. OTC INPUT PARSER
                  </h3>
                  <span className="text-[10px] text-blue-400 font-semibold uppercase block">
                    SELECT ALL IN THE OTC AND PASTE HERE !!
                  </span>
                </div>

                <button
                  onClick={handleExecuteParse}
                  className="px-3 py-1.5 rounded-lg bg-[#1B263E] hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Execute Parse
                </button>
              </div>

              <textarea
                rows={4}
                value={otcRawText}
                onChange={(e) => setOtcRawText(e.target.value)}
                placeholder={`Paste log stream here...\nExample:\n104-06 07:34 am 12:03 pm\n104-07 07:45 am 12:00 pm 01:00 pm 05:00 pm`}
                className="w-full bg-[#080B12] border border-[#1A2235] rounded-lg p-3 text-[11px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none transition-colors"
              />
            </div>

            {/* Section 3: HOLIDAY / WEEKEND AUTO-FILL */}
            <div className="space-y-3.5">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                3. HOLIDAY / WEEKEND AUTO-FILL
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Month Target
                  </label>
                  <select
                    value={config.month}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10);
                      handleMonthYearChange(m, config.year, config.scope);
                    }}
                    className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-2.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Year Target
                  </label>
                  <input
                    type="number"
                    value={config.year}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10) || 2026;
                      handleMonthYearChange(config.month, y, config.scope);
                    }}
                    className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-2.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">
                  Action Scope
                </label>
                <select
                  value={config.scope}
                  onChange={(e) => {
                    const sc = e.target.value as "full" | "first-half" | "second-half";
                    handleMonthYearChange(config.month, config.year, sc);
                  }}
                  className="w-full bg-[#151D2F] border border-[#232F4D] rounded-lg px-2.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="full">Full Month (1-31)</option>
                  <option value="first-half">1st Half (1-15)</option>
                  <option value="second-half">2nd Half (16-31)</option>
                </select>
              </div>

              <button
                onClick={handleApplySmartTags}
                className="w-full py-2 rounded-lg bg-[#151D2F] hover:bg-[#1E293B] border border-[#232F4D] text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                Apply Smart Tags
              </button>
            </div>

            {/* Quick Tools */}
            <div className="pt-2 border-t border-[#1A2235] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleFillStandardTimes}
                  className="py-1.5 px-2 rounded-lg bg-[#111827] hover:bg-[#1F2937] border border-[#1F2937] text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Fill 8am-12pm and 1pm-5pm on working days"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Fill 8AM-5PM
                </button>

                <button
                  onClick={handleClearEntries}
                  className="py-1.5 px-2 rounded-lg bg-[#111827] hover:bg-red-950/40 border border-[#1F2937] hover:border-red-800 text-[11px] font-semibold text-slate-400 hover:text-red-400 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Entries
                </button>
              </div>
            </div>

            {/* Section 4: PNPKI DIGITAL SIGNATURE & .P12 KEYSTORE */}
            <div className="pt-2 space-y-3 border-t border-[#1A2235]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                    4. PNPKI DIGITAL SIGNATURE
                  </h3>
                </div>
                {signatureProfiles.length > 0 && (
                  <span className="text-[10px] text-slate-400 bg-[#151D2F] px-1.5 py-0.5 rounded font-mono border border-slate-700">
                    {signatureProfiles.length} in Turso
                  </span>
                )}
              </div>

              {/* Upload .p12 File */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <FileKey className="w-3.5 h-3.5 text-blue-400" />
                    PNPKI .p12 Certificate File
                  </span>
                  <span className="text-[9px] text-blue-400/90 font-mono">
                    .p12 / .pfx
                  </span>
                </label>

                <div className="relative">
                  <input
                    type="file"
                    accept=".p12,.pfx,application/x-pkcs12"
                    onChange={handleP12Upload}
                    disabled={Boolean(p12File)}
                    className="hidden"
                    id="p12-upload-input"
                  />
                  <label
                    htmlFor={p12File ? undefined : "p12-upload-input"}
                    className={
                      p12File
                        ? "w-full py-2 px-3 rounded-lg bg-[#111624] border border-dashed border-slate-700/60 text-slate-500 text-xs font-medium flex items-center justify-between cursor-not-allowed select-none opacity-50"
                        : "w-full py-2 px-3 rounded-lg bg-[#151D2F] hover:bg-[#1C263D] border border-[#232F4D] hover:border-blue-500/60 text-slate-300 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    }
                    title={p12File ? "Certificate active. Delete below to upload another." : "Upload .p12 certificate file"}
                  >
                    <span className="truncate max-w-[220px]">
                      {p12File ? "Upload Disabled (.p12 active)" : "Choose .p12 certificate file..."}
                    </span>
                    <UploadCloud className={p12File ? "w-4 h-4 text-slate-600 shrink-0" : "w-4 h-4 text-blue-400 shrink-0"} />
                  </label>
                </div>

                {p12File && (
                  <>
                    {/* Small active certificate box with hover delete action */}
                    <div className="group relative mt-2 p-2.5 rounded-lg bg-[#0F1626] border border-blue-500/30 hover:border-red-500/50 transition-all shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <FileKey className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate max-w-[180px]" title={p12File.name}>
                              {p12File.name}
                            </p>
                            <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> {(p12File.size / 1024).toFixed(1)} KB
                              {p12SignerIdentity?.commonName ? ` • Signer: ${p12SignerIdentity.commonName}` : " • Certificate Active"}
                            </p>
                          </div>
                        </div>

                        {/* Delete button: visible & highlighted on hover; deleting resets state and re-enables upload */}
                        <button
                          type="button"
                          onClick={() => {
                            setP12File(null);
                            setP12Password("");
                            setIsP12Unlocked(false);
                            setIsP12PasswordSaved(false);
                            showNotification("Deleted .p12 certificate. Upload button re-enabled.");
                          }}
                          className="px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                          title="Delete .p12 certificate and re-enable upload button"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete .p12</span>
                        </button>
                      </div>
                    </div>

                    {/* .p12 Keystore Password / PIN input - Hidden once password is already saved; only shows on fresh/re-upload */}
                    {!isP12PasswordSaved && (
                      <div className="mt-2 p-2.5 rounded-lg bg-[#0F1626] border border-blue-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-blue-300 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                            PNPKI .p12 Keystore Password:
                          </label>
                          {isP12Unlocked ? (
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 text-emerald-400" /> Keystore Unlocked
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-700/50 flex items-center gap-1">
                              <ShieldAlert className="w-2.5 h-2.5 text-amber-400" /> Password Required
                            </span>
                          )}
                        </div>

                        <div className="relative flex items-center">
                          <input
                            type={showP12Password ? "text" : "password"}
                            value={p12Password}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP12Password(val);
                              setIsP12Unlocked(Boolean(val.trim()));
                            }}
                            placeholder="Enter .p12 keystore password..."
                            className="w-full bg-[#151D2F] border border-[#232F4D] focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 pr-10 focus:outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowP12Password(!showP12Password)}
                            className="absolute right-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            title={showP12Password ? "Hide Password" : "Show Password"}
                          >
                            {showP12Password ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <label className="flex items-center gap-1.5 text-[9.5px] text-slate-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={savePasswordToDb}
                            onChange={(e) => setSavePasswordToDb(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span>Save password in Turso profile for quick signing</span>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Upload Digital Signature Image */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                    Digital Signature Image
                  </span>
                  <span className="text-[9px] text-purple-400/90 font-mono">
                    PNG / JPG
                  </span>
                </label>

                <div className="relative">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleSignatureImageUpload}
                    disabled={Boolean(signatureImage)}
                    className="hidden"
                    id="signature-image-input"
                  />
                  <label
                    htmlFor={signatureImage ? undefined : "signature-image-input"}
                    className={
                      signatureImage
                        ? "w-full py-2 px-3 rounded-lg bg-[#111624] border border-dashed border-slate-700/60 text-slate-500 text-xs font-medium flex items-center justify-between cursor-not-allowed select-none opacity-50"
                        : "w-full py-2 px-3 rounded-lg bg-[#151D2F] hover:bg-[#1C263D] border border-[#232F4D] hover:border-purple-500/60 text-slate-300 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    }
                    title={signatureImage ? "Signature image active. Delete below to upload another." : "Upload signature image"}
                  >
                    <span className="truncate max-w-[220px]">
                      {signatureImage ? "Upload Disabled (Image active)" : "Upload Signature Image..."}
                    </span>
                    <UploadCloud className={signatureImage ? "w-4 h-4 text-slate-600 shrink-0" : "w-4 h-4 text-purple-400 shrink-0"} />
                  </label>
                </div>

                {signatureImage && (
                  <div className="mt-2 p-2 rounded-lg bg-white/95 border border-slate-300 flex items-center justify-between shadow-sm">
                    <img
                      src={signatureImage}
                      alt="Signature Preview"
                      className="h-9 max-w-[180px] object-contain mix-blend-multiply"
                    />
                    <button
                      type="button"
                      onClick={() => setSignatureImage(null)}
                      className="text-slate-600 hover:text-red-600 p-1 transition-colors cursor-pointer"
                      title="Clear Signature Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Save Signature to Turso button */}
              <button
                type="button"
                onClick={handleSaveSignatureProfile}
                disabled={isSavingSig}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingSig ? "Saving to Turso..." : "Save Signature to Turso Database"}
              </button>
            </div>

            {/* Section 5: EXPORT & ACTIONS */}
            <div className="pt-2 space-y-2.5">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                5. EXPORT & ACTIONS
              </h3>

              {/* Save as Real Vector PDF */}
              <button
                type="button"
                onClick={handleRequestPdfExport}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all cursor-pointer active:scale-[0.99]"
                title={Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12) ? "Generate real vector PDF with PNPKI cryptographic digital signature" : "Generate authentic Civil Service Form 48 vector PDF"}
              >
                <FileDown className="w-4 h-4 text-white" />
                {Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12)
                  ? "Save as PDF (PNPKI Digitally Signed)"
                  : "Save as PDF (Civil Service Form 48)"}
              </button>

              {/* Move to PO Button (Transfers PDF to Provincial Module under selected Province) */}
              <button
                type="button"
                onClick={handleMoveToPo}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer active:scale-[0.99]"
                title={`Move generated PDF to Provincial Module under ${config.province || "selected province"}`}
              >
                <MapPin className="w-4 h-4 text-amber-200" />
                Move to PO
              </button>

              {/* Option to export standard PDF even if P12 profile is attached */}
              {Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12) && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadDtrVectorPdf(config, rows, signatureImage, false, null);
                      showNotification("✓ Exported standard CS Form 48 vector PDF (Unsigned Mode)!");
                    } catch (e: any) {
                      showNotification(`⚠️ Export failed: ${e.message}`);
                    }
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#0F1422] hover:bg-[#182035] border border-dashed border-slate-700/70 text-slate-400 hover:text-slate-200 text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Export standard CS Form 48 without applying digital certificate"
                >
                  <FileText className="w-3 h-3 text-slate-400" />
                  Save as Standard PDF (Without Digital Signature)
                </button>
              )}

              {/* Print Layout */}
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-[#151D2F] hover:bg-[#1C263D] border border-[#232F4D] text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                title="Trigger browser print dialog with optimized side-by-side 8.5x11 layout"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                Print Layout (Browser Print Dialog)
              </button>

              {/* Export XLSX */}
              <button
                type="button"
                onClick={() => exportDtrToExcel(config, rows)}
                className="w-full py-2 rounded-xl bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export Document ( XLSX )
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: DUAL CS FORM NO. 48 PREVIEW */}
          <div className="flex-1 bg-[#07090E] p-4 lg:p-8 flex justify-center items-start overflow-x-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:block">
            
            {/* Printable White Sheet Container (Contains 2 identical side-by-side Form 48s) */}
            <div className="bg-white text-black p-6 rounded shadow-2xl w-full max-w-[1050px] min-w-[860px] grid grid-cols-2 gap-6 print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:gap-4 print:grid-cols-2 select-text">
              
              {/* COPY 1 (LEFT FORM) */}
              <DtrFormCopy
                config={config}
                rows={rows}
                totalUndertime={totalUndertime}
                signatureImage={signatureImage}
                hasP12={Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12)}
                p12SignerName={p12SignerIdentity?.commonName}
                onCellChange={handleCellChange}
                onToggleRowType={handleToggleRowType}
                onShowValidationStatus={() => setShowValidationStatusModal(true)}
              />

              {/* COPY 2 (RIGHT FORM) */}
              <DtrFormCopy
                config={config}
                rows={rows}
                totalUndertime={totalUndertime}
                signatureImage={signatureImage}
                hasP12={Boolean(p12File?.base64 || signatureProfiles.find(p => p.id === selectedProfileId || (selectedUserId && p.user_Id === selectedUserId) || (currentUser?.id && p.user_Id === String(currentUser.id)))?.hasP12)}
                p12SignerName={p12SignerIdentity?.commonName}
                onCellChange={handleCellChange}
                onToggleRowType={handleToggleRowType}
                onShowValidationStatus={() => setShowValidationStatusModal(true)}
              />

            </div>

          </div>

        </div>
      )}

      {/* Signature Validation Status Modal (Matching Image 2) */}
      <DtrSignatureValidationModal
        isOpen={showValidationStatusModal}
        onClose={() => setShowValidationStatusModal(false)}
        signerName={config.employeeName}
      />

      {/* ========================================================================= */}
      {/* PNPKI .P12 PASSWORD REQUIREMENT MODAL                                     */}
      {/* ========================================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1322] border border-blue-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  {passwordModalReason === "account_sign"
                    ? "Account Password Required"
                    : "PNPKI .p12 Password Required"}
                </h3>
                <p className="text-xs text-slate-400">
                  {passwordModalReason === "account_sign"
                    ? "Enter your web application login password to authorize and digitally sign this DTR."
                    : passwordModalReason === "save"
                    ? "Enter password before saving your .p12 certificate profile."
                    : passwordModalReason === "apply"
                    ? "Enter your .p12 password to unlock and apply this digital signature to your DTR."
                    : "Enter your .p12 password to authorize and digitally sign this DTR."}
                </p>
              </div>
            </div>

            {p12File && passwordModalReason !== "account_sign" && (
              <div className="px-3 py-2 rounded-lg bg-[#151D2F] border border-[#232F4D] flex items-center justify-between text-xs">
                <span className="text-slate-300 font-mono truncate max-w-[260px] flex items-center gap-1.5">
                  <FileKey className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  {p12File.name}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {(p12File.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                {passwordModalReason === "account_sign"
                  ? `Account Login Password (${currentUser?.email || currentUser?.name || "User"}):`
                  : "Keystore Passphrase / PIN:"}
              </label>
              <div className="relative flex items-center">
                <input
                  type={showP12Password ? "text" : "password"}
                  value={modalPasswordInput}
                  onChange={(e) => {
                    setModalPasswordInput(e.target.value);
                    setModalPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmPasswordModal();
                  }}
                  autoFocus
                  placeholder={
                    passwordModalReason === "account_sign"
                      ? "Enter your account login password..."
                      : "Enter certificate password..."
                  }
                  className="w-full bg-[#151D2F] border border-[#232F4D] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 pr-10 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowP12Password(!showP12Password)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showP12Password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {modalPasswordError && (
                <p className="text-[11px] text-red-400 font-medium pt-0.5">
                  {modalPasswordError}
                </p>
              )}
            </div>

            {passwordModalReason !== "account_sign" && (
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={savePasswordToDb}
                  onChange={(e) => setSavePasswordToDb(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span>Remember and save password in Turso profile</span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A2235]">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setModalPasswordError("");
                  setPendingApplyProfile(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#151D2F] hover:bg-[#1E293B] text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPasswordModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-900/40"
              >
                <Check className="w-3.5 h-3.5" />
                {passwordModalReason === "account_sign"
                  ? "Authorize & Sign"
                  : passwordModalReason === "save"
                  ? "Save Profile"
                  : passwordModalReason === "apply"
                  ? "Unlock & Apply"
                  : "Authorize & Sign"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

interface DtrFormCopyProps {
  config: DtrConfig;
  rows: DtrRow[];
  totalUndertime: { hours: number; minutes: number };
  signatureImage?: string | null;
  hasP12?: boolean;
  p12SignerName?: string;
  onCellChange: (dayIndex: number, field: keyof DtrRow, value: string) => void;
  onToggleRowType: (dayIndex: number) => void;
  onShowValidationStatus?: () => void;
}

function DtrFormCopy({
  config,
  rows,
  totalUndertime,
  signatureImage,
  hasP12,
  p12SignerName,
  onCellChange,
  onToggleRowType,
  onShowValidationStatus,
}: DtrFormCopyProps) {
  return (
    <div className="p-2 flex flex-col justify-between font-sans text-[11px] leading-tight bg-white select-text">
      
      {/* Header */}
      <div className="text-center space-y-0.5">
        <div className="text-[9px] italic text-left tracking-tight font-sans">
          Civil Service Form No. 48
        </div>

        <h2 className="text-xs font-bold tracking-wider uppercase font-sans mt-0.5">
          DAILY TIME RECORD
        </h2>
        <div className="text-[9px] tracking-widest text-slate-700">----- oOo -----</div>

        {/* Employee Name */}
        <div className="pt-2">
          <div className="border-b border-black text-center font-bold text-xs uppercase tracking-wide px-2 pb-0.5 min-h-[18px]">
            {config.employeeName || "PERSONNEL"}
          </div>
          <div className="text-[8px] text-slate-600 font-sans tracking-tight pt-0.5">
            (Name)
          </div>
        </div>

        {/* Period */}
        <div className="flex items-center justify-between pt-1 text-[9.5px]">
          <span className="italic font-sans">For the month of</span>
          <span className="font-bold border-b border-black flex-1 text-center font-sans tracking-wide ml-1 uppercase">
            {config.periodText || "AUGUST 01-31, 2026"}
          </span>
        </div>

        {/* Office Hours (Matching Image 1 & Image 2) */}
        <div className="text-[8px] text-left pt-1.5 flex items-start justify-between">
          <div className="italic font-sans leading-tight">
            Office hours for arrival<br />
            and departure
          </div>
          <div className="space-y-1 text-right flex-1 pl-3">
            <div className="flex items-center justify-end gap-1 text-[8px]">
              <span className="italic font-sans">Regular days</span>
              <span className="border-b border-black inline-block min-w-[100px] text-center font-sans font-bold px-1">
                {config.regularHours || "\u00A0"}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1 text-[8px]">
              <span className="italic font-sans">Saturdays</span>
              <span className="border-b border-black inline-block min-w-[100px] text-center font-sans font-bold px-1">
                {config.saturdayHours || "\u00A0"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="my-2 border border-black">
        <table className="w-full text-center border-collapse text-[8.5px]">
          <thead>
            <tr className="border-b border-black bg-slate-100/90 font-bold">
              <th rowSpan={2} className="border-r border-black w-6 py-0.5">Days</th>
              <th colSpan={2} className="border-r border-black py-0.5">A.M.</th>
              <th colSpan={2} className="border-r border-black py-0.5">P.M.</th>
              <th colSpan={2} className="py-0.5">Undertime</th>
            </tr>
            <tr className="border-b border-black bg-slate-100/90 text-[7.5px] font-semibold">
              <th className="border-r border-black w-10 py-0.5">Arrival</th>
              <th className="border-r border-black w-10 py-0.5">Departure</th>
              <th className="border-r border-black w-10 py-0.5">Arrival</th>
              <th className="border-r border-black w-10 py-0.5">Departure</th>
              <th className="border-r border-black w-8 py-0.5">Hours</th>
              <th className="w-8 py-0.5">Minutes</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black text-[9px]">
            {rows.map((row, idx) => {
              if (row.isCustomLabel) {
                const labelUpper = (row.customLabel || "").trim().toUpperCase();
                const isWeekend = labelUpper.includes("SATURDAY") || labelUpper.includes("SUNDAY");
                const rowBg = isWeekend ? "#e5e7eb" : "#ffffff";
                const rowClass = isWeekend
                  ? "h-[14px] bg-gray-200 hover:bg-gray-300/80 transition-colors group"
                  : "h-[14px] bg-white hover:bg-slate-50 transition-colors group";
                const cellBgClass = isWeekend ? "bg-gray-200" : "bg-white";

                return (
                  <tr
                    key={row.day}
                    style={{ backgroundColor: rowBg }}
                    className={rowClass}
                  >
                    <td 
                      style={{ backgroundColor: rowBg }}
                      className={`border-r border-black font-bold text-center px-0.5 py-0 ${cellBgClass}`}
                    >
                      <div className="flex items-center justify-between px-0.5 min-h-[14px]">
                        <span className="text-[9px] font-bold text-black">{row.day}</span>
                        <button
                          type="button"
                          onClick={() => onToggleRowType(idx)}
                          title="Split into time columns"
                          className="p-0.5 rounded transition-all cursor-pointer bg-amber-200 hover:bg-amber-300 text-amber-900 print:hidden"
                        >
                          <Split className="w-2.5 h-2.5 text-amber-800" />
                        </button>
                      </div>
                    </td>
                    <td
                      colSpan={6}
                      style={{ backgroundColor: rowBg }}
                      className={`font-bold text-center text-black tracking-wider text-[8.5px] uppercase py-0 px-1 ${cellBgClass}`}
                    >
                      <input
                        type="text"
                        value={row.customLabel || ""}
                        onChange={(e) => onCellChange(idx, "customLabel", e.target.value)}
                        placeholder="SATURDAY / SUNDAY / HOLIDAY"
                        className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-bold text-[8.5px] uppercase tracking-wider text-black placeholder:text-slate-500 py-0"
                      />
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={row.day}
                  className="h-[14px] hover:bg-blue-50/50 transition-colors group"
                >
                  <td
                    className="border-r border-black font-bold text-center px-0.5 py-0 bg-slate-50/30"
                  >
                    <div className="flex items-center justify-between px-0.5 min-h-[14px]">
                      <span className="text-[9px]">{row.day}</span>
                      <button
                        type="button"
                        onClick={() => onToggleRowType(idx)}
                        title="Merge into single Note column (e.g. Saturday, Sunday, Holiday)"
                        className="p-0.5 rounded transition-all cursor-pointer text-slate-300 hover:text-blue-700 hover:bg-blue-100 opacity-40 group-hover:opacity-100 print:hidden"
                      >
                        <Merge className="w-2.5 h-2.5 text-blue-600" />
                      </button>
                    </div>
                  </td>
                  <td className="border-r border-black py-0 px-0.5">
                    <input
                      type="text"
                      value={row.amArrival}
                      onChange={(e) => onCellChange(idx, "amArrival", e.target.value)}
                      className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-medium"
                    />
                  </td>
                  <td className="border-r border-black py-0 px-0.5">
                    <input
                      type="text"
                      value={row.amDeparture}
                      onChange={(e) => onCellChange(idx, "amDeparture", e.target.value)}
                      className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-medium"
                    />
                  </td>
                  <td className="border-r border-black py-0 px-0.5">
                    <input
                      type="text"
                      value={row.pmArrival}
                      onChange={(e) => onCellChange(idx, "pmArrival", e.target.value)}
                      className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-medium"
                    />
                  </td>
                  <td className="border-r border-black py-0 px-0.5">
                    <input
                      type="text"
                      value={row.pmDeparture}
                      onChange={(e) => onCellChange(idx, "pmDeparture", e.target.value)}
                      className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-medium"
                    />
                  </td>
                  <td className="border-r border-black py-0 px-0.5">
                    <input
                      type="text"
                      value={row.undertimeHours}
                      onChange={(e) => onCellChange(idx, "undertimeHours", e.target.value)}
                      className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-medium text-slate-700"
                    />
                  </td>
                  <td className="py-0 px-0.5">
                    <input
                      type="text"
                      value={row.undertimeMinutes}
                      onChange={(e) => onCellChange(idx, "undertimeMinutes", e.target.value)}
                      className="w-full text-center bg-transparent focus:bg-white focus:outline-none font-medium text-slate-700"
                    />
                  </td>
                </tr>
              );
            })}

            {/* Total Row */}
            <tr className="border-t-2 border-black font-bold bg-slate-50 text-[9px]">
              <td colSpan={5} className="border-r border-black text-right pr-2 py-0.5 uppercase tracking-wider">
                TOTAL
              </td>
              <td className="border-r border-black text-center py-0.5">
                {totalUndertime.hours || "0"}
              </td>
              <td className="text-center py-0.5">
                {totalUndertime.minutes || "0"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Certification Footer (Strictly matching Image 2 - Fully stretched across table) */}
      <div className="mt-3.5 space-y-2.5 font-sans leading-tight">
        <div className="italic text-[11px] leading-[1.35] w-full select-text">
          <div className="flex justify-between w-full">
            {"I certify on my honor that the above is a true and correct report of the".split(" ").map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="flex justify-between w-full">
            {"hours of work performed, record of which was made daily at the time of".split(" ").map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="text-left">
            arrival and departure from office.
          </div>
        </div>

        {/* Employee Signature Area */}
        <div className="pt-2 flex flex-col items-center">
          {hasP12 ? (
            <div
              onClick={() => onShowValidationStatus?.()}
              className="bg-transparent px-2.5 py-1 flex items-center gap-2 cursor-pointer hover:bg-blue-500/10 hover:ring-1 hover:ring-blue-400/40 rounded transition-all mb-1"
              title="Click to view official PNPKI Digital Signature Validation Status"
            >
              {signatureImage && (
                <img
                  src={signatureImage}
                  alt="Signature"
                  className="h-6 max-w-[65px] object-contain mix-blend-multiply"
                />
              )}
              <div className="text-[7.5px] font-sans text-left leading-tight text-black">
                <div className="font-bold text-[8px]">Digitally signed</div>
                <div>by {(p12SignerName || config.employeeName || "PERSONNEL").trim()}</div>
              </div>
            </div>
          ) : signatureImage ? (
            <div className="flex flex-col items-center mb-1">
              <img
                src={signatureImage}
                alt="PNPKI Digital Signature"
                className="h-8 max-w-[130px] object-contain mix-blend-multiply drop-shadow-sm"
              />
            </div>
          ) : (
            <div className="h-6" />
          )}
          <div className="border-b border-black text-center font-bold uppercase tracking-wider text-[11px] font-sans pb-0.5 w-full">
            {config.employeeName || "PERSONNEL"}
          </div>
        </div>

        <p className="italic text-left pt-1.5 leading-tight text-[11px]">
          VERIFIED as to the prescribed office hours:
        </p>

        {/* Supervisor Signature Area with Space for Applying Digital Signature */}
        <div className="pt-2 flex flex-col items-center">
          {/* Space / Container for applying Supervisor Digital Signature */}
          <div className="h-8 min-h-[32px] flex items-center justify-center mb-1 w-full" />
          <div className="border-b border-black text-center font-bold uppercase tracking-wider text-[11px] font-sans pb-0.5 w-full">
            {config.supervisorName || "NORLY A. TABO"}
          </div>
          <div className="text-[9px] italic text-center font-sans text-black pt-1">
            {config.supervisorTitle || "OIC Chief - Technical Operations Division"}
          </div>
        </div>
      </div>

    </div>
  );
}
