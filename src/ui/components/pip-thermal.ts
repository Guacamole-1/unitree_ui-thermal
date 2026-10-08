import { ThermalData } from "../../connection/thermal_webrtc";
import { PipCamera, PipContent } from "./pip-camera";

export class PipThermal extends PipCamera{
  private statsOverlay: HTMLElement;

  constructor(parent: HTMLElement){

	const initialX = 12, initialY = 56;
	  super(parent, initialX + 385 + 10, initialY);

	this.overlay.textContent = 'No Thermal Video';

	this.statsOverlay = document.createElement('div');
    this.statsOverlay.className = 'pip-thermal-stats';
    this.statsOverlay.textContent = 'No Data';
    this.container.appendChild(this.statsOverlay);

	this.container.className = 'pip-camera pip-thermal-camera';
  }

  updateStats(data: ThermalData): void {
	this.statsOverlay.textContent =
		`center: ${data.center_c.toFixed(2)} °C ` +
		`min: ${data.min_c.toFixed(2)} °C ` +
		`max: ${data.max_c.toFixed(2)} °C `;
  }
}
