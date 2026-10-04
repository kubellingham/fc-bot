export declare const root: string;
export declare const localDir: string;
export declare const stackEnvFile: string;
export declare const API_PORT: string;
export declare const DB_PORT: string;
export declare function signJwt(payload: Record<string, unknown>, secret: string): string;
export declare function loadOrCreateSecrets(): { POSTGRES_PASSWORD: string; JWT_SECRET: string };
export declare function keys(secrets: { JWT_SECRET: string }): { anonKey: string; serviceKey: string };
export declare function stackConfig(): { url: string; anonKey: string; serviceKey: string; dbUrl: string };
