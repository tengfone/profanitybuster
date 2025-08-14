export interface ExpressRequest {
  [key: string]: unknown;
}

export interface ExpressResponse {
  [key: string]: unknown;
}

export type ExpressNextFunction = (err?: unknown) => void;
