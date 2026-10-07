import type { Role } from '@appsport/contracts';

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  birthDate: string;
  mustChangePassword: boolean;
}

export type AppEnv = {
  Variables: {
    requestId: string;
    clientIp: string | null;
    user: SessionUser | null;
    sessionId: string | null;
  };
};
