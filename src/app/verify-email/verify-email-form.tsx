"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  verifyRegistrationOtpAction,
  resendRegistrationOtpAction,
  getRegistrationVerificationStateAction,
  getVerificationStateAction,
} from "@/features/email-verification/actions";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Mail,
} from "lucide-react";

interface VerifyEmailFormProps {
  initialEmail?: string;
  initialChallengeId?: string;
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "your email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  const maskedLocal = `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

export function VerifyEmailForm({
  initialEmail = "",
  initialChallengeId = "",
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Auto-focus first input box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Load initial challenge state if challengeId or email is present
  useEffect(() => {
    let active = true;

    async function loadState() {
      if (initialChallengeId) {
        const res = await getVerificationStateAction(initialChallengeId);
        if (active && res.success) {
          setEmail(res.data.targetEmail);
          setChallengeId(res.data.challengeId);
          if (res.data.status === "EXPIRED") {
            setIsExpired(true);
            setErrorMessage("Your verification code has expired. Please request a new code below.");
          }
          if (res.data.resendAvailableAt) {
            const secondsLeft = Math.ceil(
              (new Date(res.data.resendAvailableAt).getTime() - Date.now()) / 1000
            );
            if (secondsLeft > 0) setCooldown(secondsLeft);
          }
        }
      } else if (initialEmail) {
        const res = await getRegistrationVerificationStateAction(initialEmail);
        if (active && res.success) {
          setChallengeId(res.data.challengeId);
          if (res.data.status === "EXPIRED") {
            setIsExpired(true);
            setErrorMessage("Your verification code has expired. Please request a new code below.");
          }
          if (res.data.resendAvailableAt) {
            const secondsLeft = Math.ceil(
              (new Date(res.data.resendAvailableAt).getTime() - Date.now()) / 1000
            );
            if (secondsLeft > 0) setCooldown(secondsLeft);
          }
        }
      }
    }

    loadState();
    return () => {
      active = false;
    };
  }, [initialChallengeId, initialEmail]);

  const handleDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMessage("");

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    setErrorMessage("");

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const code = digits.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      let activeChallengeId = challengeId;
      if (!activeChallengeId) {
        if (!email) {
          setErrorMessage("Please provide your registration email address.");
          setLoading(false);
          return;
        }
        const stateRes = await getRegistrationVerificationStateAction(email);
        if (!stateRes.success) {
          setErrorMessage(stateRes.error || "No pending registration found.");
          setLoading(false);
          return;
        }
        activeChallengeId = stateRes.data.challengeId;
        setChallengeId(activeChallengeId);
      }

      const res = await verifyRegistrationOtpAction({
        challengeId: activeChallengeId,
        code,
      });

      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/login?verified=1");
        }, 1500);
      } else {
        if (res.code === "OTP_EXPIRED") {
          setIsExpired(true);
          setErrorMessage("Your verification code has expired. Please request a new code below.");
        } else if (res.code === "OTP_ATTEMPTS_EXCEEDED") {
          setIsExpired(true);
          setErrorMessage("Too many incorrect attempts. Please request a new code.");
        } else if (res.code === "OTP_INVALID") {
          setErrorMessage("Invalid verification code. Please check your email and try again.");
        } else {
          setErrorMessage(res.error || "Verification failed. Please try again.");
        }
      }
    } catch {
      setErrorMessage("An unexpected error occurred during verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!email) {
      setErrorMessage("Please enter your email to resend the code.");
      return;
    }

    setResending(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const res = await resendRegistrationOtpAction(email);
      if (res.success) {
        setChallengeId(res.data.challengeId);
        setIsExpired(false);
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setInfoMessage("A new 6-digit code has been sent to your email.");

        if (res.data.resendAvailableAt) {
          const secondsLeft = Math.ceil(
            (new Date(res.data.resendAvailableAt).getTime() - Date.now()) / 1000
          );
          setCooldown(Math.max(secondsLeft, 60));
        } else {
          setCooldown(60);
        }
      } else {
        if (res.code === "RESEND_COOLDOWN") {
          setErrorMessage("Please wait before requesting another code.");
        } else {
          setErrorMessage(res.error || "Unable to resend code. Please try again.");
        }
      }
    } catch {
      setErrorMessage("Unable to resend code. Please check your connection.");
    } finally {
      setResending(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-emerald-950">
            Email Verified Successfully
          </h2>
          <p className="text-xs text-emerald-700">
            Your account is verified and ready. Redirecting to sign in…
          </p>
        </div>
        <Link
          href="/login?verified=1"
          className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <span>Sign In to Slotify</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Subtitle & Target Email */}
      <div className="space-y-1">
        <p className="text-xs sm:text-sm text-slate-500">
          Enter the six-digit code sent to{" "}
          <span className="font-semibold text-slate-800">
            {maskEmail(email)}
          </span>
          .
        </p>
      </div>

      {/* Notice / Errors */}
      {isExpired && !errorMessage && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-800 flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>Your verification code has expired. Please request a new code below.</span>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-700 flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div
          role="status"
          className="rounded-xl bg-blue-50 border border-blue-200/80 p-3 text-xs text-blue-700 flex items-start gap-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Email input fallback if not provided in URL */}
      {!email && (
        <div>
          <label
            htmlFor="verify-email-input"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Registered Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <input
              id="verify-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      )}

      {/* Six-digit PIN input */}
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-2">
            Verification Code
          </label>
          <div className="flex items-center justify-between gap-2 sm:gap-2.5">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                disabled={loading}
                className={`w-11 sm:w-12 h-12 text-center text-lg sm:text-xl font-bold rounded-xl border ${
                  digit
                    ? "border-blue-600 bg-blue-50/30 text-blue-900 shadow-2xs"
                    : "border-slate-200 bg-slate-50/50 text-slate-900"
                } outline-none transition-all duration-150 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-50`}
              />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            Paste your 6-digit code or type directly.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || digits.join("").length !== 6}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying code…</span>
            </>
          ) : (
            <>
              <span>Verify Email</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Resend Control & Countdown */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Didn&apos;t receive the code?</span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending || !email}
          className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {resending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Sending…</span>
            </>
          ) : cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Resend code</span>
            </>
          )}
        </button>
      </div>

      <div className="text-center pt-1">
        <Link
          href="/login"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
