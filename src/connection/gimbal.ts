export interface GimbalCommand { pan: number; tilt: number }

export class GimbalClient {
  private ws: WebSocket | null = null
  private closing = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.connect()
  }

  private connect(): void {
    if (this.closing) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.ws = new WebSocket(`${proto}//${location.host}/gimbal/ws`)

    this.ws.onopen = () => console.log("gimbal connected")

    this.ws.onclose = () => {
      if (this.closing) return
      console.log("gimbal disconnected, retrying in 2s...")
      this.retryTimer = setTimeout(() => this.connect(), 2000)
    }
    this.ws.onerror = () => console.log("gimbal error occurred!")
  }

  move(cmd: GimbalCommand): void {
	if (this.ws?.readyState === WebSocket.OPEN) {
	  this.ws.send(JSON.stringify(cmd))
	}
  }
  disconnect(): void {
    this.closing = true
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    this.ws?.close()
    this.ws = null
  }
}

// usage
//gimbal.move({ pan: 90, tilt: 45 })
