"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Zap,
  ShieldCheck,
  Users,
  HelpCircle,
  Lock,
} from "lucide-react";

/**
 * HR Hybrid Workflow — Login page.
 *
 * Split-screen layout (brand panel left, form panel right). On mobile the
 * brand panel hides and the form centers. Authentication is Google SSO only
 * (corporate accounts on `@g.lpru.ac.th`).
 */
export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
      // If no error, the browser will redirect to Google
    } catch {
      setError("เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* ─── Left: brand panel (lg+) ──────────────────────────────────── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex xl:p-16">
        {/* Background effects */}
        <div className="absolute inset-0 dotted-bg opacity-30" />
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-[60%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[100px]" />

        {/* Top header */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/50">
            <span className="text-lg font-bold text-white tracking-tight">HR</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">
              HR Hybrid Workflow
            </h2>
            <p className="text-xs text-slate-400">Enterprise Edition · v2.4</p>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative z-10 mt-12 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">
              ระบบพร้อมใช้งาน · All systems operational
            </span>
          </div>

          <h1 className="mt-8 text-5xl xl:text-6xl font-bold text-white tracking-tight leading-[1.1]">
            HR Management <br />{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
              System.
            </span>
          </h1>

          <h3 className="mt-8 text-lg font-medium text-slate-200">
            ระบบรองรับการทำงานแบบผสมผสาน (Hybrid Workflow)
          </h3>

          <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
            จัดการคำขอลา การเดินทาง และการอนุมัติเอกสารทั้งแบบดิจิทัลและกระดาษ
            ในระบบเดียว ที่ปลอดภัยและตรวจสอบได้
          </p>

          {/* Feature pills */}
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl">
            <FeaturePill icon={Zap} title="รวดเร็ว" subtitle="อนุมัติแบบเรียลไทม์" tone="indigo" />
            <FeaturePill
              icon={ShieldCheck}
              title="ปลอดภัย"
              subtitle="SSO + Audit logging"
              tone="purple"
            />
            <FeaturePill
              icon={Users}
              title="ครอบคลุม"
              subtitle="รองรับทั้งองค์กร"
              tone="blue"
            />
          </div>

          {/* Stats bar */}
          <div className="mt-10 max-w-2xl flex items-stretch divide-x divide-white/10 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <Stat label="ผู้ใช้งาน" value="248" />
            <Stat label="อัปไทม์" value="99.9%" />
            <Stat label="คำขอ/เดือน" value="1.2k" />
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <p>© 2569 HR Hybrid Workflow</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300 transition-colors">
              นโยบายความเป็นส่วนตัว
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              ข้อตกลงการใช้งาน
            </a>
          </div>
        </div>
      </div>

      {/* ─── Right: form panel ────────────────────────────────────────── */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile compact logo */}
          <div className="lg:hidden mb-8 flex items-center justify-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-600 shadow-md shadow-indigo-200">
              <span className="text-base font-bold text-white tracking-tight">HR</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-900 leading-tight">
                HR Hybrid Workflow
              </div>
              <div className="text-xs text-slate-500 leading-tight">ระบบจัดการบุคลากร</div>
            </div>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              เข้าสู่ระบบ
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              กรุณาเข้าสู่ระบบด้วยบัญชีขององค์กร
            </p>
          </div>

          <div className="space-y-5">
            {/* Google SSO — primary action */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-14 gap-3 text-[15px] font-medium border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 hover:shadow-lg hover:shadow-slate-200/60 text-slate-800 transition-all"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <GoogleLogo />
                  เข้าสู่ระบบด้วย Google
                </>
              )}
            </Button>

            <p className="text-center text-xs text-slate-500">
              ใช้บัญชี{" "}
              <span className="font-mono font-medium text-slate-700">
                @g.lpru.ac.th
              </span>{" "}
              ขององค์กรเท่านั้น
            </p>

            {/* SSO info box */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex gap-3">
              <Lock className="size-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-0.5">
                  Single Sign-On ผ่าน Google Workspace
                </p>
                <p>
                  ระบบใช้การยืนยันตัวตนของ Google
                  รองรับ 2-Step Verification — ไม่ต้องตั้งรหัสผ่านใหม่
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="mt-10 border-t border-slate-100 pt-6 flex items-center justify-center">
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <HelpCircle className="size-4" />
              พบปัญหาการเข้าใช้งาน? ติดต่อฝ่ายทรัพยากรบุคคล
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  tone: "indigo" | "purple" | "blue";
}) {
  const toneCls = {
    indigo: "bg-indigo-500/20 text-indigo-300",
    purple: "bg-purple-500/20 text-purple-300",
    blue: "bg-blue-500/20 text-blue-300",
  }[tone];
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${toneCls}`}>
        <Icon size={16} />
      </div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-5 py-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{label}</div>
      <div className="text-xl font-bold text-white font-mono mt-0.5">{value}</div>
    </div>
  );
}

// ─── Google "G" Logo SVG ────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
