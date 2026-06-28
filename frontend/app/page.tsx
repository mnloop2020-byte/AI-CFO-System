"use client";

import React, {
  useState, useEffect, useRef, useCallback, CSSProperties,
} from "react";

/* ═══════════════════════════════════════════════════════
   DESIGN TOKENS — Zemam Brand Identity
   Primary: deep purple #4B1FA8 → violet #7B3FD4 → lilac #C084FC
   Background: near-black with purple tint
═══════════════════════════════════════════════════════ */
const C = {
  /* Backgrounds */
  pageBg:        "#0D0818",
  sidebarBg:     "#100C1E",
  sidebarBdr:    "rgba(123,63,212,0.15)",
  topbarBg:      "rgba(13,8,24,0.9)",
  topbarBdr:     "rgba(123,63,212,0.12)",
  surfaceA:      "#170F2E",   // cards, bubbles
  surfaceB:      "#1E1440",   // hover state
  surfaceBdr:    "rgba(123,63,212,0.14)",

  /* Brand gradients */
  brandA:        "#4B1FA8",
  brandB:        "#7B3FD4",
  brandC:        "#A855F7",
  brandD:        "#C084FC",
  gradMain:      "linear-gradient(135deg, #4B1FA8 0%, #7B3FD4 60%, #A855F7 100%)",
  gradSoft:      "linear-gradient(135deg, #1E1440 0%, #2D1B60 100%)",
  gradUser:      "linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #9333EA 100%)",

  /* Text */
  textHigh:      "#F0EAFA",
  textMid:       "#B89FD8",
  textLow:       "#6B50A0",
  textFaint:     "#2D1F50",

  /* Semantic */
  green:         "#A3E635",
  red:           "#F87171",
  redBg:         "rgba(248,113,113,0.07)",
  redBdr:        "rgba(248,113,113,0.25)",

  /* Input */
  inputBg:       "#130E25",
  inputBdr:      "rgba(123,63,212,0.2)",
  inputFocus:    "rgba(123,63,212,0.55)",
};

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */
interface Message {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

/* ═══════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════ */
const Icons = {
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Bot: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4M8 15h.01M16 15h.01"/>
    </svg>
  ),
  User: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Warn: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Msg: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  // أيقونة سحابة الرفع الجديدة لـصندوق الـ PDF
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
};

/* ═══════════════════════════════════════════════════════
   ZEMAM LOGO SVG — بالألوان الحقيقية للشعار
═══════════════════════════════════════════════════════ */
function ZemamLogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <defs>
        <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4B1FA8"/>
          <stop offset="50%" stopColor="#7B3FD4"/>
          <stop offset="100%" stopColor="#C084FC"/>
        </linearGradient>
        <linearGradient id="lg2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C084FC"/>
          <stop offset="100%" stopColor="#7B3FD4"/>
        </linearGradient>
      </defs>
      <path
        d="M58 14 C68 20, 72 34, 66 46 C60 58, 46 65, 32 62 C20 59, 12 50, 14 38 C16 26, 28 18, 40 20 C46 21, 52 25, 52 32 C52 38, 46 42, 40 40"
        stroke="url(#lg1)" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <path
        d="M34 28 L50 28 L34 48 L50 48"
        stroke="url(#lg2)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="54" cy="50" r="5" fill="url(#lg1)" opacity="0.85"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════════════════ */
function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: C.gradUser,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
        boxShadow: "0 2px 10px rgba(124,58,237,0.4)",
      }}>
        <Icons.User />
      </div>
    );
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
      background: C.surfaceA,
      border: "1px solid rgba(123,63,212,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.brandC,
      boxShadow: "0 0 12px rgba(123,63,212,0.15)",
    }}>
      <Icons.Bot />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MESSAGE BUBBLE
═══════════════════════════════════════════════════════ */
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className="msg-anim" style={{
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      direction: "rtl",
      justifyContent: isUser ? "flex-start" : "flex-start",
    }}>
      <Avatar role={msg.role} />
      <div style={{
        maxWidth: "73%",
        padding: "11px 15px",
        borderRadius: isUser ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
        fontSize: 14,
        lineHeight: 1.78,
        color: msg.isError ? C.red : C.textHigh,
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
        background: msg.isError
          ? C.redBg
          : isUser
            ? C.gradUser
            : C.surfaceA,
        border: msg.isError
          ? `1px solid ${C.redBdr}`
          : isUser
            ? "none"
            : `1px solid ${C.surfaceBdr}`,
        boxShadow: isUser
          ? "0 4px 16px rgba(124,58,237,0.3)"
          : "0 2px 8px rgba(0,0,0,0.25)",
      }}>
        {msg.isError && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.red, marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
            <Icons.Warn /> خطأ في الاتصال
          </div>
        )}
        {msg.content}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TYPING INDICATOR
═══════════════════════════════════════════════════════ */
function TypingIndicator() {
  return (
    <div className="msg-anim" style={{ display: "flex", gap: 10, alignItems: "flex-start", direction: "rtl" }}>
      <Avatar role="assistant" />
      <div style={{
        background: C.surfaceA,
        border: `1px solid ${C.surfaceBdr}`,
        borderRadius: "14px 4px 14px 14px",
        padding: "13px 18px",
        display: "flex", gap: 5, alignItems: "center",
      }}>
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SUGGESTION CHIP
═══════════════════════════════════════════════════════ */
function Chip({ text, onClick }: { text: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 14px",
        borderRadius: 12,
        background: hov ? C.surfaceB : C.surfaceA,
        border: `1px solid ${hov ? "rgba(123,63,212,0.4)" : C.surfaceBdr}`,
        color: hov ? C.textHigh : C.textMid,
        fontSize: 13,
        textAlign: "right",
        direction: "rtl",
        gap: 10,
        transition: "all 0.15s ease",
        cursor: "pointer",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <span>{text}</span>
      <span style={{ color: hov ? C.brandC : C.textLow, flexShrink: 0, display: "flex", transform: "scaleX(-1)" }}>
        <Icons.Arrow />
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════ */
function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100%", padding: "0 24px", textAlign: "center", direction: "rtl",
    }}>
      <div className="glow-pulse" style={{
        width: 80, height: 80, borderRadius: 24,
        background: "linear-gradient(145deg, #1A0F35 0%, #2D1B60 100%)",
        border: "1px solid rgba(123,63,212,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 22,
      }}>
        <ZemamLogoMark size={52} />
      </div>

      <h2 style={{ fontSize: 21, fontWeight: 800, color: C.textHigh, marginBottom: 10 }}>
        كيف يمكنني مساعدتك؟
      </h2>
      <p style={{
        fontSize: 13.5, color: C.textMid, lineHeight: 1.85,
        maxWidth: 310, marginBottom: 30,
      }}>
        مساعدك الذكي المدعوم ببيانات شركة زمام. اسألني عن خدماتنا أو رؤيتنا أو أي تفاصيل تخص الشركة.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340 }}>
        {[
          "ما هي خدمات شركة زمام؟",
          "ما التقنيات التي تستخدمها الشركة؟",
          "ما رؤية ورسالة زمام؟",
        ].map((s, i) => (
          <Chip key={i} text={s} onClick={() => onSuggestion(s)} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════ */
function Sidebar({
  conversationId, onNew, onClose, isMobile, uploading, uploadStatus, onFileUpload,
}: {
  conversationId: string;
  onNew: () => void;
  onClose: () => void;
  isMobile: boolean;
  uploading: boolean;
  uploadStatus: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [btnHov, setBtnHov] = useState(false);
  const [dropHov, setDropHov] = useState(false);

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: C.sidebarBg,
      direction: "rtl",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "18px 16px 16px",
        borderBottom: `1px solid ${C.sidebarBdr}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <ZemamLogoMark size={40} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.textHigh, letterSpacing: "0.01em" }}>
              زمـام AI
            </div>
            <div style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: "0.14em",
              background: C.gradMain,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginTop: 1,
            }}>
              ZEMAM INTELLIGENCE
            </div>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{ color: C.textLow, display: "flex", padding: 4 }}>
            <Icons.Close />
          </button>
        )}
      </div>

      {/* ── New conversation ── */}
      <div style={{ padding: "14px 14px 5px" }}>
        <button
          onClick={onNew}
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px",
            borderRadius: 11,
            background: btnHov
              ? "linear-gradient(135deg, #3B138A, #6B2FC4)"
              : C.gradMain,
            color: "#fff",
            fontSize: 13.5, fontWeight: 700,
            transition: "all 0.15s",
            boxShadow: btnHov
              ? "0 4px 20px rgba(123,63,212,0.5)"
              : "0 4px 16px rgba(123,63,212,0.35)",
            transform: btnHov ? "translateY(-1px)" : "none",
            fontFamily: "'Cairo', sans-serif",
          }}
        >
          <Icons.Plus />
          محادثة جديدة
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════
         📦 NEW: DYNAMIC PDF UPLOAD BOX ZONE
         منطقة رفع ملفات الـ PDF وتغذية الـ RAG برمجياً وحياً
      ═══════════════════════════════════════════════════════ */}
      <div style={{ padding: "5px 14px 10px" }}>
        <label
          onMouseEnter={() => !uploading && setDropHov(true)}
          onMouseLeave={() => setDropHov(false)}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "14px", borderRadius: 12,
            background: uploading ? "rgba(123,63,212,0.03)" : dropHov ? C.surfaceB : C.surfaceA,
            border: uploading 
              ? "1px dashed rgba(123,63,212,0.3)" 
              : `1px dashed ${dropHov ? C.brandC : C.surfaceBdr}`,
            cursor: uploading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          {/* المخفي المسؤول عن التقاط شحنات الملفات من الكمبيوتر */}
          <input 
            type="file" 
            accept=".pdf" 
            onChange={onFileUpload} 
            disabled={uploading} 
            style={{ display: "none" }} 
          />
          
          <div style={{ 
            color: uploading ? C.brandC : dropHov ? C.textHigh : C.brandD, 
            display: "flex", marginBottom: 6,
            animation: uploading ? "spin 1.5s linear infinite" : "none"
          }}>
            <Icons.Upload />
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textHigh }}>
            {uploading ? "جاري المعالجة الحية للـ RAG..." : "تغذية الذكاء الاصطناعي بملف PDF"}
          </div>

          {uploadStatus ? (
            <div style={{ 
              fontSize: 10, 
              color: uploadStatus.includes("فشل") || uploadStatus.includes("خطأ") ? C.red : C.green, 
              marginTop: 5, fontWeight: 600, lineHeight: 1.4 
            }}>
              {uploadStatus}
            </div>
          ) : (
            <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 4 }}>
              ارفع ملف الشركة لتحديث البيانات تلقائياً
            </div>
          )}
        </label>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: C.sidebarBdr, margin: "0 14px" }} />

      {/* ── Conversation status ── */}
      <div style={{ flex: 1, padding: "14px", overflowY: "auto" }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.13em",
          color: C.textLow, textTransform: "uppercase", marginBottom: 10,
        }}>
          الجلسة الحالية
        </div>

        {conversationId ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(123,63,212,0.08)",
            border: "1px solid rgba(123,63,212,0.2)",
          }}>
            <span className="status-dot" style={{ background: C.green }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, color: C.textMid, fontWeight: 600, marginBottom: 2 }}>محادثة نشطة</div>
              <div style={{
                fontSize: 10, color: C.textLow,
                fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {conversationId}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: "13px 14px", borderRadius: 10, textAlign: "center",
            background: "rgba(255,255,255,0.015)",
            border: "1px dashed rgba(123,63,212,0.15)",
          }}>
            <div style={{ fontSize: 12, color: C.textLow }}>لا توجد محادثات بعد</div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 3 }}>ابدأ بكتابة رسالتك</div>
          </div>
        )}
      </div>

      {/* ── User profile ── */}
      <div style={{
        margin: "0 14px 14px",
        padding: "10px 12px",
        borderRadius: 11,
        background: "rgba(123,63,212,0.06)",
        border: `1px solid ${C.sidebarBdr}`,
        display: "flex", alignItems: "center", gap: 10,
        direction: "rtl",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg, #3B138A, #6B2FC4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800, color: "#E9D5FF",
          boxShadow: "0 2px 8px rgba(123,63,212,0.3)",
        }}>م</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textHigh }}>محمد الهافيدي</div>
          <div style={{ fontSize: 11, color: C.textLow, marginTop: 1 }}>مطور واجهات</div>
        </div>
        <span className="status-dot" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function ZemamChat() {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [conversationId, setConvId]   = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  const [inputFocus, setInputFocus]   = useState(false);
  const [sendHov, setSendHov]         = useState(false);

  /* 📦 NEW REACT STATES: For Managing PDF upload flows */
  const [uploading, setUploading]     = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Responsive */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* Auto-resize textarea */
  const resizeTA = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);
  useEffect(() => { resizeTA(); }, [input, resizeTA]);

  /* New conversation */
  const startNew = () => {
    setMessages([]); setConvId("");
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  /* 📦 NEW HANDLER FUNCTION: Uploading file package to backend server */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // صمام أمان للتأكد من أن المستخدم اختار ملف PDF حقيقي
    if (file.type !== "application/pdf") {
      setUploadStatus("خطأ: يرجى اختيار ملف بصيغة PDF فقط.");
      return;
    }

    setUploading(true);
    setUploadStatus("جاري الرفع والتقطيع تلقائياً...");

    // بناء حزمة الـ Multipart FormData لشحن الـ Binary Data عبر الشبكة
    const formData = new FormData();
    formData.append("file", file); // المفتاح "file" متطابق مع اسم الحارس في الباكيند Multer

    try {
      const res = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData, // إرسال حزمة البيانات المرفقة مباشرة بدون كود Headers مخصص
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      // تم الحفظ وتوليد الـ Vector بنجاح كامل في السيرفر وقاعدة البيانات
      setUploadStatus(`تم الحفظ الحار! وتقطيع ${data.chunksCount} سياق بنجاح.`);
    } catch (err) {
      console.error("حدث خطأ في الفرونت إيند أثناء الرفع:", err);
      setUploadStatus("فشل في الرفع. تأكد من تشغيل الباكيند.");
    } finally {
      setUploading(false);
    }
  };

  /* Send — contract unchanged: conversationId + message → reply + conversationId */
  const send = async (text: string) => {
    const t = text.trim();
    if (!t || isLoading) return;
    setInput("");
    setIsLoading(true);
    setSidebarOpen(false);

    const next: Message[] = [...messages, { role: "user", content: t }];
    setMessages(next);

    try {
      const res = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId || undefined, message: t }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.reply) {
        setMessages([...next, { role: "assistant", content: data.reply }]);
        if (data.conversationId) setConvId(data.conversationId);
      }
    } catch (err) {
      console.error(err);
      setMessages([...next, {
        role: "assistant",
        content: "تعذّر الاتصال بالسيرفر. تأكد من تشغيل الباكيند ثم حاول مجدداً.",
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const canSend = input.trim().length > 0 && !isLoading;
  const SIDEBAR_W = 268;

  /* ─── render ─── */
  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw",
      overflow: "hidden", background: C.pageBg,
      direction: "rtl",
      fontFamily: "'Cairo','Segoe UI',Arial,sans-serif",
      position: "relative",
    }}>

      {/* ════ MOBILE OVERLAY ════ */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(5,2,15,0.75)",
          backdropFilter: "blur(4px)",
        }} />
      )}

      {/* ════ SIDEBAR ════ */}
      <div style={{
        width: SIDEBAR_W, height: "100%", flexShrink: 0,
        position: isMobile ? "fixed" : "relative",
        top: 0, right: isMobile ? (sidebarOpen ? 0 : -SIDEBAR_W) : 0,
        zIndex: isMobile ? 50 : "auto",
        transition: "right 0.28s cubic-bezier(.4,0,.2,1)",
        borderLeft: `1px solid ${C.sidebarBdr}`,
      }}>
        <Sidebar
          conversationId={conversationId}
          onNew={startNew}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
          uploading={uploading}
          uploadStatus={uploadStatus}
          onFileUpload={handleFileUpload}
        />
      </div>

      {/* ════ MAIN AREA ════ */}
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
      }}>

        {/* ── Topbar ── */}
        <div style={{
          height: 56, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px",
          background: C.topbarBg,
          borderBottom: `1px solid ${C.topbarBdr}`,
          backdropFilter: "blur(14px)",
          direction: "rtl",
        }}>
          {/* Mobile burger */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                color: C.textMid, display: "flex", padding: "6px",
                borderRadius: 8, background: "rgba(123,63,212,0.08)",
                border: "1px solid rgba(123,63,212,0.15)", flexShrink: 0,
              }}
            >
              <Icons.Menu />
            </button>
          )}

          {/* Agent info */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            flex: 1, justifyContent: isMobile ? "center" : "flex-end",
            direction: "rtl",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: C.surfaceA,
              border: "1px solid rgba(123,63,212,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.brandC,
            }}>
              <Icons.Bot />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textHigh, lineHeight: 1.2 }}>
                المساعد الرقمي — زمام
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <span className="status-dot" style={{ width: 6, height: 6 }} />
                <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>متصل</span>
              </div>
            </div>
          </div>

          {/* Message count — desktop */}
          {!isMobile && messages.length > 0 && (
            <div style={{ fontSize: 11, color: C.textLow, flexShrink: 0 }}>
              {messages.length} رسالة
            </div>
          )}
          {isMobile && <div style={{ width: 42 }} />}
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", direction: "rtl" }}>
          <div style={{
            maxWidth: 700, margin: "0 auto",
            padding: "26px 16px 8px",
            minHeight: "100%",
            display: "flex", flexDirection: "column",
            direction: "rtl",
          }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EmptyState onSuggestion={(s) => { setInput(s); textareaRef.current?.focus(); }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                {isLoading && <TypingIndicator />}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input composer ── */}
        <div style={{
          flexShrink: 0,
          padding: "10px 16px 14px",
          background: `linear-gradient(to top, ${C.pageBg} 65%, transparent)`,
          direction: "rtl",
        }}>
          <div style={{
            maxWidth: 700, margin: "0 auto",
            borderRadius: 16,
            background: C.inputBg,
            border: `1.5px solid ${inputFocus ? C.inputFocus : C.inputBdr}`,
            boxShadow: inputFocus
              ? "0 0 0 3px rgba(123,63,212,0.1), 0 4px 20px rgba(0,0,0,0.3)"
              : "0 4px 20px rgba(0,0,0,0.3)",
            transition: "border-color 0.18s, box-shadow 0.18s",
            overflow: "hidden",
          }}>
            {/* Input row */}
            <div style={{
              display: "flex", alignItems: "flex-end",
              padding: "10px 10px 10px 12px", gap: 8, direction: "rtl",
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                onFocus={() => setInputFocus(true)}
                onBlur={() => setInputFocus(false)}
                disabled={isLoading}
                placeholder="اكتب رسالتك هنا..."
                rows={1}
                style={{
                  flex: 1, background: "transparent",
                  border: "none", outline: "none",
                  color: C.textHigh, fontSize: 14, lineHeight: 1.65,
                  resize: "none", maxHeight: 120, minHeight: 22,
                  direction: "rtl", textAlign: "right",
                  opacity: isLoading ? 0.5 : 1,
                  fontFamily: "'Cairo','Segoe UI',Arial,sans-serif",
                }}
              />
              {/* Send */}
              <button
                onClick={() => send(input)}
                disabled={!canSend}
                onMouseEnter={() => setSendHov(true)}
                onMouseLeave={() => setSendHov(false)}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: canSend
                    ? sendHov
                      ? "linear-gradient(135deg, #3B138A, #6B2FC4)"
                      : C.gradMain
                    : "rgba(123,63,212,0.1)",
                  color: canSend ? "#fff" : C.textLow,
                  transition: "all 0.15s",
                  boxShadow: canSend ? "0 2px 10px rgba(123,63,212,0.4)" : "none",
                  transform: canSend && sendHov ? "scale(0.94)" : "scale(1)",
                  cursor: canSend ? "pointer" : "not-allowed",
                  border: "none",
                }}
              >
                <span style={{ display: "flex", transform: "rotate(180deg) scaleY(-1)" }}>
                  <Icons.Send />
                </span>
              </button>
            </div>

            {/* Hint bar */}
            <div style={{
              padding: "0 14px 9px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              direction: "rtl",
            }}>
              <span style={{ fontSize: 10, color: C.textFaint }}>Shift + Enter لسطر جديد</span>
              {isLoading && (
                <span style={{ fontSize: 10, color: C.brandC, opacity: 0.9 }}>جاري المعالجة...</span>
              )}
            </div>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: "center", fontSize: 10,
            color: C.textFaint, marginTop: 10, letterSpacing: "0.04em",
          }}>
            زمام للذكاء الاصطناعي © ٢٠٢٦
          </p>
        </div>
      </div>
    </div>
  );
}