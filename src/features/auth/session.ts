/** Ephemeral session transport state. No storage, URL or JWT-claim decoding. */
export class SessionMemory {
  private token: string | null = null;
  private epoch = 0;
  private expired: () => void = () => {};
  getToken = () => this.token;
  onExpired(callback: () => void) {
    this.expired = callback;
  }
  expire = () => this.expired();
  begin() {
    this.epoch += 1;
    return this.epoch;
  }
  isCurrent(attempt: number) {
    return attempt === this.epoch;
  }
  setToken(value: string) {
    this.token = value;
  }
  invalidate() {
    this.epoch += 1;
    this.token = null;
  }
}
