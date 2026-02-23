export type AuthRole = 'student' | 'admin';

const AUTH_ROLE_KEY = 'mechalabx:auth-role';
const AUTH_TOKEN_KEY = 'mechalabx:auth-token';

export const setAuthSession = (role: AuthRole, token: string): void => {
  sessionStorage.setItem(AUTH_ROLE_KEY, role);
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const setAuthRole = (role: AuthRole): void => {
  sessionStorage.setItem(AUTH_ROLE_KEY, role);
};

export const getAuthRole = (): AuthRole | null => {
  const role = sessionStorage.getItem(AUTH_ROLE_KEY);
  return role === 'student' || role === 'admin' ? role : null;
};

export const getAuthToken = (): string | null => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  return token && token.trim() ? token : null;
};

export const clearAuthSession = (): void => {
  sessionStorage.removeItem(AUTH_ROLE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export const clearAuthRole = (): void => {
  clearAuthSession();
};
