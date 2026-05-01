"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Zap, 
  ShieldCheck, 
  Users, 
  Mail, 
  Lock, 
  Eye,
  HelpCircle,
  ArrowRight
} from "lucide-react";

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
      {/* Left Column - Dark Branding Section */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex xl:p-16">
        {/* Background Effects */}
        <div className="absolute inset-0 dotted-bg opacity-30"></div>
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[120px]"></div>
        <div className="absolute top-[60%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[100px]"></div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/50">
            <span className="text-lg font-bold text-white tracking-tight">HR</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">HR Hybrid Workflow</h2>
            <p className="text-xs text-slate-400">Enterprise Edition - v2.4</p>
          </div>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 mt-12 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-300">ระบบพร้อมใช้งาน · All systems operational</span>
          </div>

          <h1 className="mt-8 text-5xl xl:text-6xl font-bold text-white tracking-tight leading-[1.1]">
            HR Management <br /> System.
          </h1>

          <h3 className="mt-8 text-lg font-medium text-slate-200">
            ระบบรองรับการทำงานแบบผสมผสาน (Hybrid Workflow)
          </h3>
          
          <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
            จัดการคำขอลา การเดินทาง และการอนุมัติเอกสารทั้งแบบดิจิทัลและกระดาษ ในระบบเดียว ที่ปลอดภัยและตรวจสอบได้
          </p>

          {/* Feature Cards */}
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <Zap size={16} />
              </div>
              <h4 className="text-sm font-semibold text-white">รวดเร็ว</h4>
              <p className="text-xs text-slate-400 mt-1">อนุมัติแบบเรียลไทม์</p>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <ShieldCheck size={16} />
              </div>
              <h4 className="text-sm font-semibold text-white">ปลอดภัย</h4>
              <p className="text-xs text-slate-400 mt-1">เข้ารหัส End-to-End</p>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <Users size={16} />
              </div>
              <h4 className="text-sm font-semibold text-white">ครอบคลุม</h4>
              <p className="text-xs text-slate-400 mt-1">รองรับ 248+ พนักงาน</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <p>© 2569 HR Hybrid Workflow</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300 transition-colors">นโยบายความเป็นส่วนตัว</a>
            <a href="#" className="hover:text-slate-300 transition-colors">ข้อตกลงการใช้งาน</a>
          </div>
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-[400px] animate-fade-in">
          
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">เข้าสู่ระบบ</h2>
            <p className="mt-2 text-sm text-slate-500">กรุณาเข้าสู่ระบบด้วยบัญชีขององค์กร</p>
          </div>

          <div className="space-y-6">
            {/* Google Sign In */}
            <Button
              variant="outline"
              className="w-full h-12 gap-3 text-sm font-medium border-slate-200 hover:bg-slate-50 text-slate-700"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <GoogleLogo />
              )}
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
            </Button>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 px-4 text-xs text-slate-400 bg-white">หรือ · OR</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Email / Password Form (Visual Mock for now) */}
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleGoogleSignIn(); }}>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">อีเมล</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                  <input 
                    type="email" 
                    placeholder="name@company.co.th" 
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">รหัสผ่าน</label>
                  <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">ลืมรหัสผ่าน?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full h-11 pl-10 pr-10 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400 tracking-widest"
                    disabled={isLoading}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <Eye className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative flex items-center">
                    <input type="checkbox" className="peer sr-only" defaultChecked />
                    <div className="size-4 rounded-[4px] border border-slate-300 bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors"></div>
                    <svg className="absolute left-0 top-0 size-4 pointer-events-none stroke-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className="text-xs text-slate-600">จดจำการเข้าสู่ระบบ 30 วัน</span>
                </label>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck className="size-3.5" />
                  2FA Ready
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-12 mt-2 bg-slate-900 hover:bg-slate-800 text-white text-[15px] font-medium transition-colors group"
                disabled={isLoading}
              >
                {isLoading ? "กำลังดำเนินการ..." : "เข้าสู่ระบบ"}
                {!isLoading && <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </form>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="mt-10 border-t border-slate-100 pt-6 flex items-center justify-center">
            <button className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
              <HelpCircle className="size-4" />
              พบปัญหาการเข้าใช้งาน? ติดต่อฝ่ายทรัพยากรบุคคล
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Google "G" Logo SVG ──────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
