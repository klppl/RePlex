// TextEncoder is a global in both the Node.js and Edge runtimes. Importing it
// from 'util' breaks the Edge runtime (used by middleware), where 'util' is
// unavailable — so we rely on the global instead.
const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error("FATAL: JWT_SECRET is not defined. Check your environment variables.");
}
const SECRET_KEY = secret || 'super-secret-key-change-this';
export const jwtKey = new TextEncoder().encode(SECRET_KEY);
