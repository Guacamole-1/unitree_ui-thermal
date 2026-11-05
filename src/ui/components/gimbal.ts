import { GenericBtn } from "./generic-navbtn";


const GIMBAL_SVG = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="2"/>
<circle cx="12" cy="12" r="6"/>
<line x1="12" y1="2" x2="12" y2="6"/>
<line x1="12" y1="18" x2="12" y2="22"/>
<line x1="2" y1="12" x2="6" y2="12"/>
<line x1="18" y1="12" x2="22" y2="12"/>
</svg>`;

const GIMBAL_MAX_ROT = 180;

export class GimbalBtn extends GenericBtn{
  private gimbalMouseMove: ((e: MouseEvent) => void) | null = null;
  private gimbalMouseDown: ((event: MouseEvent) => void) | null = null;
  private gimbalTimer: ReturnType<typeof setInterval> | null = null;
  private gimbalPos = { pan: GIMBAL_MAX_ROT / 2, tilt: GIMBAL_MAX_ROT / 2 };
  private GimbalMove: ((pan: number, tilt:number) => void);

  constructor(GimbalMove: (pan: number, tilt:number) => void ) {
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

    document.body.requestPointerLock();

    this.gimbalMouseMove = (event: MouseEvent) => {
      const sensitivity = 0.25;
      this.gimbalPos.pan  = Math.max(0, Math.min(GIMBAL_MAX_ROT,
        this.gimbalPos.pan - event.movementX * sensitivity));
      this.gimbalPos.tilt = Math.max(0, Math.min(GIMBAL_MAX_ROT,
        this.gimbalPos.tilt + event.movementY * sensitivity));
    };

    let lastPan = -1, lastTilt = -1;
    this.gimbalTimer = setInterval(() => {
      const pan  = Math.round(this.gimbalPos.pan);
      const tilt = Math.round(this.gimbalPos.tilt);
      if (pan === lastPan && tilt === lastTilt) return;   // nothing changed
      lastPan = pan; lastTilt = tilt;
      this.GimbalMove(pan, tilt);
    }, 50);


	this.gimbalMouseDown = () => {
        document.exitPointerLock();
    };

    document.addEventListener(
      'mousemove',
      this.gimbalMouseMove,
    );

	document.addEventListener(
      'mousedown',
      this.gimbalMouseDown,
    );

	document.addEventListener(
      'pointerlockchange',
      this.handlePointerLockChange,
	);
  }

  private stopMovement(){
	this.setEvent("default");
	this.removeGimbalListeners();
  }

  private removeGimbalListeners(): void {
	console.log("listeners deleted");
	if (this.gimbalMouseMove)  {document.removeEventListener('mousemove', this.gimbalMouseMove);}
	if (this.gimbalMouseDown) {document.removeEventListener('mousedown',this.gimbalMouseDown);}
	if (this.gimbalTimer)      clearInterval(this.gimbalTimer);
	document.removeEventListener('pointerlockchange',this.handlePointerLockChange);
	this.gimbalMouseMove  = null;
	this.gimbalTimer      = null;
	this.gimbalMouseDown = null;
  }

  destroy(): void {
	this.setEvent("default");
	if (document.pointerLockElement) document.exitPointerLock();
	this.removeGimbalListeners();
  }

  private handlePointerLockChange = (): void => {
	if (document.pointerLockElement !== document.body) {
	  this.stopMovement();
	}
  };

}
