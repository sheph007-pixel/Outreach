export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401)
    this.name = 'AuthError'
  }
}

export function handleApiError(error: unknown): { message: string; status: number } {
  if (error instanceof AppError) {
    return { message: error.message, status: error.statusCode }
  }
  console.error('Unhandled error:', error)
  return { message: 'Internal server error', status: 500 }
}
