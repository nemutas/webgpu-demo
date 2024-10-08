export class Clock {
  private start: number
  private prev: number

  elapsedTime = 0
  deltaTime = 0

  constructor() {
    this.start = performance.now()
    this.prev = performance.now()
  }

  update() {
    const current = performance.now()
    this.elapsedTime = current - this.start
    this.deltaTime = current - this.prev
    this.prev = current
    return { et: this.elapsedTime, dt: this.deltaTime }
  }
}
