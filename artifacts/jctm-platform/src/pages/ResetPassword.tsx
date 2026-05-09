import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { KeyRound, Eye, EyeOff, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { safeLocalSet } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ResetPassword() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Reset Password | JCTM Digital Sanctuary";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      setError("No reset token found. Please request a new password reset link.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          safeLocalSet("jctm_token", data.token);
        }
        setDone(true);
        toast.success("Password updated! You are now signed in.");
      } else {
        setError(data.error ?? "Password reset failed. Please request a new link.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength] ?? "";
  const strengthColor = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-emerald-400", "bg-green-500"][strength] ?? "";

  return (
    <Layout>
      <SEO
        title="Reset Password — JCTM Digital Sanctuary"
        description="Set a new password for your JCTM Digital Sanctuary member account."
        path="/reset-password"
      />
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/20">
              <KeyRound className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary mb-2">
              {done ? "Password Updated" : "Set New Password"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {done
                ? "Your password has been changed successfully."
                : "Enter your new password below to regain access to the Sanctuary."}
            </p>
          </motion.div>

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-2xl p-8 border border-accent/20 text-center"
            >
              <CheckCircle className="h-12 w-12 text-accent mx-auto mb-4" />
              <p className="text-primary font-semibold mb-2">You are now signed in!</p>
              <p className="text-sm text-muted-foreground mb-6">
                Your session has been restored. Head back to the Sanctuary.
              </p>
              <Button
                onClick={() => { window.location.href = `${BASE}/join`; }}
                className="bg-accent text-white hover:bg-accent/90 rounded-full px-8"
              >
                Go to My Dashboard
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel rounded-2xl p-8 border border-border/50"
            >
              {!token && error ? (
                <div className="text-center">
                  <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                  <p className="text-red-600 font-medium mb-2">Invalid Reset Link</p>
                  <p className="text-sm text-muted-foreground mb-5">{error}</p>
                  <Button
                    onClick={() => { window.location.href = `${BASE}/join`; }}
                    variant="outline"
                    className="rounded-full"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-primary mb-1.5 block flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> New Password *
                    </label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        autoComplete="new-password"
                        className="bg-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="mt-2">
                        <div className="flex gap-1 h-1.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={i}
                              className={`flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-muted"}`}
                            />
                          ))}
                        </div>
                        <p className={`text-[10px] mt-1 font-medium ${strength >= 3 ? "text-emerald-600" : "text-orange-500"}`}>
                          {strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-primary mb-1.5 block flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Confirm Password *
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Repeat your new password"
                        required
                        autoComplete="new-password"
                        className={`bg-white pr-10 ${confirm && confirm !== password ? "border-red-300 focus:ring-red-200" : confirm && confirm === password ? "border-emerald-300" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                    )}
                    {confirm && confirm === password && (
                      <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Passwords match
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !password || password !== confirm}
                    className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {loading ? "Updating Password..." : "Update Password"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Remembered your password?{" "}
                    <button
                      type="button"
                      onClick={() => { window.location.href = `${BASE}/join`; }}
                      className="text-accent hover:underline font-medium"
                    >
                      Sign in →
                    </button>
                  </p>
                </form>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
