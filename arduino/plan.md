# ESP32 ↔ Arduino LED MVP

ESP32 decides LED modes from debounced Hall inputs and cached Firebase assignments.
UNO only displays the commanded modes. Existing Firebase stock transitions stay unchanged.

## LED rules

| Slot condition | LED |
|---|---|
| Vacant, confirmed unassigned | ON |
| Occupied, assigned or unidentified | OFF |
| Assigned, awaiting first placement | OFF |
| Assigned box removed from rack | BLINK |
| Sensor or assignment unknown at startup | OFF |

Blink is 500 ms ON / 500 ms OFF. Removal preserves the reservation; return turns
the LED OFF. Confirmed dispatch makes a vacant slot ON. No other blink patterns.

## ESP32 integration

- Preserve Hall pins 4, 5, 6, 7, 15, 16, 17, 18, active-low inputs, 20 ms sampling,
  300 ms debounce, and the existing Firebase worker.
- Cache assignment identity and whether that box has previously been on-rack.
  Use `productID`, `assignedAt`, and `stock.currentStatus` from successful existing
  `ReportSlotOccupancy` responses; no schema or operation changes.
- Initialize previous presence from `OCCUPIED` or `PENDING_DISPATCH`; also remember
  stable local presence while the assignment is known. Reset on identity change
  or clearing. Identity includes `assignedAt` so reassigning the same box starts
  fresh even if the intervening dispatch was not observed. A vacant assigned
  slot blinks only after previous presence.
- Periodic reports discover app assignments and dispatches even without sensor
  edges. Visibility waits for the next successful response for that slot; the
  existing 5-second schedule is not a guaranteed end-to-end latency.
- Keep assignments in RAM during Wi-Fi loss and continue local LED decisions.
  After reboot, vacant slots stay OFF until Firebase confirms assignment state.
  Offline app changes remain unknown until synchronization.
- Protect shared data with the existing mutex, with no network or serial I/O
  inside it. Send LED frames from the main loop independently of HTTPS.

## Serial and UNO

- 9600 baud, 8N1. ESP32 `Serial1`: RX GPIO14, TX GPIO13. UNO `SoftwareSerial`:
  RX D11, TX D12. Retain common ground and the UNO TX 1kΩ/2kΩ divider.
- Frame: `L:01200000\n` (LF terminator, no CR); eight digits in slot order.
  `0` = OFF, `1` = ON/free, `2` = BLINK/removed but assigned.
- Send immediately on mode changes and every second; no ACKs.
- UNO D2–D9 drive slot LEDs 1–8. Fixed-size parser applies complete valid frames
  together. Malformed/oversized lines are discarded through the next newline.
- Use `millis()` for blinking. Repeated frames do not restart blink phase.
  No valid frame for three seconds, or startup: all LEDs OFF. A valid frame recovers.
- Keep buzzer D10 LOW. LCD, buttons, alerts, forecasts, and reorder logic are out
  of scope. Sensors cannot verify identity; staff must return the correct box.

## Validation

- Compile ESP32 and UNO sketches; run existing sensor tests plus LED lifecycle
  tests and UNO parser/watchdog tests.
- Bench sequence: free → assigned awaiting placement → placed → removed/blinking
  → returned/OFF → removed → dispatched/free.
- Check unidentified objects, sensor bounce, all eight LEDs blinking, Wi-Fi
  loss/reconnect, independent board restarts, serial timeout and malformed frames.
- Verify Firebase occupancy reporting continues during blinking. Physical and
  live Firebase checks require the connected rack.
