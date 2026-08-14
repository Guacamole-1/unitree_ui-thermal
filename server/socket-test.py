import asyncio
import curses
import json
import websockets

WS_URL = "ws://guack-pi.local:5052/gimbal/ws"  # Change this to your WebSocket server

PAN_START = 90
TILT_START = 90

PAN_MIN = 0
PAN_MAX = 180

TILT_MIN = 0
TILT_MAX = 180

STEP = 5


def clamp(value, min_value, max_value):
    return max(min_value, min(value, max_value))


async def send_command(websocket, pan, tilt):
    command = {
        "pan": pan,
        "tilt": tilt
    }

    await websocket.send(json.dumps(command))
    print(f"Sent: {command}")


async def keyboard_control(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.keypad(True)

    pan = PAN_START
    tilt = TILT_START

    async with websockets.connect(WS_URL) as websocket:
        await send_command(websocket, pan, tilt)

        stdscr.clear()
        stdscr.addstr(0, 0, "Arrow keys control pan/tilt. Press q to quit.")
        stdscr.addstr(2, 0, f"pan: {pan} | tilt: {tilt}")
        stdscr.refresh()

        while True:
            key = stdscr.getch()

            changed = False

            if key == curses.KEY_LEFT:
                pan -= STEP
                changed = True

            elif key == curses.KEY_RIGHT:
                pan += STEP
                changed = True

            elif key == curses.KEY_UP:
                tilt += STEP
                changed = True

            elif key == curses.KEY_DOWN:
                tilt -= STEP
                changed = True

            elif key == ord("q"):
                break

            if changed:
                pan = clamp(pan, PAN_MIN, PAN_MAX)
                tilt = clamp(tilt, TILT_MIN, TILT_MAX)

                await send_command(websocket, pan, tilt)

                stdscr.clear()
                stdscr.addstr(0, 0, "Arrow keys control pan/tilt. Press q to quit.")
                stdscr.addstr(2, 0, f"pan: {pan} | tilt: {tilt}")
                stdscr.refresh()

            await asyncio.sleep(0.03)


def main(stdscr):
    asyncio.run(keyboard_control(stdscr))


if __name__ == "__main__":
    curses.wrapper(main)
