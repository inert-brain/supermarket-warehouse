Part A: Electrical Connections
1. System Overview (power and signal)
5V/2A ADAPTER
      │
┌─────┴─────┐
5V rail   GND rail (common to everything)
  │
  ├──────────┬───────────────┐
  │          │               │
ESP32-S3    UNO             LCD
(5V pin)   (5V pin)        (VCC)
  │
3.3V pin ──► 3.3V rail ──► 8× hall modules, 2× 4.7kΩ I2C pull-ups

ESP32 ◄──GPIO───── 8 hall sensors, 3 buttons
ESP32 ◄──I2C────► LCD
ESP32 ◄──serial──► UNO ──► 8 LEDs + buzzer
2. Power Rails
Rail
Source
Feeds
5V
Adapter + ESP32-S3 5V pin, UNO 5V pin, LCD VCC
ESP32, UNO, LCD
3.3V
ESP32-S3 3.3V pin
8 hall module VCC pins, 2× 4.7kΩ I2C pull-ups
GND
Adapter −
ESP32, UNO, all hall modules, LCD, all LEDs, buzzer, all buttons

3. Per-Slot Wiring (the core table)
Slot
Hall S → ESP32 GPIO
UNO pin
LED path
1
GPIO 4
D2
D2 → 220Ω → LED anode; cathode → GND
2
GPIO 5
D3
D3 → 220Ω → LED anode; cathode → GND
3
GPIO 6
D4
D4 → 220Ω → LED anode; cathode → GND
4
GPIO 7
D5
D5 → 220Ω → LED anode; cathode → GND
5
GPIO 15
D6
D6 → 220Ω → LED anode; cathode → GND
6
GPIO 16
D7
D7 → 220Ω → LED anode; cathode → GND
7
GPIO 17
D8
D8 → 220Ω → LED anode; cathode → GND
8
GPIO 18
D9
D9 → 220Ω → LED anode; cathode → GND

Each hall module also needs VCC → 3.3V rail and GND → GND rail. Check the silkscreen for pin order, since it varies between batches. Use twisted pairs for sensor leads.
4. Hall Sensor Module Pins (repeat ×8)
KY-003 pin
Connects to
VCC
3.3V rail
GND
GND rail
S (signal)
The slot's ESP32 GPIO (section 3), direct wire

Output levels: S is about 3.3V (HIGH) with no magnet near the sensor and close to 0V (LOW) with the magnet near.
S needs a pull-up to 3.3V. The plan uses the ESP32's internal pull-up on each GPIO (enabled in firmware, see Part B).
Bench test: about 3.3V with no magnet, close to 0V with a magnet. The module's onboard LED lights when a magnet is detected.
The A3144 is often rated for about 4.5V minimum. Confirm it switches reliably at 3.3V on the bench, and keep a 3.3V-rated sensor as a fallback.
5. ESP32-S3 Full Pin Map
ESP32-S3 pin
Function
Connects to
GPIO 4
Slot 1 hall input
KY-003 #1 S
GPIO 5
Slot 2 hall input
KY-003 #2 S
GPIO 6
Slot 3 hall input
KY-003 #3 S
GPIO 7
Slot 4 hall input
KY-003 #4 S
GPIO 15
Slot 5 hall input
KY-003 #5 S
GPIO 16
Slot 6 hall input
KY-003 #6 S
GPIO 17
Slot 7 hall input
KY-003 #7 S
GPIO 18
Slot 8 hall input
KY-003 #8 S
GPIO 8
I2C SDA6
LCD SDA (+ 4.7kΩ to 3.3V)
GPIO 9
I2C SCL
LCD SCL (+ 4.7kΩ to 3.3V)
GPIO 10
NEXT button input
Button → GND
GPIO 11
PREV button input
Button → GND
GPIO 12
MODE/SELECT button input
Button → GND
GPIO 13
Serial1 TX
UNO D11 (direct)
GPIO 14
Serial1 RX
Divider node from UNO D12
5V
Power in
5V rail
3.3V
Power out
3.3V rail
GND
Ground
GND rail

Avoid: 0, 3, 45, 46, 19, 20, 26-37, 43, 44, and the onboard RGB LED pin (48 or 38).
6. Arduino UNO Full Pin Map
UNO pin
Function
Connects to
D2 to D9
Slot LEDs 1-8
Each through 220Ω to LED anode (section 3)
D10
Buzzer
Active buzzer + (buzzer − to GND)
D11
Serial RX (SoftwareSerial)
ESP32 GPIO 13 (direct)
D12
Serial TX (SoftwareSerial)
1kΩ → divider node → ESP32 GPIO 14
5V
Power in
5V rail
GND
Ground
GND rail

7. ESP32 ↔ UNO Serial Link
Signal
Path
ESP32 → UNO
ESP32 GPIO 13 → UNO D11 (direct wire)
UNO → ESP32
UNO D12 → 1kΩ → node → ESP32 GPIO 14
Divider bottom
node → 2kΩ → GND
Ground
ESP32 GND ↔ UNO GND


UNO D12 ──[1kΩ]──┬── ESP32 GPIO 14
                 │
               [2kΩ]
                 │
                GND
The divider is required, since it brings the UNO's 5V signal down to about 3.3V.
8. LCD (I2C)
LCD backpack pin
Connects to
VCC
5V rail (use 3.3V if the display is unreliable)
GND
GND rail
SDA
ESP32 GPIO 8, plus 4.7kΩ from SDA to 3.3V rail
SCL
ESP32 GPIO 9, plus 4.7kΩ from SCL to 3.3V rail

Remove the backpack's own SDA/SCL pull-up resistors (or their solder jumpers) so 5V stays off the S3.
The I2C address is 0x27 or 0x3F, depending on the backpack.
9. Buttons
Button
ESP32 GPIO
Other leg
NEXT
GPIO 10
GND
PREV
GPIO 11
GND
MODE/SELECT
GPIO 12
GND

All three are wired GPIO to GND. They rely on the ESP32's internal pull-ups (enabled in firmware, see Part B).
10. Voltage-Level Safety Check
Signal
Why it's safe
Hall S outputs
Modules powered from 3.3V, so S never exceeds 3.3V
I2C lines
Pulled up to 3.3V, backpack pull-ups removed
UNO TX → ESP32 RX
Divided by 1kΩ/2kΩ
ESP32 TX → UNO RX
Direct, since 3.3V reads as HIGH on the UNO
Buttons
Connect to GND only

11. Power and Flashing Rules
Don't power the ESP32 from the adapter and USB at the same time. Unplug the ESP32's 5V feed from the rail while flashing, unless your board has a power-OR diode.
Flash and read logs through the UART USB-C port.
Use an adapter rather than a power bank, since some banks shut off at low load.
Keep power leads short and avoid thin cables. Random resets or Wi-Fi drops are the warning sign of a weak supply.
Estimated peak draw on the 5V rail is about 1A.
