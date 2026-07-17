import { jwtVerify, SignJWT } from 'jose';

const encoder = new TextEncoder();

export type AuthEnv = {
  JWT_SECRET?: string;
  AUTH_PASSWORD?: string;
};

export class AuthUnavailableError extends Error {}
export class UnauthorizedError extends Error {}

function secretBytes(env: AuthEnv): Uint8Array {
  if (!env.JWT_SECRET) throw new AuthUnavailableError('JWT_SECRET is not configured');
  return encoder.encode(env.JWT_SECRET);
}

export async function issueToken(env: AuthEnv, password: string, subject = 'owner'): Promise<string> {
  if (!env.AUTH_PASSWORD || !env.JWT_SECRET) {
    throw new AuthUnavailableError('Authentication is not configured');
  }
  if (password !== env.AUTH_PASSWORD) throw new UnauthorizedError('Invalid credentials');
  return new SignJWT({ scope: 'events:write' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secretBytes(env));
}

export async function verifyBearer(env: AuthEnv, authorization?: string): Promise<string> {
  const secret = secretBytes(env);
  if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedError('Missing bearer token');
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Missing bearer token');
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (!payload.sub) throw new UnauthorizedError('Token subject is missing');
    return payload.sub;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid bearer token');
  }
}
