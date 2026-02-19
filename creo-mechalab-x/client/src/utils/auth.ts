export type AuthRole = 'student' | 'admin';

const AUTH_ROLE_KEY = 'mechalabx:auth-role';

export const setAuthRole = (role: AuthRole): void => {
  sessionStorage.setItem(AUTH_ROLE_KEY, role);
};

export const getAuthRole = (): AuthRole | null => {
  const role = sessionStorage.getItem(AUTH_ROLE_KEY);
  return role === 'student' || role === 'admin' ? role : null;
};

export const clearAuthRole = (): void => {
  sessionStorage.removeItem(AUTH_ROLE_KEY);
};
