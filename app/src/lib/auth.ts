const tokenKey = 'stowaway_access_token';

export function getToken(): string | null {
  return sessionStorage.getItem(tokenKey);
}

export function setToken(token: string): void {
  sessionStorage.setItem(tokenKey, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(tokenKey);
}
