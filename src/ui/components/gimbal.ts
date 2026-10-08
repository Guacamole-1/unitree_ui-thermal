import { GenericBtn } from "./generic-navbtn";


const GIMBAL_SVG = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="2"/>
<circle cx="12" cy="12" r="6"/>
<line x1="12" y1="2" x2="12" y2="6"/>
<line x1="12" y1="18" x2="12" y2="22"/>
<line x1="2" y1="12" x2="6" y2="12"/>
<line x1="18" y1="12" x2="22" y2="12"/>
</svg>`;


export class GimbalBtn extends GenericBtn{
  private gimbalMouseMove: ((e: MouseEvent) => void) | null = null;
  private gimbalTimer: ReturnType<typeof setInterval> | null = null;
  private gimbalPos = { x: 0, y: 0 };
  private GimbalMove: ((pan: number, tilt:number) => void);

  constructor(GimbalMove: (pan: number, tilt:number) => void, ) {
	super(GIMBAL_SVG,"#b0b3bb")
	this.GimbalMove = GimbalMove;
	this.setupEventHandlers();
  }

  private  setupEventHandlers(){
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
		this.startMovement();
	  }else{
		this.stopMovement();
	  }
    });



  }
  private startMovement(){
	this.setEvent("active");
	// just update the stored position, no sending here
	this.gimbalMouseMove = (e: MouseEvent) => {
	  this.gimbalPos.x = e.clientX;
	  this.gimbalPos.y = e.clientY;
	};
	this.gimbalTimer = setInterval(() => {
	  const pan  = Math.round((this.gimbalPos.x / window.innerWidth)  * 180);
	  const tilt = Math.round((this.gimbalPos.y / window.innerHeight) * 180);
	  this.GimbalMove(
		Math.max(0, Math.min(180, pan)),
		Math.max(0, Math.min(180, tilt)),
	  );
	}, 50);

  }
  private stopMovement(){
	this.setEvent("default");
	this.removeGimbalListeners();
  }
  private removeGimbalListeners(): void {
	if (this.gimbalMouseMove)  document.removeEventListener('mousemove', this.gimbalMouseMove);
	if (this.gimbalTimer)      clearInterval(this.gimbalTimer);
	this.gimbalMouseMove  = null;
	this.gimbalTimer      = null;
  }

  destroy(): void {
	this.setEvent("default");
	this.removeGimbalListeners();
  }

}
