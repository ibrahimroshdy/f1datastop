import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Live password-requirement checklist. Mirrors the Supabase GoTrue password rules
 * (lower/upper/digit/symbol + min length) so users see green checks as they type
 * instead of the raw server error string after submit.
 */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'A lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { label: 'An uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'A number (0–9)', test: (p) => /[0-9]/.test(p) },
  { label: 'A symbol (!@#$%^&*…)', test: (p) => /[!@#$%^&*()_+\-=[\]{};:'"|<>?,./`~]/.test(p) },
];

export const isPasswordValid = (p: string): boolean => PASSWORD_RULES.every((r) => r.test(p));

export function PasswordChecklist({ password, className }: { password: string; className?: string }) {
  return (
    <ul className={cn('space-y-1.5', className)} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              ok ? 'text-gain' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
                ok ? 'border-gain bg-gain/15' : 'border-border',
              )}
            >
              {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-2.5 w-2.5 opacity-40" strokeWidth={3} />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
