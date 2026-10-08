import { GenericBtn } from "./generic-navbtn";

const THERMAL_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24">
<path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16
4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5
1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0
0-1-1H2z"/>
<text x="5.1" y="10" text-anchor="middle" font-size="6"
font-family="sans-serif" font-weight="700" fill="currentColor">ºC</text>
</svg>`


export class ThermalBtn extends GenericBtn{

  onThermalStart: undefined | (()=>void);
  onThermalStop : undefined | (()=>void);

  constructor(onThermalStart?: ()=> void, onThermalStop?: ()=> void ) {
	super(THERMAL_SVG,"#b0b3bb")
	this.onThermalStart = onThermalStart;
	this.onThermalStop= onThermalStop;
	this.setupEventHandlers();
  }


  private setupEventHandlers(){
	this.element.addEventListener('mouseenter', () => {
	  this.setEvent("mouseenter")
	});

    this.element.addEventListener('mouseleave', () => {
	  this.setEvent("mouseleave")
    });

	this.element.addEventListener('click', (e: PointerEvent) => {
      if (e.button !== 0) return; // left button only
      e.preventDefault();
	  if(this.isActive === false){
		this.setEvent("active");
		this.onThermalStart?.();
		//this.startMovement();
		//this.setEvent("active");
	  }else{
		//this.stopMovement();
	  }
    });

  }
}
