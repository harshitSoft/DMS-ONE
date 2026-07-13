import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../state/AuthContext";
import { dashboardRoute } from "../utils/roleRouting";
import { api } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [twoFactor, setTwoFactor] = useState(null);
  const [recoveryStep, setRecoveryStep] = useState("");
  const [forgotPasswordEnabled, setForgotPasswordEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, login, verifyTwoFactor, resendTwoFactorOtp, verifyForgotPasswordOtp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user) return;
    navigate(user.passwordChangeRequired ? "/profile" : dashboardRoute(user.role), { replace: true });
  }, [authLoading, navigate, user]);

  useEffect(() => {
    api.get("/auth/features").then(({ data }) => setForgotPasswordEnabled(Boolean(data.forgotPasswordOtp))).catch(() => setForgotPasswordEnabled(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        setTwoFactor(result);
        setMessage(result.message || `OTP sent to ${result.email}`);
        return;
      }
      navigate(dashboardRoute(result.role));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to login");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6 digit OTP sent to your email");
    setLoading(true);
    try {
      const verified = await verifyTwoFactor(twoFactor.userId, otp);
      navigate(dashboardRoute(verified.role));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const data = await resendTwoFactorOtp(twoFactor.userId);
      setMessage(data.message || "OTP sent to your email");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setTwoFactor(null);
    setRecoveryStep("");
    setOtp("");
    setError("");
    setMessage("");
  };

  const sendRecoveryOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password/send-otp", { email });
      setRecoveryStep("verify");
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send password recovery OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyRecoveryOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6 digit OTP sent to your email");
    setLoading(true);
    try {
      await verifyForgotPasswordOtp(email, otp);
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/70 to-indigo-100/60 px-4 py-8 text-slate-800">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-28 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl" />

      <motion.form
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        onSubmit={twoFactor ? verifyOtp : recoveryStep === "email" ? sendRecoveryOtp : recoveryStep === "verify" ? verifyRecoveryOtp : submit}
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-24px_rgba(30,64,175,0.28)] backdrop-blur-xl sm:p-8"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />

        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
            <ShieldCheck size={27} strokeWidth={2.2} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-indigo-600">DMS Workspace</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">Dealer Management System</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{twoFactor ? `Enter the verification code sent to ${twoFactor.email}` : recoveryStep ? "Recover access using your registered email" : "Secure access to your DMS workspace"}</p>
        </div>

          {error && <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-700 shadow-sm"><AlertCircle className="mt-0.5 shrink-0" size={17} /> <span>{error}</span></div>}
          {message && <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700 shadow-sm"><CheckCircle2 className="mt-0.5 shrink-0" size={17} /> <span>{message}</span></div>}

          {twoFactor || recoveryStep === "verify" ? (
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Verification code</span>
                <input className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 outline-none transition duration-200 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" required />
              </label>
              <button disabled={loading || authLoading} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60">
                {loading || authLoading ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} {loading || authLoading ? "Verifying..." : "Verify OTP"}
              </button>
              <div className="flex flex-wrap justify-center gap-2 text-sm">
                <button type="button" onClick={twoFactor ? resendOtp : sendRecoveryOtp} disabled={loading} className="rounded-md font-semibold text-indigo-700 transition hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50">Resend OTP</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={backToLogin} className="rounded-md font-semibold text-slate-600 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">Back to login</button>
              </div>
            </div>
          ) : recoveryStep === "email" ? (
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Registered email address</span>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
                </div>
              </label>
              <button disabled={loading} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-60">
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Mail size={17} />} Send recovery OTP
              </button>
              <button type="button" onClick={backToLogin} className="w-full text-sm font-semibold text-slate-600">Back to login</button>
            </div>
          ) : (
          <div className="space-y-5">
            <label className="block">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@company.com" required />
              </div>
            </label>
            <label className="block">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-12 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button disabled={loading || authLoading} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60">
              {loading || authLoading ? <Loader2 className="animate-spin" size={17} /> : <Lock size={17} />} {loading || authLoading ? "Signing in..." : "Sign in securely"}
            </button>
            {forgotPasswordEnabled && <div className="-mt-1 text-center"><button type="button" onClick={() => { setRecoveryStep("email"); setError(""); setMessage(""); }} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">Forgot Password?</button></div>}
          </div>
          )}

        <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs font-medium text-slate-400">Protected access for authorized users only.</p>
        </motion.form>
    </div>
  );
}
