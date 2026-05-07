export class DaysError extends Error {
  readonly code: string
  readonly url?: string

  constructor(code: string, message: string, url?: string) {
    super(message)
    this.name = 'DaysError'
    this.code = code
    this.url = url
    // Ensure proper prototype chain for instanceof checks in transpiled code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
