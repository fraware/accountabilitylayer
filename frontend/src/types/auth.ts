export interface JwtPayload {
  username: string;
  role: string;
  exp?: number;
  iat?: number;
}
