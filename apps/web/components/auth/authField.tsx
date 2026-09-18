"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { INPUT } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
interface AuthFieldProps {
  label: string; type: string; value: string; autoComplete: string;
  testid: string; placeholder: string; error?: string; disabled: boolean;
  onChange: (value: string) => void;
}
export function AuthField({ label, type, value, autoComplete, testid, placeholder, error, disabled, onChange }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor={testid} className="text-sm font-medium">{label}</label>
      <div className="relative">
        <input id={testid} data-testid={testid} type={type === "password" && visible ? "text" : type} value={value} autoComplete={autoComplete} placeholder={placeholder} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${testid}-error` : undefined} className={cn(INPUT, type === "password" && "pr-12", error && "border-warning")} onChange={(event) => onChange(event.target.value)} />
        {type === "password" && <button type="button" className="absolute inset-y-0 right-0 cursor-pointer px-4 text-muted hover:text-foreground" aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={visible} data-testid="auth-password-toggle" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </div>
      {error && <p id={`${testid}-error`} className="text-xs text-warning" role="alert">{error}</p>}
    </div>
  );
}
