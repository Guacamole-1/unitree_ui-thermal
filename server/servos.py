import RPi.GPIO as GPIO
from time import sleep
import json
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Gimbal Server", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger("gimbal_server")
GPIO.setmode(GPIO.BCM)


class Servo:
    minDC = 5 # DC = duty cycle
    neutral = 7.5
    maxDC = 10.5 # 12

    def __init__(self,GPIO_pin):
        GPIO.setup(GPIO_pin, GPIO.OUT)
        self.pwm = GPIO.PWM(GPIO_pin, 50)
        self.pwm.start(self.neutral) # start at this duty cycle

    async def setAngle(self,angle: int):
        """moves the servo to a certain angle (0 - 180)"""
        if type(angle) is not int:
            return None
        elif angle < 0 or angle > 180:
            return None
        dutycycle = (angle/180)*(self.maxDC-self.minDC)+self.minDC  # equation to get dutycycle in relation to angle and max values of servo
        self.Move(dutycycle)
         # sleep based on its angle to let it move, this equation is for the SG090 servo
        await asyncio.sleep((0.1*angle)/60)

    def Move(self,dutycycle: float):
        """moves the servo to a certain dutycycle position"""
        if type(dutycycle) is not float:
            return None
        elif dutycycle > self.maxDC or dutycycle < self.minDC:
            return None
        self.pwm.ChangeDutyCycle(dutycycle)
        print(f"moved DC: {dutycycle}")

class Gimbal:
    """control the Gimbal, panAngle to set the angle for side to side movement
       and tiltAngle for up down movement"""
    def __init__(self,pan_gpio,tilt_gpio):
        self.pan = Servo(pan_gpio)
        self.tilt = Servo(tilt_gpio)

    async def panAngle(self,angle: int):
        await self.pan.setAngle(angle)
    async def tiltAngle(self,angle: int):
        await self.tilt.setAngle(angle)

    async def Move(self,cmd : dict):
        tasks = []
        if "pan" in cmd:
            tasks.append(self.panAngle(cmd["pan"]))
        if "tilt" in cmd:
            tasks.append(self.tiltAngle(cmd["tilt"]))
        if tasks:
            await asyncio.gather(*tasks)

    async def jsonMove(self,json_str : str):
        action = json.loads(json_str)
        await self.Move(action)



@app.websocket("/gimbal/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_json()
            if gimbal:
                await gimbal.Move(data)
                log.debug(f"moved: {data}")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error(f"{e}: '{e.doc}'")

gimbal = None

if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
    gimbal = Gimbal(12, 13)
    uvicorn.run(app, host="0.0.0.0", port=5052)
    GPIO.cleanup()




#TODO FastAPI bullshit

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     status_task = asyncio.create_task(_status_monitor())
#     adapter_task = asyncio.create_task(_adapter_monitor())
#     yield                  # app runs here
#     status_task.cancel()   # cleanup on shutdown
#     adapter_task.cancel()
#     if session.connected:
#         await session.disconnect()
