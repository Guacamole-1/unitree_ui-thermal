export interface GimbalCommand { pan: number; tilt: number }
 
export class GimbalClient {
	private ws: WebSocket | null = null

	constructor() {
		this.connect()
	}

	private connect(): void {
		const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
		this.ws = new WebSocket(`${proto}//${window.location.host}/gimbal/ws`)

		this.ws.onopen = () => console.log("gimbal connected")

		this.ws.onclose = () => {
			console.log("gimbal disconnected, retrying in 2s...")
			setTimeout(() => this.connect(), 2000)  // auto-reconnect
		}
		this.ws.onerror = () => {
			console.log("gimbal error occurred!")
		}
	}

	move(cmd: GimbalCommand): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(cmd))
		}
	}

	disconnect(): void {
		this.ws?.close()
	}
}

// usage
//gimbal.move({ pan: 90, tilt: 45 })
