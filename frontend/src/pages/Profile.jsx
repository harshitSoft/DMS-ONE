import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock, Mail, Save, ShieldCheck, ToggleLeft, ToggleRight, UserRound } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { Button, Loading, PageHeader, SectionCard, StatusBadge, TextField, formatDate } from "../components/UI";
import { useAuth } from "../state/AuthContext";
import { roleRoutes, roleTabs } from "../utils/profileNavigation";

const emptyPasswordForm = { otp: "", newPassword: "", confirmPassword: "" };

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateStoredUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", ownerName: "" });
  const [passwords, setPasswords] = useState(emptyPasswordForm);
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentTabs = roleTabs[user?.role] || [];
  const currentRoute = roleRoutes[user?.role] || "/profile";
  const goToRoleTab = (tabId) => {
    sessionStorage.setItem("dms_profile_target_tab", tabId);
    navigate(currentRoute);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/profile/me");
    setProfile(data);
    setForm({
      name: data.user?.name || "",
      phone: data.dealer?.phone || "",
      ownerName: data.dealer?.ownerName || ""
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const initials = useMemo(() => {
    const label = profile?.user?.name || profile?.user?.email || "DMS";
    return label.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }, [profile]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.put("/profile/me", form);
      setProfile(data);
      const stored = localStorage.getItem("dms_user");
      if (stored) localStorage.setItem("dms_user", JSON.stringify({ ...JSON.parse(stored), name: data.user.name }));
      setMessage("Profile updated successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordOtp = async () => {
    setError("");
    setMessage("");
    setPasswordLoading(true);
    try {
      const { data } = await api.post("/profile/send-password-otp");
      setPasswordOtpSent(true);
      setMessage(data.message || "OTP sent to your registered email");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send password OTP");
    } finally {
      setPasswordLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!passwords.otp || !passwords.newPassword || !passwords.confirmPassword) return setError("All password fields are required");
    if (passwords.newPassword !== passwords.confirmPassword) return setError("New passwords do not match");
    if (passwords.newPassword.length < 6) return setError("New password must be at least 6 characters");

    setPasswordLoading(true);
    try {
      const { data } = await api.post("/profile/change-password-with-otp", passwords);
      setPasswords(emptyPasswordForm);
      setPasswordOtpSent(false);
      setMessage(data.message || "Password changed successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const changeRecoveredPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!passwords.newPassword || !passwords.confirmPassword) return setError("Both password fields are required");
    if (passwords.newPassword !== passwords.confirmPassword) return setError("New passwords do not match");
    if (passwords.newPassword.length < 6) return setError("New password must be at least 6 characters");
    setPasswordLoading(true);
    try {
      const { data } = await api.post("/profile/change-password-after-otp-login", {
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword
      });
      setPasswords(emptyPasswordForm);
      setProfile((current) => ({ ...current, user: { ...current.user, passwordChangeRequired: false, passwordChangedAt: new Date().toISOString() } }));
      updateStoredUser({ passwordChangeRequired: false });
      setMessage(data.message || "Password changed successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const toggleTwoFactor = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const enabled = !profile.user?.isTwoFactorEnabled;
      const { data } = await api.patch("/profile/2fa", { enabled });
      setProfile(data);
      const stored = localStorage.getItem("dms_user");
      if (stored) localStorage.setItem("dms_user", JSON.stringify({ ...JSON.parse(stored), isTwoFactorEnabled: data.user.isTwoFactorEnabled }));
      setMessage(data.message || (enabled ? "Two-Factor Authentication enabled" : "Two-Factor Authentication disabled"));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update Two-Factor Authentication");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout title="Profile" subtitle="Manage your account" tabs={currentTabs} activeTab="profile" onTab={goToRoleTab}><Loading /></Layout>;

  const infoRows = [
    ["Name", profile.user?.name],
    ["Email", profile.user?.email],
    ["Role", String(profile.user?.role || "").replaceAll("_", " ")],
    ["Status", profile.user?.status],
    ["Company", profile.company?.companyName],
    ["Dealer", profile.dealer?.dealerName],
    ["Dealer Location", [profile.dealer?.area, profile.dealer?.city, profile.dealer?.pincode].filter(Boolean).join(", ")],
    ["Created", formatDate(profile.user?.createdAt)],
    ["Last Updated", formatDate(profile.user?.updatedAt)],
    ["Password Changed", formatDate(profile.user?.passwordChangedAt)]
  ].filter(([, value]) => value);

  return (
    <Layout title="Profile" subtitle="Manage your account details and password" tabs={currentTabs} activeTab="profile" onTab={goToRoleTab}>
      <PageHeader eyebrow="Account" title="Profile" description="Review your account details, update basic information, and change your password securely." />
      {message && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      {profile.user?.passwordChangeRequired && <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Please change your password to secure your account.</div>}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <SectionCard title="User information">
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-200">{initials}</div>
            <h2 className="mt-4 text-xl font-semibold text-slate-950">{profile.user?.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{profile.user?.email}</p>
            <div className="mt-3 flex justify-center"><StatusBadge value={profile.user?.role} /></div>
          </div>
          <div className="mt-6 overflow-hidden divide-y divide-slate-100 rounded-xl border border-slate-200">
            {infoRows.map(([label, value], index) => (
              <div key={label} className={`flex justify-between gap-4 px-3 py-2 text-sm ${index % 2 ? "bg-stone-50" : "bg-white"}`}>
                <span className="text-slate-500">{label}</span>
                <span className="text-right font-semibold text-slate-800">{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Edit basic details">
            <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
              <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} icon={UserRound} required />
              <TextField label="Email" value={profile.user?.email || ""} icon={Mail} readOnly className="opacity-80" />
              {user?.role === "DEALER" && <TextField label="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />}
              {user?.role === "DEALER" && <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
              <div className="md:col-span-2"><Button type="submit" disabled={saving}><Save size={16} /> Save Details</Button></div>
            </form>
          </SectionCard>

          <SectionCard title="Change password">
            <div className={`rounded-md border p-4 ${profile.user?.passwordChangeRequired ? "border-amber-300 bg-amber-50 ring-4 ring-amber-100" : "border-slate-200 bg-stone-50"}`}>
              {profile.user?.passwordChangeRequired ? (
                <form onSubmit={changeRecoveredPassword} className="grid gap-4 md:grid-cols-2">
                  <p className="md:col-span-2 text-sm text-amber-800">Your recovery OTP was verified. Set a new password now; your old password will stop working immediately.</p>
                  {[
                    ["newPassword", "New password"],
                    ["confirmPassword", "Confirm new password"]
                  ].map(([key, label]) => (
                    <TextField key={key} label={label} type={showPassword ? "text" : "password"} value={passwords[key]} onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })} required minLength={6} />
                  ))}
                  <div className="md:col-span-2 flex items-center gap-3">
                    <Button type="submit" disabled={passwordLoading}><ShieldCheck size={16} /> Set New Password</Button>
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-sm font-semibold text-slate-600">{showPassword ? "Hide passwords" : "Show passwords"}</button>
                  </div>
                </form>
              ) : (
              <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <KeyRound size={18} className="text-indigo-600" />
                    <p className="font-semibold text-slate-950">Email OTP verification</p>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Send a one-time password to your registered email before setting a new password.</p>
                </div>
                <Button type="button" variant={passwordOtpSent ? "ghost" : "primary"} onClick={sendPasswordOtp} disabled={passwordLoading}>
                  <Mail size={16} /> {passwordOtpSent ? "Resend OTP" : "Send OTP"}
                </Button>
              </div>

              {passwordOtpSent && (
                <form onSubmit={changePassword} className="mt-5 grid gap-4 md:grid-cols-3">
                  {[
                    ["otp", "Email OTP", "text"],
                    ["newPassword", "New password", showPassword ? "text" : "password"],
                    ["confirmPassword", "Confirm new password", showPassword ? "text" : "password"]
                  ].map(([key, label, type]) => (
                    <label key={key} className="block">
                      <span className="text-sm font-semibold text-slate-600">{label}</span>
                      <div className="relative mt-1">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                          className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                          type={type}
                          value={passwords[key]}
                          onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                          required
                          minLength={key === "otp" ? 6 : 6}
                          maxLength={key === "otp" ? 6 : undefined}
                          inputMode={key === "otp" ? "numeric" : undefined}
                        />
                        {key !== "otp" && (
                          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Toggle password visibility">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        )}
                      </div>
                    </label>
                  ))}
                  <div className="md:col-span-3"><Button type="submit" disabled={passwordLoading}><ShieldCheck size={16} /> Change Password</Button></div>
                </form>
              )}
              </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Security Settings">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-stone-50 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  <p className="font-semibold text-slate-950">Two-Factor Authentication</p>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">When enabled, you will receive an OTP on your registered email during login.</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Current status: <span className={profile.user?.isTwoFactorEnabled ? "text-emerald-700" : "text-slate-500"}>{profile.user?.isTwoFactorEnabled ? "Enabled" : "Disabled"}</span></p>
              </div>
              <Button type="button" variant={profile.user?.isTwoFactorEnabled ? "ghost" : "primary"} onClick={toggleTwoFactor} disabled={saving}>
                {profile.user?.isTwoFactorEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {profile.user?.isTwoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}
