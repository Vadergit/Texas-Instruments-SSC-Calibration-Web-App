# PGA300 OWI – experimenteller Laboradapter v0.3.0
Referenz: [TI SLDS204D](https://www.ti.com/lit/ds/symlink/pga300.pdf), §§6.4–6.5, 7.2–7.4. Die Elektronik ist nicht mit dem ELMOS-PLC-Adapter austauschbar.

## Hardware
ESP32-C3 SuperMini mit Arduino ESP32-Core, USB CDC on boot aktiv. GPIO4 TX -> Spannungsmodulator, GPIO5 RX <- Stromdemodulator (3.3-V-Logik, idle high, ohne TX-Echo), GPIO6 ACT -> Aktivierungsstufe. Gemeinsame Masse, strombegrenzte Versorgung. **GPIO nie direkt an PWR anschliessen.** Ein externer analoger OWI-Transceiver muss die Spannungspegel und Stromantwort gemäss TI-Datenblatt realisieren. Aktivierung oberhalb 5.95 V, Datenpegel entsprechend TI, Stromantwort als logische UART-Pegel. Die Firmware wählt experimentell 38.4 kBaud 8N1; vor Verwendung mit Oszilloskop überprüfen (Timing, Pegel, Echo, Flanken, Stromreserve). Keine Schaltung oder PCB validiert. Keine fertige Firmware-Binärdatei; Sketch muss kompiliert und geflasht werden.

## Ablauf
- Chrome/Edge, HTTPS, USB verbinden. Konfigurationsmodus verändert den Analogausgang.
- EEPROM 128 Byte vollständig lesen, Host-/Chip-CRC vergleichen, .bin-Backup sichern. Seriennummer ist kundendefiniert, keine eindeutige unveränderliche UID.
- AFE im Konfigurationsmodus einstellen und rücklesen. Brücke wird explizit eingeschaltet. Hardwaremesspunkte erfassen, Modell prüfen.
- Linearer Spezialfall: TI Gleichung 5, h0=Offset/4, g0=Gain*16384, Druck-Digitalgain 1, Offset 0. Sonstige TC/NL-Koeffizienten null. Zielimage aus Original erzeugen, Grenzen und AFE übernehmen, reservierte Bytes erhalten. Quantisierungsabweichung prüfen.
- Experimentelles Schreiben nur mit expliziter Texteingabe. Erneutes vollständiges Lesen, Vergleich mit Original, CRC-Übereinstimmung, Seitenauswahl, Cache-Readback, Erase-and-Program, Busy-Polling, Seiten-Readback, vollständiger Readback/Chip-CRC. Bei Fehler stoppen, Backup und Stromversorgung erhalten; keine automatische Wiederholung.
- Execution-Modus und Kaltstart, analogen Ausgang extern prüfen. Kein Produktionsbetrieb. TC/NL-Festkomma-Kodierung, TI-EVM-Protokoll, automatische AFE-Optimierung, Hardware-DAC-Kalibrierung und sichere Wiederherstellung nach Stromausfall sind noch offen.

## Bridge v1
USB CDC 115200, zeilenweise ID + Kommando. HELLO, ACT, R page address, W page address value (Hex). Antwort ID OK [payload] oder ID ERR Grund. ESP32 führt TI-OWI-Frames lokal aus; Browser-Timing wird nicht für Bit-Banging verwendet. Registerantwort ist nicht kryptografisch oder per Frame-CRC abgesichert; EEPROM-CRC und Rücklesungen sind zusätzliche Kontrollen. Hardwaretests fehlen.
