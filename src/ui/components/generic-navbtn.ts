

const colors = {red: '#ff0f4d',green: '#4CAF50',orange:'#FFB74D',dark_gray:"rgba(26,29,35,0.95)"
  ,dark_green: "rgba(76,175,80,0.15)", dark_orange:  'rgba(255,183,77,0.15)'}
const BOX_SHADOW = (color: string) => `0 0 12px ${color}, 0 2px 6px rgba(0,0,0,0.3)`

export let BtnEvent: "default" | "mouseenter" | "mouseleave" | "mouseclick" | "active" | "loading" | "error" ;
export class GenericBtn {
  element: HTMLButtonElement;
  protected iconEl: HTMLSpanElement;
  protected currentState: typeof BtnEvent;
  protected svg: SVGSVGElement;
  protected svg_default_color: string = "";
  protected isActive: true | "loading" | false = false;
  constructor(Svg:string, default_color:string) {

	this.element = document.createElement('button');
    this.element.type = 'button';
    this.element.className = 'nav-circle-icon';

	this.iconEl = document.createElement('span');
    this.iconEl.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    this.iconEl.innerHTML = Svg;

	this.element.style.cssText = `
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(26,29,35,0.95);
    border: 1.5px solid #3a3d45;
    margin-left: 4px;
    transition: all 0.15s;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
    padding: 0;
 `;
	this.svg = this.iconEl.querySelector('svg')!;
	this.svg_default_color = default_color;
	this.svg.style.color = default_color;
	this.element.appendChild(this.iconEl);
	this.currentState = "default";

    //this.btn.addEventListener('click', () => this.options.onMenuClick?.());

  }
	protected Activate(){}

	protected setEvent(e:typeof BtnEvent){
	  switch(e){
		case "mouseenter":
		  if(this.isActive === false){
			this.element.style.background = colors.dark_green;
		  }
		  this.element.style.transform = 'scale(1.05)';
		  break;
		case "mouseleave":
		  this.element.style.background = colors.dark_gray;
		  this.element.style.transform = 'scale(1)';
		  break;
		case "active":
		  this.element.style.boxShadow = BOX_SHADOW(colors.green);
		  this.svg.style.color = colors.green;
		  this.isActive = true;
		  break;
		case "loading":
		  this.element.style.boxShadow = BOX_SHADOW(colors.orange);
		  this.svg.style.color = colors.orange;
		  this.isActive = "loading";
		  break;
		case "error":
		  this.element.style.boxShadow = BOX_SHADOW(colors.red);
		  this.svg.style.color = colors.red;
		  break;
		case "default":
		  this.element.style.boxShadow = "";
		  this.svg.style.color = this.svg_default_color;
		  this.isActive = false;
		  break;
	  }
	  this.currentState = e;
	}
}
