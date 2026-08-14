import asyncio
import json
import os
import cv2
import numpy as np
from aiohttp import web
from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    VideoStreamTrack,
    RTCConfiguration,
    RTCIceServer,
)
from av import VideoFrame

from lepton.misc.cmaps import Cmaps

pcs = set()

DEVICE = 2
WIDTH = 160
HEIGHT = 120
FULL_HEIGHT = 122

DEBUG_THERMAL = os.getenv("THERMAL_DEBUG", "0") == "1"

PALETTE_NAMES = [
    "afmhot", "arctic", "black_hot", "cividis", "ironbow",
    "inferno", "magma", "outdoor_alert", "plasma", "rainbow",
    "rainbow_hc", "viridis", "white_hot",
]


def apply_cmap(gray8: np.ndarray, cmap_name: str) -> np.ndarray:
    cmap = Cmaps[cmap_name]
    rgba = cmap(gray8.astype(np.float32) / 255.0)
    return (rgba[:, :, :3] * 255).astype(np.uint8)


class DebugThermalTrack(VideoStreamTrack):
    kind = "video"

    def __init__(self):
        super().__init__()
        self._palette = "ironbow"
        self._frame_index = 0
        self._last_stats = {
            "center_c": 25.0,
            "min_c": 20.0,
            "max_c": 40.0,
            "min_pos": [0, 0],
            "max_pos": [0, 0],
        }
        print("Using DEBUG thermal source", flush=True)

    def set_palette(self, name: str):
        if name in PALETTE_NAMES:
            self._palette = name

    def latest_stats(self):
        return self._last_stats

    async def recv(self):
        pts, time_base = await self.next_timestamp()

        self._frame_index += 1
        t = self._frame_index * 0.08

        x = np.linspace(0, 1, WIDTH, dtype=np.float32)
        y = np.linspace(0, 1, HEIGHT, dtype=np.float32)
        xx, yy = np.meshgrid(x, y)

        hot_x = 0.5 + 0.30 * np.sin(t)
        hot_y = 0.5 + 0.25 * np.cos(t * 0.7)

        cold_x = 0.5 + 0.35 * np.sin(t * 0.5 + 2.0)
        cold_y = 0.5 + 0.25 * np.cos(t * 0.9 + 1.0)

        hot_blob = np.exp(-(((xx - hot_x) ** 2) + ((yy - hot_y) ** 2)) / 0.010)
        cold_blob = np.exp(-(((xx - cold_x) ** 2) + ((yy - cold_y) ** 2)) / 0.018)

        temp_c = (
            24.0
            + 18.0 * hot_blob
            - 6.0 * cold_blob
            + 2.0 * np.sin(xx * 8.0 + t)
            + 1.0 * np.cos(yy * 10.0 - t)
        ).astype(np.float32)

        max_pos = np.unravel_index(np.argmax(temp_c), temp_c.shape)
        min_pos = np.unravel_index(np.argmin(temp_c), temp_c.shape)

        self._last_stats = {
            "center_c": float(temp_c[HEIGHT // 2, WIDTH // 2]),
            "min_c": float(temp_c.min()),
            "max_c": float(temp_c.max()),
            "min_pos": [int(min_pos[1]), int(min_pos[0])],
            "max_pos": [int(max_pos[1]), int(max_pos[0])],
        }

        gray8 = cv2.normalize(temp_c, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        rgb = apply_cmap(gray8, self._palette)

        cx, cy = WIDTH // 2, HEIGHT // 2
        cv2.drawMarker(rgb, (cx, cy), (255, 255, 255), cv2.MARKER_CROSS, 5, 1)
        cv2.drawMarker(rgb, (max_pos[1], max_pos[0]), (255, 80, 80), cv2.MARKER_TILTED_CROSS, 5, 1)

        rgb = cv2.resize(rgb, (640, 480), interpolation=cv2.INTER_NEAREST)
        rgb = np.ascontiguousarray(rgb)

        frame = VideoFrame.from_ndarray(rgb, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        return frame

    def stop(self):
        super().stop()
        print("Debug thermal track stopped", flush=True)


class ThermalTrack(VideoStreamTrack):
    kind = "video"

    def __init__(self, device=DEVICE):
        super().__init__()
        self._queue = asyncio.Queue(maxsize=2)
        self._task = None
        self._last_stats = {
            "center_c": None,
            "min_c": None,
            "max_c": None,
            "min_pos": None,
            "max_pos": None,
        }
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

            if not ok:
                print("Thermal frame read failed", flush=True)
                await asyncio.sleep(0.05)
                continue

            if frame.dtype != np.uint16 or frame.shape != (FULL_HEIGHT, WIDTH):
                print(f"Unexpected frame: dtype={frame.dtype}, shape={frame.shape}", flush=True)
                await asyncio.sleep(0.05)
                continue

            image_raw = frame[:-2, :]
            temp_c = image_raw.astype(np.float32) * 0.01 - 273.15

            max_pos = np.unravel_index(np.argmax(temp_c), temp_c.shape)
            min_pos = np.unravel_index(np.argmin(temp_c), temp_c.shape)

            self._last_stats = {
                "center_c": float(temp_c[HEIGHT // 2, WIDTH // 2]),
                "min_c": float(temp_c.min()),
                "max_c": float(temp_c.max()),
                "min_pos": [int(min_pos[1]), int(min_pos[0])],
                "max_pos": [int(max_pos[1]), int(max_pos[0])],
            }

            gray8 = cv2.normalize(image_raw, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
            rgb = apply_cmap(gray8, self._palette)

            cx, cy = WIDTH // 2, HEIGHT // 2
            cv2.drawMarker(rgb, (cx, cy), (255, 255, 255), cv2.MARKER_CROSS, 5, 1)
            cv2.drawMarker(rgb, (max_pos[1], max_pos[0]), (255, 80, 80), cv2.MARKER_TILTED_CROSS, 5, 1)

            rgb = cv2.resize(rgb, (640, 480), interpolation=cv2.INTER_NEAREST)
            rgb = np.ascontiguousarray(rgb)

            if self._queue.full():
                try:
                    self._queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

            await self._queue.put(rgb)

    async def recv(self):
        if self._task is None:
            self._task = asyncio.ensure_future(self._capture_loop())

        rgb = await self._queue.get()

        pts, time_base = await self.next_timestamp()

        frame = VideoFrame.from_ndarray(rgb, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        return frame

    def stop(self):
        super().stop()

        if self._task:
            self._task.cancel()
            self._task = None

        if self.cap:
            self.cap.release()
            self.cap = None
            print("Thermal camera released", flush=True)


def make_track():
    if DEBUG_THERMAL:
        return DebugThermalTrack()

    try:
        return ThermalTrack()
    except Exception as e:
        print(f"Real thermal camera unavailable, falling back to debug source: {e}", flush=True)
        return DebugThermalTrack()


async def index(request):
    return web.FileResponse("new_index.html")


async def offer(request):
    print("Received /thermal/offer", flush=True)

    try:
        params = await request.json()

        pc = RTCPeerConnection(
            configuration=RTCConfiguration(
                iceServers=[
                    RTCIceServer(urls="stun:stun.l.google.com:19302")
                ]
            )
        )

        pcs.add(pc)

        # Create track once and keep a direct reference.
        # Do not rely on pc.getSenders()[0].
        track = make_track()

        @pc.on("datachannel")
        def on_datachannel(channel):
            print(f"Data channel received: {channel.label}", flush=True)

            stats_task = None

            async def push_stats():
                print("Stats sender started", flush=True)

                while True:
                    if channel.readyState == "closed":
                        print("Stats sender stopped: channel closed", flush=True)
                        break

                    if channel.readyState == "open":
                        try:
                            channel.send(json.dumps(track.latest_stats()))
                        except Exception as e:
                            print(f"Could not send stats: {e}", flush=True)

                    await asyncio.sleep(0.2)

            async def handle_message(msg):
                try:
                    data = json.loads(msg)

                    if "palette" in data:
                        track.set_palette(data["palette"])
                        print(f"Palette set to {data['palette']}", flush=True)

                except Exception as e:
                    print(f"Data channel message error: {e}", flush=True)

            @channel.on("open")
            def on_open():
                nonlocal stats_task
                print(f"Data channel open: {channel.label}", flush=True)
                stats_task = asyncio.ensure_future(push_stats())

            @channel.on("message")
            def on_message(msg):
                asyncio.ensure_future(handle_message(msg))

            @channel.on("close")
            def on_close():
                print(f"Data channel closed: {channel.label}", flush=True)
                if stats_task:
                    stats_task.cancel()

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            print(f"Connection state: {pc.connectionState}", flush=True)

            # Do not immediately close on "disconnected".
            # It can be temporary.
            if pc.connectionState in ("failed", "closed"):
                print("Closing peer connection", flush=True)
                track.stop()
                await pc.close()
                pcs.discard(pc)

        offer_desc = RTCSessionDescription(
            sdp=params["sdp"],
            type=params["type"],
        )

        await pc.setRemoteDescription(offer_desc)

        pc.addTrack(track)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        print("Returning WebRTC answer", flush=True)

        return web.json_response(
            {
                "sdp": pc.localDescription.sdp,
                "type": pc.localDescription.type,
            }
        )

    except Exception as e:
        print(f"Offer failed: {e}", flush=True)
        return web.json_response(
            {"error": str(e)},
            status=500,
        )


async def on_shutdown(app):
    await asyncio.gather(*[pc.close() for pc in pcs], return_exceptions=True)
    pcs.clear()


app = web.Application()
app.router.add_get("/", index)
app.router.add_post("/thermal/offer", offer)
app.on_shutdown.append(on_shutdown)

if __name__ == "__main__":
    print(f"Starting thermal server. DEBUG_THERMAL={DEBUG_THERMAL}", flush=True)
    web.run_app(app, host="127.0.0.1", port=8080)
