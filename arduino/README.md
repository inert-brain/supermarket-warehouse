# UNO LED driver

Upload `arduino.ino` to an Arduino UNO. The ESP32 computes modes; UNO drives
slot LEDs on D2–D9. Buzzer D10 stays LOW for this milestone.

Connect ESP32 GPIO13 → UNO D11 (RX), and UNO D12 (TX) → 1kΩ → ESP32 GPIO14,
with 2kΩ from that divider node to common GND. Each LED needs its 220Ω resistor.
The return wire carries UNO diagnostics to the ESP32. Both sketches must be updated.

ON = vacant and unassigned; OFF = occupied, awaiting first placement, or unknown;
BLINK = assigned box has been removed. Blink is 500 ms ON / 500 ms OFF.
If serial commands stop for three seconds, all LEDs turn OFF.

Serial is 9600 baud, 8N1. Example: `L:01200000\n`, with a literal LF terminator.
The eight digits command slots 1–8: 0 OFF, 1 ON, 2 BLINK. CRLF is not accepted.
ESP32 sends changes immediately and repeats every second.

From the repository root:

```sh
esp32/.build/arduino-cli compile --fqbn arduino:avr:uno arduino
g++ -std=c++11 -Wall -Wextra -Werror -pedantic arduino/tests/output_test.cpp -o /tmp/rack_output_test
/tmp/rack_output_test
```

Use `arduino-cli` from PATH instead if installed there. See [plan.md](plan.md)
for the integration rules and bench checklist. Native tests cover parsing and
output decisions, not electrical behavior or serial timing on physical hardware.

UNO replies `A:01200000\n` after applying valid LED modes, `U:WAIT\n` at boot, and `U:TIMEOUT\n` when its three-second watchdog switches the LEDs off. ESP32 prints these diagnostics at 115200 baud every two seconds. No reply can mean disconnected wiring, old firmware, or missing UNO power. Replies confirm commanded modes, not electrical LED health.

For intermittent all-off behavior, USB logs now include `lastCmd` (last valid mode
frame), `D2-D9` (digital pin levels, 1=HIGH), `ageMs` (time since a valid frame),
`badFrames`, and `rxOverflows`. A blinking pin alternates HIGH/LOW; these readings
still do not measure light from an LED. `TIMEOUT` forces all pins LOW after 3 seconds.
The ESP32 spaces LED frames at least 50 ms apart to allow the UNO's SoftwareSerial
reply to finish. Upload both sketches for this diagnostic update.
