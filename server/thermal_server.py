import asyncio
import json
import cv2
import numpy as np
from aiohttp import web
import os
# Use VideoStreamTrack instead of MediaStreamTrack
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCConfiguration, RTCIceServer
from av import VideoFrame

from lepton.misc.cmaps import Cmaps

pcs = {}
DEBUG_THERMAL = os.getenv("THERMAL_DEBUG", "0") == "1"

DEVICE = 2
WIDTH = 160
HEIGHT = 120
FULL_HEIGHT = 122

PALETTE_NAMES = [
    "afmhot", "arctic", "black_hot", "cividis", "ironbow",
    "inferno", "magma", "outdoor_alert", "plasma", "rainbow",
    "rainbow_hc", "viridis", "white_hot",
]

def apply_cmap(gray8: np.ndarray, cmap_name: str) -> np.ndarray:
    cmap = Cmaps[cmap_name]
    rgba = cmap(gray8.astype(np.float32) / 255.0)
    return (rgba[:, :, :3] * 255).astype(np.uint8)

class ThermalTrack(VideoStreamTrack): # <-- Inherit from VideoStreamTrack
    kind = "video"

    def __init__(self, device=DEVICE):
        super().__init__()
        self._queue = asyncio.Queue(maxsize=2)
        self._task = None
        self._last_stats = {"center_c": None, "min_c": None, "max_c": None,
                            "min_pos": None, "max_pos": None}
        self._palette = "ironbow"

        self.cap = cv2.VideoCapture(device, cv2.CAP_V4L2)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FULL_HEIGHT)
        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"Y16 "))
        self.cap.set(cv2.CAP_PROP_CONVERT_RGB, 0)

        if not self.cap.isOpened():
            raise RuntimeError(f"Could not open /dev/video{device}")

        print(f"Opened thermal camera on /dev/video{device}", flush=True)

    def set_palette(self, name: str):
        if name in PALETTE_NAMES:
            self._palette = name

    def latest_stats(self):
        return self._last_stats

    async def _capture_loop(self):
        loop = asyncio.get_event_loop()
        while True:
            ok, frame = await loop.run_in_executor(None, self.cap.read)
            if not ok or frame.dtype != np.uint16 or frame.shape != (FULL_HEIGHT, WIDTH):
                await asyncio.sleep(0.05)
                continue

            image_raw = frame[:-2, :]
            temp_c = image_raw.astype(np.float32) * 0.01 - 273.15

            max_pos = np.unravel_index(np.argmax(temp_c), temp_c.shape)
            min_pos = np.unravel_index(np.argmin(temp_c), temp_c.shape)

            self._last_stats = {
                "center_c": float(temp_c[HEIGHT // 2, WIDTH // 2]),
                "min_c":    float(temp_c.min()),
                "max_c":    float(temp_c.max()),
                "min_pos":  [int(min_pos[1]), int(min_pos[0])], #"min_pos":  [int(min_pos[1]), HEIGHT - 1 - int(min_pos[0])],  # flip y
                "max_pos":  [int(max_pos[1]), int(max_pos[0])], #"max_pos":  [int(max_pos[1]), HEIGHT - 1 - int(max_pos[0])],  # flip y
            }

            gray8 = cv2.normalize(image_raw, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
            rgb = apply_cmap(gray8, self._palette)

            # 2. Draw markers on the SMALL image (keeps them 1px sharp)
            cx, cy = WIDTH // 2, HEIGHT // 2
            cv2.drawMarker(rgb, (cx, cy), (255, 255, 255), cv2.MARKER_CROSS, 5, 1)
            cv2.drawMarker(rgb, (max_pos[1], max_pos[0]), (255, 80, 80), cv2.MARKER_TILTED_CROSS, 5, 1)

            # as camera is upside down
            rgb = cv2.flip(rgb, 0)

            # 3. UPSCALING (The "Tkinter Secret")
            # We upscale to 640x480 using INTER_NEAREST. 
            # This preserves the sharp "blocky" thermal look that the encoder won't smudge.
            rgb = cv2.resize(rgb, (640, 480), interpolation=cv2.INTER_NEAREST)

            # 4. Final check for PyAV
            rgb = np.ascontiguousarray(rgb)

            if self._queue.full():
                self._queue.get_nowait()
            await self._queue.put(rgb)

    async def recv(self):
        if self._task is None:
            self._task = asyncio.ensure_future(self._capture_loop())

        # 1. Wait for the frame FIRST so timestamps aren't stale
        rgb = await self._queue.get()
        
        # 2. Grab timestamp exactly when frame is ready to be processed
        pts, time_base = await self.next_timestamp()

        # 3. Force C-Contiguous array (Prevents PyAV silent drops)
        rgb = np.ascontiguousarray(rgb)

        video_frame = VideoFrame.from_ndarray(rgb, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

    # Rename close() to stop() to integrate with aiortc's native lifecycle
    def stop(self):
        super().stop()
        if self._task:
            self._task.cancel()
            self._task = None
        if self.cap:
            self.cap.release()
            self.cap = None
            print("Thermal camera released", flush=True)

# --- Routes ---

async def index(request):
    return web.FileResponse("new_index.html")

async def offer(request):
    params = await request.json()
    pc = RTCPeerConnection(configuration=RTCConfiguration(
        iceServers=[
            RTCIceServer(urls="stun:stun.l.google.com:19302")
        ]
    ))
    pc_id = str(id(pc))
    track = ThermalTrack()

    pc.addTrack(track)

    @pc.on("datachannel")
    def on_datachannel(channel):
        print("Data channel open:", channel.label, flush=True)

        async def push_stats():
            while True:
                if channel.readyState == "open":
                    # Check if track exists and hasn't been closed
                    channel.send(json.dumps(track.latest_stats()))
                elif channel.readyState in ("closing", "closed"):
                    break
                await asyncio.sleep(0.2)

        async def handle_message(msg):
            try:
                data = json.loads(msg)
                if "palette" in data and len(pc.getSenders()) > 0:
                    track = pc.getSenders()[0].track
                    if track:
                        track.set_palette(data["palette"])
                        print("Palette set to", data["palette"], flush=True)
            except Exception:
                pass

        channel.on("message", lambda msg: asyncio.ensure_future(handle_message(msg)))
        asyncio.ensure_future(push_stats())

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("Connection state:", pc.connectionState, flush=True)
        if pc.connectionState in ("failed", "closed", "disconnected"):
            for sender in pc.getSenders():
                if sender.track:
                    sender.track.stop() # call the new stop() method
            await pc.close()
            pcs.pop(pc_id, None)

    # Reordered SDP logic: Parse remote description BEFORE adding track
    offer_desc = RTCSessionDescription(sdp=params["sdp"], type=params["type"])
    await pc.setRemoteDescription(offer_desc)

    # Now add the track, aiortc will correctly pair it to the existing transceiver
    
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.json_response({"sdp": pc.localDescription.sdp,
                               "type": pc.localDescription.type,
                               "pc_id": pc_id,  # send back the id so client can reference it
                              })

async def ice_candidate(request):
    params = await request.json()
    pc_id = params.get("pc_id")
    pc = next(iter(pcs.values()), None)
    if not pc:
        return web.Response(status=404, text="PC not found")
    candidate = params.get("candidate")
    if candidate:
        from aiortc import RTCIceCandidate
        from aiortc.sdp import candidate_from_sdp
        try:
            c = candidate_from_sdp(candidate["candidate"].split("candidate:")[1])
            c.sdpMid = candidate["sdpMid"]
            c.sdpMLineIndex = candidate["sdpMLineIndex"]
            await pc.addIceCandidate(c)
        except Exception as e:
            print(f"Failed to add ICE candidate: {e}", flush=True)
    return web.Response(status=200)


async def on_shutdown(app):
    await asyncio.gather(*[pc.close() for pc in pcs.values()], return_exceptions=True)
    pcs.clear()

app = web.Application()
app.router.add_get("/", index)
app.router.add_post("/thermal/offer", offer)
app.router.add_post("/thermal/ice", ice_candidate)
app.on_shutdown.append(on_shutdown)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=8080)
