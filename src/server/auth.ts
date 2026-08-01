import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function basicAuthMiddleware(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex !== -1) {
        const user = decoded.slice(0, separatorIndex);
        const pass = decoded.slice(separatorIndex + 1);
        if (safeEqual(user, username) && safeEqual(pass, password)) {
          next();
          return;
        }
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Transcritor"');
    res.status(401).send('Autenticação necessária');
  };
}
