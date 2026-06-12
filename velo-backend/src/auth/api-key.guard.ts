import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ApiKeyOrJwtGuard extends AuthGuard(['jwt', 'api-key']) {}
