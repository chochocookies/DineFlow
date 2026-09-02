"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Styled for the dark kds-* theme LoginForm/RegisterForm already share
// (see components/auth/login-form.tsx) — both of this component's current
// call sites are that theme. If a future light-theme caller needs this,
// the icon colors below are the one thing to make a prop rather than
// hardcode further.
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-1.5">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-white/10 bg-kds-bg px-3.5 py-2.5 pr-11 text-kds-text placeholder:text-kds-muted focus:border-kds-preparing"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Lihat password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-kds-muted hover:text-kds-text"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
