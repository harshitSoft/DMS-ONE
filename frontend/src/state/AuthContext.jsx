import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("dms_user");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem("dms_user");
      return null;
    }
  });
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("dms_token")));
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("dms_token");
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    api.get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        localStorage.setItem("dms_user", JSON.stringify(data.user));
        setUser(data.user);
        setAuthError("");
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem("dms_token");
        localStorage.removeItem("dms_user");
        setUser(null);
        setAuthError("Session expired. Please login again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const login = async (email, password) => {
    try {
      setAuthError("");
      const { data } = await api.post("/auth/login", { email, password });
      if (data.requiresTwoFactor) return data;
      localStorage.setItem("dms_token", data.token);
      localStorage.setItem("dms_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to login. Please check your credentials.";
      setAuthError(message);
      throw error;
    }
  };

  const verifyTwoFactor = async (userId, otp) => {
    try {
      setAuthError("");
      const { data } = await api.post("/auth/verify-2fa", { userId, otp });
      localStorage.setItem("dms_token", data.token);
      localStorage.setItem("dms_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || "Unable to verify OTP.";
      setAuthError(message);
      throw error;
    }
  };

  const resendTwoFactorOtp = async (userId) => {
    const { data } = await api.post("/auth/resend-2fa", { userId });
    return data;
  };

  const verifyForgotPasswordOtp = async (email, otp) => {
    const { data } = await api.post("/auth/forgot-password/verify-otp", { email, otp });
    localStorage.setItem("dms_token", data.token);
    localStorage.setItem("dms_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const updateStoredUser = (patch) => {
    setUser((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem("dms_user", JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem("dms_token");
    localStorage.removeItem("dms_user");
    setUser(null);
    setAuthError("");
  };

  const value = useMemo(() => ({ user, loading, authError, login, verifyTwoFactor, resendTwoFactorOtp, verifyForgotPasswordOtp, updateStoredUser, logout }), [user, loading, authError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
