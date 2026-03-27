export type AuthRole = 'trainee' | 'admin' | 'developer';

const AUTH_ROLE_KEY = 'mechalabx:auth-role';
const AUTH_TOKEN_KEY = 'mechalabx:auth-token';
const AUTH_ACCOUNT_ID_KEY = 'mechalabx:auth-account-id';
const AUTH_TRAINEE_ID_KEY = 'mechalabx:auth-trainee-id';

type AuthSession = {
  role: AuthRole;
  token: string;
  account_id: number;
  trainee_id: number | null;
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
  // Add 'developer' to the allowed return values
  return role === 'trainee' || role === 'admin' || role === 'developer' ? role as AuthRole : null;
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

export const clearAuthSession = (): void => {
  sessionStorage.removeItem(AUTH_ROLE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_ACCOUNT_ID_KEY);
  sessionStorage.removeItem(AUTH_TRAINEE_ID_KEY);
};

export const clearAuthRole = (): void => {
  clearAuthSession();
};

// NEW HELPER FUNCTION for the GodModeListener
export const setGodModeSession = (): void => {
  // 1. Check if we already have a valid session (e.g., logged in as Admin)
  const existingToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
  const existingAccountId = parseStoredPositiveInt(sessionStorage.getItem(AUTH_ACCOUNT_ID_KEY));
  const existingTraineeId = parseStoredPositiveInt(sessionStorage.getItem(AUTH_TRAINEE_ID_KEY));

  // 2. Preserve valid data, otherwise inject the Offline Overrides
  setAuthSession({
    role: 'developer',
    token: existingToken && existingToken.trim() ? existingToken : 'GOD_MODE_OVERRIDE_TOKEN',
    account_id: existingAccountId || 999999,
    trainee_id: existingTraineeId || null
  });
};
