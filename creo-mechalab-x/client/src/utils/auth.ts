export type AuthRole = 'trainee' | 'admin';

const AUTH_ROLE_KEY = 'mechalabx:auth-role';
const AUTH_TOKEN_KEY = 'mechalabx:auth-token';
const AUTH_ACCOUNT_ID_KEY = 'mechalabx:auth-account-id';
const AUTH_TRAINEE_ID_KEY = 'mechalabx:auth-trainee-id';
const AUTH_GOD_MODE_KEY = 'mechalabx:god-mode';

type AuthSession = {
  role: AuthRole;
  token: string;
  account_id: number;
  trainee_id: number | null;
  god_mode?: boolean;
};

const parseStoredPositiveInt = (value: string | null): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const setAuthSession = (session: AuthSession): void => {
  sessionStorage.setItem(AUTH_ROLE_KEY, session.role);
  sessionStorage.setItem(AUTH_TOKEN_KEY, session.token);
  sessionStorage.setItem(AUTH_ACCOUNT_ID_KEY, String(session.account_id));
  if (session.god_mode === true) {
    sessionStorage.setItem(AUTH_GOD_MODE_KEY, 'true');
  } else {
    sessionStorage.removeItem(AUTH_GOD_MODE_KEY);
  }

  if (session.trainee_id === null) {
    sessionStorage.removeItem(AUTH_TRAINEE_ID_KEY);
    return;
  }

  sessionStorage.setItem(AUTH_TRAINEE_ID_KEY, String(session.trainee_id));
};

export const setAuthRole = (role: AuthRole): void => {
  sessionStorage.setItem(AUTH_ROLE_KEY, role);
};

export const getAuthRole = (): AuthRole | null => {
  const role = sessionStorage.getItem(AUTH_ROLE_KEY);
  return role === 'trainee' || role === 'admin' ? role as AuthRole : null;
};

export const getAuthToken = (): string | null => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  return token && token.trim() ? token : null;
};

export const getAuthAccountId = (): number | null => {
  return parseStoredPositiveInt(sessionStorage.getItem(AUTH_ACCOUNT_ID_KEY));
};

export const getAuthTraineeId = (): number | null => {
  return parseStoredPositiveInt(sessionStorage.getItem(AUTH_TRAINEE_ID_KEY));
};

export const isGodModeSession = (): boolean => {
  return sessionStorage.getItem(AUTH_GOD_MODE_KEY) === 'true';
};

export const clearAuthSession = (): void => {
  sessionStorage.removeItem(AUTH_ROLE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_ACCOUNT_ID_KEY);
  sessionStorage.removeItem(AUTH_TRAINEE_ID_KEY);
  sessionStorage.removeItem(AUTH_GOD_MODE_KEY);
};

export const clearAuthRole = (): void => {
  clearAuthSession();
};

export const setGodModeSession = (session: Omit<AuthSession, 'god_mode'>): void => {
  setAuthSession({
    ...session,
    god_mode: true,
  });
};
