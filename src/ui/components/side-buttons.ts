// LiDAR icon SVGs (simple 3D scan/point cloud icon)
const LIDAR_SVG_ON = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#6879e4" stroke-width="2" stroke-linecap="round">
<circle cx="12" cy="12" r="2"/>
<path d="M12 2a10 10 0 0 1 0 20"/>
<path d="M12 2a10 10 0 0 0 0 20"/>
<path d="M12 6a6 6 0 0 1 0 12"/>
<path d="M12 6a6 6 0 0 0 0 12"/>
</svg>`;

const LIDAR_SVG_OFF = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
<circle cx="12" cy="12" r="2"/>
<path d="M12 2a10 10 0 0 1 0 20"/>
<path d="M12 2a10 10 0 0 0 0 20"/>
<path d="M12 6a6 6 0 0 1 0 12"/>
<path d="M12 6a6 6 0 0 0 0 12"/>
</svg>`;

// Relay Remote icon — classic gamepad silhouette with two sticks and a D-pad
const RELAY_SVG = (color: string) => `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
<!-- Body shape (two rounded grips joined by central bridge) -->
<path d="M7 8 C3 8, 2 13, 3 17 C3.5 19, 5 20, 7 19.5 L10 17 L16 17 L19 19.5 C21 20, 22.5 19, 23 17 C24 13, 23 8, 19 8 Z"/>
<!-- Left stick -->
<circle cx="8" cy="13" r="1.8" fill="${color}" stroke="none"/>
<!-- Right stick -->
<circle cx="18" cy="13" r="1.8" fill="${color}" stroke="none"/>
</svg>`;

const SPEED_SVG = (color: string) => `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
<path d="M12 12L16 8"/>
<path d="M12 4v1.5"/><path d="M12 18.5V20"/>
<path d="M4 12h1.5"/><path d="M18.5 12H20"/>
</svg>`;

const GIMBAL_SVG = (color: string) => `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="2"/>
<circle cx="12" cy="12" r="6"/>
<line x1="12" y1="2" x2="12" y2="6"/>
<line x1="12" y1="18" x2="12" y2="22"/>
<line x1="2" y1="12" x2="6" y2="12"/>
<line x1="18" y1="12" x2="22" y2="12"/>
</svg>`;

export interface SettingCallbacks {
	onRadarToggle: (enabled: boolean) => void;
	onLampSet: (level: number) => void;
	onVolumeSet: (level: number) => void;
	onLidarToggle: (enabled: boolean) => void;
	onRelayToggle: (enabled: boolean) => void;
	onMovementSpeedSet: (level: number) => void; // 0 to 1.0
	onTurnSpeedSet: (level: number) => void;      // 0 to 1.0
	onGimbalMove: (pan: number, tilt: number) => void; // 0 to 180º
}

export class SettingBar {
	private container: HTMLElement;
	private radarOn = false;
	private lidarOn = true;
	private radarBtn!: HTMLButtonElement;
	private volumeBtn!: HTMLButtonElement;
	private lampBtn!: HTMLButtonElement;
	private relayBtn!: HTMLButtonElement;
	private relayOn = false;
	private relayAvailable = false;
	private remoteName = '';
	private volumeLevel = 0;
	private lampLevel = 0;
	private callbacks: SettingCallbacks;
	private speedBtn!: HTMLButtonElement;
	private movementSpeed = 1;
	private turnSpeed = 0.50;
	//gimbal
	private gimbalBtn!: HTMLButtonElement;
	private gimbalActive = false;
	private gimbalMouseMove: ((e: MouseEvent) => void) | null = null;
	private gimbalMouseClick: ((e: MouseEvent) => void) | null = null;
	private gimbalTimer: ReturnType<typeof setInterval> | null = null;
	private gimbalPos = { x: 0, y: 0 };

	constructor(parent: HTMLElement, callbacks: SettingCallbacks) {
		this.callbacks = callbacks;
		this.container = document.createElement('div');
		this.container.className = 'setting-bar';

		// Radar button
		this.radarBtn = this.createBtn('/sprites/icon_radar.png', 'Radar');
		this.radarBtn.addEventListener('click', () => {
			this.radarOn = !this.radarOn;
			const img = this.radarBtn.querySelector('img')!;
			img.src = this.radarOn ? '/sprites/icon_radar_on.png' : '/sprites/icon_radar.png';
			callbacks.onRadarToggle(this.radarOn);
		});

		// LiDAR button
		const lidarBtn = this.createSvgBtn(LIDAR_SVG_ON, 'LiDAR');
		lidarBtn.addEventListener('click', () => {
			this.lidarOn = !this.lidarOn;
			lidarBtn.innerHTML = this.lidarOn ? LIDAR_SVG_ON : LIDAR_SVG_OFF;
			callbacks.onLidarToggle(this.lidarOn);
		});

		// Volume button
		this.volumeBtn = this.createBtn('/sprites/icon_volume.png', 'Volume');
		this.volumeBtn.addEventListener('click', () => {
			this.toggleSlider(this.volumeBtn, 'Vol', this.volumeLevel, (val) => {
				this.volumeLevel = val;
				const img = this.volumeBtn.querySelector('img')!;
				img.src = val > 0 ? '/sprites/icon_volume_on.png' : '/sprites/icon_volume.png';
				callbacks.onVolumeSet(val);
			});
		});

		// Lamp button
		this.lampBtn = this.createBtn('/sprites/icon_lamp.png', 'Light');
		this.lampBtn.addEventListener('click', () => {
			this.toggleSlider(this.lampBtn, 'Light', this.lampLevel, (val) => {
				this.lampLevel = val;
				const img = this.lampBtn.querySelector('img')!;
				img.src = val > 0 ? '/sprites/icon_lamp_on.png' : '/sprites/icon_lamp.png';
				callbacks.onLampSet(val);
			});
		});

		// Relay Remote button (disabled until remote is connected)
		this.relayBtn = this.createSvgBtn(RELAY_SVG('#444'), 'Relay Remote');
		this.relayBtn.disabled = true;
		this.relayBtn.title = 'Connect a BLE remote to enable relay';
		this.relayBtn.style.cursor = 'not-allowed';
		this.relayBtn.style.opacity = '0.5';
		this.relayBtn.addEventListener('click', () => {
			if (!this.relayAvailable) return;
			this.relayOn = !this.relayOn;
			this.updateRelayVisual();
			callbacks.onRelayToggle(this.relayOn);
		});

		//add movement speed for keyboard
		this.speedBtn = this.createSvgBtn(SPEED_SVG('#ccc'), 'Speed');
		this.speedBtn.addEventListener('click', () => {
			const existing = this.speedBtn.querySelector('.slider-popup');
			if (existing) { existing.remove(); return; }

			const popup = document.createElement('div');
			popup.className = 'slider-popup';
			popup.style.flexDirection = 'column';
			popup.style.gap = '8px';

			const makeRow = (label: string, value: number, onChange: (v: number) => void) => {
				const row = document.createElement('div')

				const range = document.createElement('input');
				range.type = 'range';
				range.min = '0'; range.max = '1'; range.step = '0.01';
				range.value = String(value);
				const valueLabel = document.createElement('span');
				valueLabel.className = 'slider-value';
				valueLabel.textContent = `${label}: ${value.toFixed(2)}`;
				range.addEventListener('input', () => {
					const v = parseFloat(range.value);
					valueLabel.textContent = `${label}: ${v.toFixed(2)}`;
					onChange(v);
				});
				row.appendChild(range);
				row.appendChild(valueLabel);
				popup.appendChild(row)
			};

			makeRow('Move', this.movementSpeed, (v) => { this.movementSpeed = v; callbacks.onMovementSpeedSet(v); });
			makeRow('Turn', this.turnSpeed, (v) => { this.turnSpeed = v; callbacks.onTurnSpeedSet(v); });

			this.speedBtn.style.position = 'relative';
			this.speedBtn.appendChild(popup);

			const close = (e: MouseEvent) => {
				if (!popup.contains(e.target as Node) && !this.speedBtn.contains(e.target as Node)) {
					popup.remove();
					document.removeEventListener('click', close);
				}
			};
			setTimeout(() => document.addEventListener('click', close), 0);
		});

		// add gimbal button
		this.gimbalBtn = this.createSvgBtn(GIMBAL_SVG('#ccc'), 'Gimbal Control');
		this.gimbalBtn.addEventListener('click', () => this.toggleGimbal(callbacks));

		this.container.appendChild(this.gimbalBtn);
		this.container.appendChild(this.radarBtn);
		this.container.appendChild(lidarBtn);
		this.container.appendChild(this.volumeBtn);
		this.container.appendChild(this.lampBtn);
		this.container.appendChild(this.speedBtn);
		this.container.appendChild(this.relayBtn);

		parent.appendChild(this.container);
	}

	/** Called when BLE remote connection status changes. */
	setRelayAvailable(available: boolean, remoteName: string = ''): void {
		this.relayAvailable = available;
		this.remoteName = remoteName;
		if (!available && this.relayOn) {
			// Auto-disable relay if remote got disconnected
			this.relayOn = false;
			this.callbacks.onRelayToggle(false);
		}
		this.relayBtn.disabled = !available;
		this.relayBtn.style.cursor = available ? 'pointer' : 'not-allowed';
		this.relayBtn.style.opacity = available ? '1' : '0.5';
		this.updateRelayVisual();
	}

	private updateRelayVisual(): void {
		const color = !this.relayAvailable ? '#444' : (this.relayOn ? '#42CF55' : '#ccc');
		this.relayBtn.innerHTML = RELAY_SVG(color);

		let tooltip: string;
		if (!this.relayAvailable) {
			tooltip = 'Connect a BLE remote to enable relay';
		} else {
			const nameSuffix = this.remoteName ? ` (${this.remoteName})` : '';
			tooltip = this.relayOn
				? `Relay ON — controlling robot via${nameSuffix}`
				: `Relay OFF — click to relay${nameSuffix}`;
		}
		this.relayBtn.title = tooltip;
	}

	setRadar(enabled: boolean): void {
		this.radarOn = enabled;
		const img = this.radarBtn.querySelector('img')!;
		img.src = enabled ? '/sprites/icon_radar_on.png' : '/sprites/icon_radar.png';
	}

	setVolume(level: number): void {
		this.volumeLevel = level;
		const img = this.volumeBtn.querySelector('img')!;
		img.src = level > 0 ? '/sprites/icon_volume_on.png' : '/sprites/icon_volume.png';
	}

	setBrightness(level: number): void {
		this.lampLevel = level;
		const img = this.lampBtn.querySelector('img')!;
		img.src = level > 0 ? '/sprites/icon_lamp_on.png' : '/sprites/icon_lamp.png';
	}

	private createBtn(iconSrc: string, alt: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.className = 'setting-btn';
		const img = document.createElement('img');
		img.src = iconSrc;
		img.alt = alt;
		img.draggable = false;
		btn.appendChild(img);
		return btn;
	}

	private createSvgBtn(svgHtml: string, _alt: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.className = 'setting-btn';
		btn.innerHTML = svgHtml;
		return btn;
	}

	private toggleSlider(
		anchor: HTMLElement,
		label: string,
		initialValue: number,
		onChange: (val: number) => void,
		opts: { min?: number; max?: number; step?: number; decimals?: number } = {},
	): void {
		const { min = 0, max = 10, step = 1, decimals = 0 } = opts;
		const existing = anchor.querySelector('.slider-popup');
		if (existing) { existing.remove(); return; }

		const popup = document.createElement('div');
		popup.className = 'slider-popup';

		const range = document.createElement('input');
		range.type = 'range';
		range.min = String(min);
		range.max = String(max);
		range.step = String(step);
		range.value = String(initialValue);

		const valueLabel = document.createElement('span');
		valueLabel.className = 'slider-value';
		valueLabel.textContent = `${label}: ${initialValue.toFixed(decimals)}`;

		range.addEventListener('input', () => {
			const val = parseFloat(range.value);
			valueLabel.textContent = `${label}: ${val.toFixed(decimals)}`;
			onChange(val);
		});

		popup.appendChild(range);
		popup.appendChild(valueLabel);
		anchor.style.position = 'relative';
		anchor.appendChild(popup);

		const close = (e: MouseEvent) => {
			if (!popup.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
				popup.remove();
				document.removeEventListener('click', close);
			}
		};
		setTimeout(() => document.addEventListener('click', close), 0);
	}

	private toggleGimbal(callbacks: SettingCallbacks): void {
		this.gimbalActive = !this.gimbalActive;
		this.gimbalBtn.innerHTML = GIMBAL_SVG(this.gimbalActive ? '#4fc3f7' : '#ccc');

		if (this.gimbalActive) {
			// just update the stored position, no sending here
			this.gimbalMouseMove = (e: MouseEvent) => {
				this.gimbalPos.x = e.clientX;
				this.gimbalPos.y = e.clientY;
			};

			this.gimbalMouseClick = () => {
				this.gimbalActive = false;
				this.gimbalBtn.innerHTML = GIMBAL_SVG('#ccc');
				this.removeGimbalListeners();
			};

			// send at fixed interval — 50ms = 20Hz, safe for the gimbal
			this.gimbalTimer = setInterval(() => {
				const pan  = Math.round((this.gimbalPos.x / window.innerWidth)  * 180);
				const tilt = Math.round((this.gimbalPos.y / window.innerHeight) * 180);
				callbacks.onGimbalMove(
					Math.max(0, Math.min(180, pan)),
					Math.max(0, Math.min(180, tilt)),
				);
			}, 50);

			document.addEventListener('mousemove', this.gimbalMouseMove);
			setTimeout(() => document.addEventListener('mousedown', this.gimbalMouseClick!), 0);
		} else {
			this.removeGimbalListeners();
		}
	}

	private removeGimbalListeners(): void {
		if (this.gimbalMouseMove)  document.removeEventListener('mousemove', this.gimbalMouseMove);
		if (this.gimbalMouseClick) document.removeEventListener('mousedown', this.gimbalMouseClick);
		if (this.gimbalTimer)      clearInterval(this.gimbalTimer);
		this.gimbalMouseMove  = null;
		this.gimbalMouseClick = null;
		this.gimbalTimer      = null;
	}

	destroy(): void {
		this.gimbalActive = false;
		this.removeGimbalListeners();
	}
}

/** APK-matching emergency stop: swipe the whole button left to activate. */
export class EmergencyStop {
	private container: HTMLElement;
	private arrowEl: HTMLElement;
	private activated = false;
	private startX = 0;
	private animating = false;

	constructor(parent: HTMLElement, private onStop: (active: boolean) => void) {
		this.container = document.createElement('div');
		this.container.className = 'emergency-stop';

		// Left-pointing double arrow
		this.arrowEl = document.createElement('span');
		this.arrowEl.className = 'estop-arrow';
		this.arrowEl.innerHTML = '&#x00AB;'; // « double left arrow

		const label = document.createElement('span');
		label.className = 'estop-label';
		label.textContent = 'STOP';

		this.container.appendChild(this.arrowEl);
		this.container.appendChild(label);

		// Invisible drag overlay (APK: operation_bar 120% width, 180% height)
		const dragArea = document.createElement('div');
		dragArea.className = 'estop-drag-area';
		this.container.appendChild(dragArea);

		dragArea.addEventListener('pointerdown', (e) => this.onPointerDown(e, dragArea));
		dragArea.addEventListener('pointermove', (e) => this.onPointerMove(e, dragArea));
		dragArea.addEventListener('pointerup', (e) => this.onPointerUp(e, dragArea));
		dragArea.addEventListener('pointercancel', (e) => this.onPointerUp(e, dragArea));

		parent.appendChild(this.container);
	}

	private onPointerDown(e: PointerEvent, area: HTMLElement): void {
		if (this.animating) return;
		this.startX = e.clientX;
		area.setPointerCapture(e.pointerId);
	}

	private onPointerMove(e: PointerEvent, area: HTMLElement): void {
		if (this.animating || !area.hasPointerCapture(e.pointerId)) return;
		// No visual movement — APK doesn't move the button visually during drag
	}

	private onPointerUp(e: PointerEvent, area: HTMLElement): void {
		if (this.animating) return;
		area.releasePointerCapture(e.pointerId);
		const dragDist = this.startX - e.clientX; // positive = dragged left

		if (!this.activated && dragDist > 30) {
			// Swipe left → activate
			this.activated = true;
			this.container.classList.add('animation');
			this.arrowEl.classList.add('active');
			this.onStop(true);
		} else if (this.activated && dragDist < -30) {
			// Swipe right → deactivate
			this.activated = false;
			this.container.classList.remove('animation');
			this.arrowEl.classList.remove('active');
			this.onStop(false);
		}
	}
}
