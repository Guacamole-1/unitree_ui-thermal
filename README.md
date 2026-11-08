# Unitree WebRTC UI — Thermal Fork

A browser-based control interface for **Unitree Go2**, **Unitree G1**, and **Unitree R1** robots, communicating over the same WebRTC connection the official mobile apps use. No jailbreak, no firmware modification, no phone app required.

**This fork extends [legion1581/unitree_ui](https://github.com/legion1581/unitree_ui) with a thermal inspection subsystem for the Unitree Go2.** It adds a separate thermal camera feed, live temperature readings, selectable thermal colour palettes, and control of a two-axis camera gimbal — all integrated into the existing web interface.

Built with TypeScript, Three.js, Vite and Python.

![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Browser](https://img.shields.io/badge/tested-Chrome-brightgreen)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

<p align="center">
  <img src="images/interface_thermal.png" width="90%" />
</p>

<p align="center">
  <img src="images/connect_go2.png" width="32%" />
  <img src="images/connect_g1.png" width="32%" />
  <img src="images/connect_r1.png" width="32%" />
</p>


## Thermal Extension — What's New in This Fork?

The additions in this fork are intended for **remote thermal inspection**, such as observing electrical or industrial equipment from a mobile robot:

- **Live thermal video:** a second WebRTC connection streams a thermal camera feed independently of the Go2's built-in RGB camera.
- **Thermal picture-in-picture:** the thermal feed appears in a separate window inside the robot control UI.
- **Temperature telemetry:**  live **centre, minimum and maximum temperatures (°C)** supplied by the thermal backend are displayed over the thermal window.
- **Thermal palettes:** switch between supported colour mappings (including Ironbow, White Hot, Black Hot and Inferno) from the interface.
- **Two-axis gimbal control:** pan/tilt control through the browser, with commands sent via WebSocket to a Python servo server.

The robot and thermal video streams are independent. The thermal video/telemetry service and gimbal controller are external components, rather than built-in Unitree robot features.

> **Compatibility:** The thermal integration currently targets the **Go2 in Local Network (STA-L) mode**, with a separately configured thermal camera and backend. The original UI's G1 and R1 support is retained, but thermal support has not been implemented for those robots. The thermal integration is experimental.

## Supported Robots

| Family | Firmware | Thermal Support|
|--------|----------| -----|
| **Go2** | 1.0.19 – 1.0.25, 1.1.1 – 1.1.15 *(latest)* | ✓ (STA-L)|
| **G1**  | 1.2.0 – 1.4.5, 1.5.1+ *(latest)* | ✗ |
| **R1**  | 1.4.2 *(latest)* | ✗ |

R1 shares the humanoid control channel with G1, so it inherits the same modes,
arm gestures, status panels and e-stop. Its own FSM state ids differ — Run rides
on 811 (`AmpMotion22Dof`) rather than 801, and it adds the dance / martial-arts
set — all catalogued in [R1 Action List](docs/r1_action_list.md).

## Tour

<p align="center">
  <img src="images/landing.png" width="32%" />
  <img src="images/hub.png" width="32%" />
  <img src="images/webview_g1.png" width="32%" />
</p>

<p align="center">
  <img src="images/status_g1.png" width="32%" />
  <img src="images/services_go2.png" width="32%" />
  <img src="images/slam.png" width="32%" />
</p>

## Quick Start

```bash
git clone https://github.com/legion1581/unitree_ui.git
cd unitree_ui
npm install
npm run start          # Vite + Python BLE server together
# or:
npm run start:no-ble   # Vite only, no Bluetooth features
```

`npm run start` and `npm run start:no-ble` already bind Vite to all interfaces, so the terminal will print both a `Local:` (`http://localhost:5173`) and a `Network:` (`http://192.168.x.x:5173`) URL — open the Local one on this machine, the Network one from your phone or another device on the same WiFi. Use **Chrome** (recommended).

If you want Vite by itself (no BLE backend), `npm run dev` is localhost-only; `npm run dev:host` is the LAN-exposed equivalent.

The dev server includes hot module replacement, a built-in UDP multicast scanner (no separate process needed), and proxies for the robot API, Unitree cloud API, and BLE server.

For a production build:

```bash
npm run build && npm run preview
```

### Prerequisites

- Node.js ≥ 18, npm ≥ 9
- Chrome (Firefox is experimental, Safari untested)
- A Unitree Go2, G1, or R1 robot


### Additional Setup for the Thermal Extension (Go2)

The normal startup command starts the UI (and optionally BLE), **not** the thermal camera backend or gimbal service. To use the thermal subsystem, also configure:

1. **Thermal WebRTC backend:** A separate camera service that implements WebRTC offer/ICE signalling and provides the thermal stream and temperature data. In `vite.config.ts`, `/thermal/*` is currently proxied to `http://127.0.0.1:8080`. The external thermal backend must be started and reachable separately.
2. **Gimbal controller:** `server/servos.py` is a Raspberry Pi GPIO/FastAPI server for pan/tilt servo control. With the required Python libraries and hardware configured on the Raspberry Pi, start it using:

   ```bash
   python3 server/servos.py
   ```

   It listens on port **5052** (`/gimbal/ws`). Vite proxies this WebSocket path to `ws://127.0.0.1:5052` by default.
3. **Network configuration:** If either backend runs on another machine, replace the corresponding `127.0.0.1` proxy target in `vite.config.ts` with that machine's reachable IP address. These addresses refer to the host running Vite, **not** the browser or robot.
4. **Go2 connection:** Select **Local Network (STA-L)** for the Go2 and make sure the thermal backend is available. The thermal panel, temperature display, and gimbal controls then become available in the control interface.

## Features

### Added by this fork

- **Thermal video** — independent WebRTC thermal camera feed alongside the robot camera.
- **Thermal measurements** — centre, minimum and maximum temperatures presented in the thermal picture-in-picture view.
- **Thermal colour palettes** — selectable thermal image palette through the UI.
- **Pan/tilt gimbal** — browser controls connected by WebSocket to a Python servo controller.

### Original Unitree UI features

- **Real-time 3D viewport** — robot model with live joint angles, lidar spinning animation, voxel point cloud (Go2 SLAM).
- **Camera + dual joystick control** — PIP video, on-screen joysticks, action carousel for sport commands and modes. On R1 the bar mirrors the official app (Damping / Zero Torque / Lock / Run plus the arm gestures) and adds the dance and Kung Fu / Jeet Kune Do states.
- **Audio** — two-way over the WebRTC connection: push-to-talk megaphone broadcast from your mic, click-to-toggle monitoring of the robot's microphone, and an APK-style **Audio Player** in Controls (record clips, upload MP3/WAV — auto-converted to the robot's WAV format, play with single / list / no-loop modes, rename, delete; live play-state sync).
- **Robot status** — battery, motors (temp / position / torque / lost packets), IMU, LiDAR, system info — family-aware fields for Go2 and for the G1 / R1 humanoids.
- **Error handling** — live decoding of firmware fault messages with snapshot + delta reconciliation; NavBar badge with active-count chip, click-anchored popover, transient toast on new faults, and a grouped full-screen list of every active error.
- **Service manager** — list MCF services, start / stop with protection handling.
- **Account manager** — Unitree cloud account: devices, firmware, tutorials, sharing, raw debug API console.
- **3D LiDAR Mapping (SLAM)** — Go2 only: build maps, localize, navigate, patrol, auto-dock and charge; local IndexedDB cache + zip import/export.
- **Bluetooth setup** — pair the robot over BLE (V1/V2 for legacy firmware, V3 for G1 ≥ 1.5.1 / Go2 ≥ 1.1.15) to configure WiFi without the phone app.
- **BLE remote relay** — pair a Unitree BLE remote, forward joystick + buttons to the robot over WebRTC.
- **Dark / light theme** — floating toggle, persisted per-browser; the 3D scene adapts on the fly.
- **Connection modes** — Local Network (STA-L), Access Point (AP), Remote (TURN through Unitree cloud).
- **Network scanner** — UDP multicast auto-discovery, including SN-targeted scan for V3-capable firmware (G1 ≥ 1.5.1, Go2 ≥ 1.1.15).

## Documentation

| Topic | What's covered |
|-------|---------------|
| [Connection](docs/connection.md) | Family selection, STA-L / AP / Remote modes, network scan, AES-128 key flow for V3-capable firmware (G1 ≥ 1.5.1, Go2 ≥ 1.1.15) |
| [Control View](docs/control.md) | Joysticks, action bar, modes, sport command IDs, BLE remote relay |
| [R1 Action List](docs/r1_action_list.md) | R1 FSM state table (fsm_id), SetFsmId api, dances / Kung Fu / Jeet Kune Do |
| [Robot Status](docs/status.md) | Battery / motor / IMU / system panels for every family |
| [Error Handling](docs/error-handling.md) | Fault wire protocol, Go2 + G1 source/code catalog, badge / popover / page UI |
| [Service Manager](docs/services.md) | MCF service list, protection flag, start/stop |
| [Account Manager](docs/account.md) | Cloud sign-in, devices, tutorials, debug console |
| [Bluetooth](docs/bluetooth.md) | Robot provisioning + remote pairing overview |
| [Bluetooth V1/V2 protocol](docs/bluetooth-v1-v2.md) | GATT layout for legacy firmware (Go2 < 1.1.15, G1 < 1.5.1) |
| [Bluetooth V3 protocol](docs/bluetooth-v3.md) | Magic-prefix + GCM key exchange (G1 ≥ 1.5.1, Go2 ≥ 1.1.15) |
| [BLE Remote Control](docs/remote-control.md) | Frame layout, axes/buttons mapping, WebRTC relay |
| [SLAM](docs/slam.md) | Mapping → Localization → Navigation flow, patrol, auto-dock |
| [LiDAR](docs/lidar.md) | Point cloud decoding pipeline |

## Project Structure

```
src/
  api/                 # Unitree cloud API client (account, devices, firmware, …)
  connection/          # WebRTC, local/remote connectors, network scanner
    thermal_webrtc.ts  # Fork: thermal WebRTC video and temperature telemetry
    gimbal.ts          # Fork: WebSocket gimbal client
  crypto/              # AES-ECB, RSA, AES-GCM for auth and SDP exchange
  protocol/            # Data channel handler, topics, sport commands
  ui/
    app.ts             # Robot control + thermal integration
    components/        # Action bar, PIP camera, status/services/account pages, nav bar
      pip-thermal.ts   # Fork: thermal PIP with temperature display
      gimbal.ts        # Fork: mouse-controlled gimbal
    scene/             # Three.js scene, robot model, voxel map
  proxy-plugin.ts      # Vite plugin: robot proxy, scanner, cloud API, BLE API proxy
public/
  icons/               # Action and mode SVG icons
  sprites/             # UI sprites and backgrounds
  models/              # Go2.glb 3D model (the humanoids use the camera view)
server/
  ble_server.py        # FastAPI BLE backend (scan, connect, WiFi config)
  servos.py            # Fork: Raspberry Pi gimbal server
  scanner.mjs          # Standalone UDP multicast scanner (optional)
vite.config.ts         # Thermal HTTP and gimbal WebSocket proxy configuration
```

## Acknowledgements

**Original project:** [legion1581/unitree_ui](https://github.com/legion1581/unitree_ui). Thanks to the original author and contributors for the robot interface on which this fork is based.

**This fork:** adds the thermal imaging interface, temperature readouts and gimbal integration.

Big thanks to the [RoboLegion](https://robolegion.com) community.

## Support

If you like the  project, please consider supporting its upstream author:

<a href="https://www.buymeacoffee.com/legion1581" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

MIT
