from time import sleep
import json
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import pigpio

app = FastAPI(title="Gimbal Server", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger("gimbal_server")


class Servo:
    minPW = 1000   # µs — was 5% duty cycle
    neutral = 1500 # µs — was 7.5%
    maxPW = 2100   # µs — was 10.5%


    def __init__(self, pi, gpio_pin):
        self.pi = pi
        self.pin = gpio_pin
        self.angle = 90
        self.pi.set_servo_pulsewidth(self.pin, self.neutral)

    def _pw(self, angle: int) -> int:
        return int((angle / 180) * (self.maxPW - self.minPW) + self.minPW)

    async def setAngle(self, angle: int):
        if not isinstance(angle, int) or angle < 0 or angle > 180:
            return None
        self.angle = angle
        self.Move(self._pw(angle))

    def Move(self, pulsewidth: int):
            if pulsewidth > self.maxPW or pulsewidth < self.minPW:
                return None
            self.pi.set_servo_pulsewidth(self.pin, pulsewidth)
            print(f"moved PW: {pulsewidth}")

    def stop(self):
        self.pi.set_servo_pulsewidth(self.pin, 0)

class Gimbal:
    """control the Gimbal, panAngle to set the angle for side to side movement
       and tiltAngle for up down movement"""
    def __init__(self, pan_gpio, tilt_gpio):
        self.pi = pigpio.pi()
        if not self.pi.connected:
            raise RuntimeError("pigpiod not running — sudo systemctl start pigpiod")
        self.pan = Servo(self.pi, pan_gpio)
        self.tilt = Servo(self.pi, tilt_gpio)


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

    def stop(self):
        self.pan.stop()
        self.tilt.stop()
        self.pi.stop()



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
