import type { ConnectionCallbacks, ConnectionState, DataChannelMessage, TurnServerInfo } from '../types';

export type ThermalPalette =
	| 'afmhot'	| 'arctic'	| 'black_hot'
	| 'cividis'	| 'ironbow'	| 'inferno'
	| 'magma'	| 'outdoor_alert'	| 'plasma'
	| 'rainbow'	| 'rainbow_hc'	| 'viridis'
	| 'white_hot';

export type ThermalData = {center_c: number, min_c: number, max_c: number,
                     min_pos: number, max_pos: number};

export class ThermalWebRTCConnection {
    channel: RTCDataChannel | null = null;
	private pcId: string | null = null;
    private pc: RTCPeerConnection | null = null;
    private statsEl: HTMLElement;
    private currentPalette: ThermalPalette;
    private callbacks: ConnectionCallbacks;
    private state: ConnectionState = 'disconnected';
	public onThermalData: ((data: ThermalData) => void) | null = null;

    constructor(callbacks: ConnectionCallbacks) {
        this.callbacks = callbacks;
        this.statsEl = document.getElementById("stats") as HTMLElement;
        this.currentPalette = 'white_hot';
	    console.log("thermal camera created")
        this.setupPeerConnection();
		try{
			void this.start();
		}catch(error: any){
			console.log(error.message)
		}

    }

    private setupPeerConnection(): void {
        this.pc = new RTCPeerConnection({
            bundlePolicy: 'max-bundle',
			iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        this.pc.addTransceiver("video", { direction: "recvonly" });
        this.channel = this.pc.createDataChannel("temps");
        this.setupChannelHandlers(this.channel);

        // Handle data channels created by the server
        this.pc.ondatachannel = (event) => {
            console.log('[thermal:rtc] Remote data channel:', event.channel.label);
            this.setupChannelHandlers(event.channel);
            if (!this.channel || this.channel.readyState !== 'open') {
                this.channel = event.channel;
            }
        };

        this.pc.ontrack = (event: RTCTrackEvent) => {
            console.log(`[thermal:rtc] Track received: ${event.track.kind}`);
            if (event.track.kind === 'video') {
                this.callbacks.onVideoTrack(event.streams[0] ?? new MediaStream([event.track]));
            }
        };

		// Trickle ICE — send each candidate to the server as it arrives
		this.pc.onicecandidate = (event) => {
			if (event.candidate && this.pcId) {
			console.log('[thermal:rtc] Sending ICE candidate');
			fetch('/thermal/ice', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
				pc_id: this.pcId,
				candidate: event.candidate.toJSON(),
				}),
			}).catch(e => console.error('[thermal:rtc] Failed to send candidate:', e));
			}
		};

        this.pc.oniceconnectionstatechange = () => {
            console.log('[thermal:rtc] ICE connection state:', this.pc.iceConnectionState);
        };

        this.pc.onconnectionstatechange = () => {
            const pcState = this.pc.connectionState;
            console.log('[thermal:rtc] Connection state:', pcState);
            if (pcState === 'failed' || pcState === 'closed') {
                this.setState('failed');
            } else if (pcState === 'connecting') {
                this.setState('connecting');
            }
			// Don't setState('connected') here — wait for data channel onopen
			// Firefox opens the data channel later than Chrome, causing validation
			// to fire before the channel is ready to send.

        };

        this.pc.onsignalingstatechange = () => {
            console.log('[thermal:rtc] Signaling state:', this.pc.signalingState);
        };
	}

    private async start(): Promise<void> {
        this.setState('connecting');
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        console.log('[thermal:rtc] Local description set, gathering ICE candidates...');


        const res = await fetch("/thermal/offer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sdp: this.pc.localDescription!.sdp,
                type: this.pc.localDescription!.type,
            }),
        });

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Thermal offer failed: ${res.status} ${res.statusText} - ${text}`);
		}

        const answer = await res.json();
		this.pcId = answer.pc_id; // store so onicecandidate can reference it
        console.log('[thermal:rtc] Setting remote description (answer)...');
        await this.pc.setRemoteDescription({
            type: 'answer',
            sdp: answer.sdp,
        });
        console.log('[thermal:rtc] Remote description set successfully');
    }

    private setupChannelHandlers(channel: RTCDataChannel): void {
        channel.onopen = () => {
            console.log('[thermal:rtc] Data channel OPEN:', channel.label);
            this.setState('connected');
			this.callbacks.onValidated();
        };

        channel.onclose = () => {
            console.log('[thermal:rtc] Data channel CLOSED:', channel.label);
            this.setState('disconnected');
        };

        channel.onerror = (event) => {
            console.error('[thermal:rtc] Data channel error:', event);
        };

        channel.onmessage = (event) => {
            const d: ThermalData = JSON.parse(event.data as string);
			console.log("abc")
		    this.onThermalData?.(d);
        };
    }

    private setState(state: ConnectionState): void {
        if (this.state !== state) {
            console.log(`[thermal:rtc] State: ${this.state} → ${state}`);
            this.state = state;
            this.callbacks.onStateChange(state);
        }
    }

    setPalette(palette: ThermalPalette): void {
        this.currentPalette = palette;
        this.send({ palette });
    }

    send(data: object): void {
        const str = JSON.stringify(data);
        if (this.channel?.readyState === 'open') {
            this.channel.send(str);
        } else {
            console.warn('[thermal:rtc] Channel not open, message dropped');
        }
    }

    getState(): ConnectionState {
        return this.state;
    }

    close(): void {
        console.log('[thermal:rtc] Closing connection');
        this.channel?.close();
        this.pc.close();
        this.setState('disconnected');
    }
}
