import { TextEncoder } from 'util';

const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error("FATAL: JWT_SECRET is not defined. Check your environment variables.");
}
const SECRET_KEY = secret || 'super-secret-key-change-this';
export const jwtKey = new TextEncoder().encode(SECRET_KEY);
