import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function asyncHandler<TRequest extends Request = Request>(
  handler: (req: TRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req as TRequest, res, next).catch(next);
  };
}
