import { isValidCPF, normalizeCPF } from './cpf';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?55?\d{10,11}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CNPJ_RE = /^\d{14}$/;

export function detectPixKeyType(raw: string): PixKeyType | null {
  const v = raw.trim();
  if (EMAIL_RE.test(v)) return 'email';
  if (UUID_RE.test(v)) return 'random';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11 && isValidCPF(digits)) return 'cpf';
  if (CNPJ_RE.test(digits)) return 'cnpj';
  if (PHONE_RE.test(v.startsWith('+') ? v : `+${digits}`)) return 'phone';
  return null;
}

export function normalizePixKey(raw: string): string {
  const v = raw.trim();
  const type = detectPixKeyType(v);
  if (type === 'cpf' || type === 'cnpj') return normalizeCPF(v);
  if (type === 'phone') {
    const digits = v.replace(/\D/g, '');
    return `+${digits.startsWith('55') ? digits : `55${digits}`}`;
  }
  if (type === 'email') return v.toLowerCase();
  return v;
}

export function isValidPixKey(raw: string): boolean {
  return detectPixKeyType(raw) !== null;
}
