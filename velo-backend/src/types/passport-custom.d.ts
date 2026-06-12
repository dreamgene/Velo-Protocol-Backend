declare module 'passport-custom' {
  import { Request } from 'express';
  export class Strategy {
    constructor(verify: (req: Request, done: (err: any, user?: any) => void) => void);
    name: string;
    authenticate(req: Request, options?: any): void;
  }
}
