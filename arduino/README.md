# UNO LED driver

Upload `arduino.ino` to an Arduino UNO. The ESP32 computes modes; UNO drives
slot LEDs on D2–D9. Buzzer D10 stays LOW for this milestone.

Connect ESP32 GPIO13 → UNO D11 (RX), and UNO D12 (TX) → 1kΩ → ESP32 GPIO14,
with 2kΩ from that divider node to common GND. Each LED needs its 220Ω resistor.
The current protocol is one-way; the return wire is reserved for future use.

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
