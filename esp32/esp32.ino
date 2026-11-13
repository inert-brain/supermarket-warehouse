// Target: ESP32-S3 with the Espressif Arduino core, ArduinoJson 7, and hd44780.
// Generic compile target: esp32:esp32:esp32s3; verify board-specific pins/USB/flash before upload.
#include <stddef.h>
#include <stdint.h>
#include <time.h>
#include <stdio.h>
#include <string.h>

// EDIT SETTINGS HERE. This sketch needs no project headers or config.h.
// Keep real Wi-Fi credentials out of Git and shared copies of this file.
constexpr char RACK_WIFI_SSID[] = "PLM_WIFI_2.4";
constexpr char RACK_WIFI_PASSWORD[] = "PLMh@ribon";  // Empty is allowed for an open test network.
constexpr char RACK_FIREBASE_API_KEY[] = "AIzaSyAUaPCap80W1HiUiAj6QROvEFMLwuXUTFs";  // Public web API key, never a service-account key.
constexpr char RACK_FIREBASE_APP_ID[] = "1:620426609195:web:8120d4be0bb9f9cc0fe06e";   // Same app ID as the phone's Firebase app.
constexpr char RACK_PROJECT[] = "mart-parking-fdd6b";
constexpr char RACK_REGION[] = "asia-southeast1";
constexpr char RACK_SERVICE[] = "smart-supermarket-service";
constexpr char RACK_CONNECTOR[] = "example";


// REQUIRED: paste actual trusted root PEM(s) from https://pki.goog/repository/.
// Verify the endpoint chain; use roots, not a short-lived server/leaf cert.
// Replace "" with a raw string containing the actual PEM(s), for example:
// R"PEM(-----BEGIN CERTIFICATE-----
// ... actual base64 certificate from the trusted source ...
// -----END CERTIFICATE-----
// )PEM";
constexpr char RACK_ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlrsWNBCUaqxElqjANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjIwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjIwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQDO3v2m++zsFDQ8BwZabFn3GTXd98GdVarTzTukk3LvCvpt
nfbwhYBboUhSnznFt+4orO/LdmgUud+tAWyZH8QiHZ/+cnfgLFuv5AS/T3KgGjSY
6Dlo7JUle3ah5mm5hRm9iYz+re026nO8/4Piy33B0s5Ks40FnotJk9/BW9BuXvAu
MC6C/Pq8tBcKSOWIm8Wba96wyrQD8Nr0kLhlZPdcTK3ofmZemde4wj7I0BOdre7k
RXuJVfeKH2JShBKzwkCX44ofR5GmdFrS+LFjKBC4swm4VndAoiaYecb+3yXuPuWg
f9RhD1FLPD+M2uFwdNjCaKH5wQzpoeJ/u1U8dgbuak7MkogwTZq9TwtImoS1mKPV
+3PBV2HdKFZ1E66HjucMUQkQdYhMvI35ezzUIkgfKtzra7tEscszcTJGr61K8Yzo
dDqs5xoic4DSMPclQsciOzsSrZYuxsN2B6ogtzVJV+mSSeh2FnIxZyuWfoqjx5RW
Ir9qS34BIbIjMt/kmkRtWVtd9QCgHJvGeJeNkP+byKq0rxFROV7Z+2et1VsRnTKa
G73VululycslaVNVJ1zgyjbLiGH7HrfQy+4W+9OmTN6SpdTi3/UGVN4unUu0kzCq
gc7dGtxRcw1PcOnlthYhGXmy5okLdWTK1au8CcEYof/UVKGFPP0UJAOyh9OktwID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQUu//KjiOfT5nK2+JopqUVJxce2Q4wDQYJKoZIhvcNAQEMBQADggIBAB/Kzt3H
vqGf2SdMC9wXmBFqiN495nFWcrKeGk6c1SuYJF2ba3uwM4IJvd8lRuqYnrYb/oM8
0mJhwQTtzuDFycgTE1XnqGOtjHsB/ncw4c5omwX4Eu55MaBBRTUoCnGkJE+M3DyC
B19m3H0Q/gxhswWV7uGugQ+o+MePTagjAiZrHYNSVc61LwDKgEDg4XSsYPWHgJ2u
NmSRXbBoGOqKYcl3qJfEycel/FVL8/B/uWU9J2jQzGv6U53hkRrJXRqWbTKH7QMg
yALOWr7Z6v2yTcQvG99fevX4i8buMTolUVVnjWQye+mew4K6Ki3pHrTgSAai/Gev
HyICc/sgCq+dVEuhzf9gR7A/Xe8bVr2XIZYtCtFenTgCR2y59PYjJbigapordwj6
xLEokCZYCDzifqrXPW+6MYgKBesntaFJ7qBFVHvmJ2WZICGoo7z7GJa7Um8M7YNR
TOlZ4iBgxcJlkoKM8xAfDoqXvneCbT+PHV28SSe9zE8P4c52hgQjxcCMElv924Sg
JPFI/2R80L5cFtHvma3AH/vLrrw4IgYmZNralw4/KBVEqE8AyvCazM90arQ+POuV
7LXTWtiBmelDGDfrs7vRWGJB82bSj6p4lVQgw1oudCvV0b4YacCs1aTPObpRhANl
6WLAYv7YTVWW4tAR+kg0Eeye7QUd5MjWHYbL
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPluILrIPglJ209ZjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjMwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjMwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AAQfTzOHMymKoYTey8chWEGJ6ladK0uFxh1MJ7x/JlFyb+Kf1qPKzEUURout736G
jOyxfi//qXGdGIRFBEFVbivqJn+7kAHjSxm65FSWRQmx1WyRRK2EE46ajA2ADDL2
4CejQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBTB8Sa6oC2uhYHP0/EqEr24Cmf9vDAKBggqhkjOPQQDAwNpADBmAjEA9uEglRR7
VKOQFhG/hMjqb2sXnh5GmCCbn9MN2azTL818+FsuVbu/3ZL3pAzcMeGiAjEA/Jdm
ZuVDFhOD3cffL74UOO0BzrEXGhF16b0DjyZ+hOXJYKaV11RZt+cRLInUue4X
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIB3DCCAYOgAwIBAgINAgPlfvU/k/2lCSGypjAKBggqhkjOPQQDAjBQMSQwIgYD
VQQLExtHbG9iYWxTaWduIEVDQyBSb290IENBIC0gUjQxEzARBgNVBAoTCkdsb2Jh
bFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMTIxMTEzMDAwMDAwWhcNMzgw
MTE5MDMxNDA3WjBQMSQwIgYDVQQLExtHbG9iYWxTaWduIEVDQyBSb290IENBIC0g
UjQxEzARBgNVBAoTCkdsb2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wWTAT
BgcqhkjOPQIBBggqhkjOPQMBBwNCAAS4xnnTj2wlDp8uORkcA6SumuU5BwkWymOx
uYb4ilfBV85C+nOh92VC/x7BALJucw7/xyHlGKSq2XE/qNS5zowdo0IwQDAOBgNV
HQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUVLB7rUW44kB/
+wpu+74zyTyjhNUwCgYIKoZIzj0EAwIDRwAwRAIgIk90crlgr/HmnKAWBVBfw147
bmF0774BxL4YSFlhgjICICadVGNA3jdgUM/I2O2dgq43mLyjj0xMqTQrbO/7lZsm
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIDljCCAn6gAwIBAgIQC5McOtY5Z+pnI7/Dr5r0SzANBgkqhkiG9w0BAQsFADBl
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSQwIgYDVQQDExtEaWdpQ2VydCBBc3N1cmVkIElEIFJv
b3QgRzIwHhcNMTMwODAxMTIwMDAwWhcNMzgwMTE1MTIwMDAwWjBlMQswCQYDVQQG
EwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNl
cnQuY29tMSQwIgYDVQQDExtEaWdpQ2VydCBBc3N1cmVkIElEIFJvb3QgRzIwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDZ5ygvUj82ckmIkzTz+GoeMVSA
n61UQbVH35ao1K+ALbkKz3X9iaV9JPrjIgwrvJUXCzO/GU1BBpAAvQxNEP4Htecc
biJVMWWXvdMX0h5i89vqbFCMP4QMls+3ywPgym2hFEwbid3tALBSfK+RbLE4E9Hp
EgjAALAcKxHad3A2m67OeYfcgnDmCXRwVWmvo2ifv922ebPynXApVfSr/5Vh88lA
bx3RvpO704gqu52/clpWcTs/1PPRCv4o76Pu2ZmvA9OPYLfykqGxvYmJHzDNw6Yu
YjOuFgJ3RFrngQo8p0Quebg/BLxcoIfhG69Rjs3sLPr4/m3wOnyqi+RnlTGNAgMB
AAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQW
BBTOw0q5mVXyuNtgv6l+vVa1lzan1jANBgkqhkiG9w0BAQsFAAOCAQEAyqVVjOPI
QW5pJ6d1Ee88hjZv0p3GeDgdaZaikmkuOGybfQTUiaWxMTeKySHMq2zNixya1r9I
0jJmwYrA8y8678Dj1JGG0VDjA9tzd29KOVPt3ibHtX2vK0LRdWLjSisCx1BL4Gni
lmwORGYQRI+tBev4eaymG+g3NJ1TyWGqolKvSnAWhsI6yLETcDbYz+70CjTVW0z9
B5yiutkBclzzTcHdDrEcDcRjvq30FPuJ7KJBDkzMyFdA0G4Dqs0MjomZmWzwPDCv
ON9vvKO+KSAnq3T/EyJ43pdSVR6DtVQgA+6uwE9W3jfMw3+qBCe703e4YtsXfJwo
IhNzbM8m9Yop5w==
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICRjCCAc2gAwIBAgIQC6Fa+h3foLVJRK/NJKBs7DAKBggqhkjOPQQDAzBlMQsw
CQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cu
ZGlnaWNlcnQuY29tMSQwIgYDVQQDExtEaWdpQ2VydCBBc3N1cmVkIElEIFJvb3Qg
RzMwHhcNMTMwODAxMTIwMDAwWhcNMzgwMTE1MTIwMDAwWjBlMQswCQYDVQQGEwJV
UzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQu
Y29tMSQwIgYDVQQDExtEaWdpQ2VydCBBc3N1cmVkIElEIFJvb3QgRzMwdjAQBgcq
hkjOPQIBBgUrgQQAIgNiAAQZ57ysRGXtzbg/WPuNsVepRC0FFfLvC/8QdJ+1YlJf
Zn4f5dwbRXkLzMZTCp2NXQLZqVneAlr2lSoOjThKiknGvMYDOAdfVdp+CW7if17Q
RSAPWXYQ1qAk8C3eNvJsKTmjQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/
BAQDAgGGMB0GA1UdDgQWBBTL0L2p4ZgFUaFNN6KDec6NHSrkhDAKBggqhkjOPQQD
AwNnADBkAjAlpIFFAmsSS3V0T8gj43DydXLefInwz5FyYZ5eEJJZVrmDxxDnOOlY
JjZ91eQ0hjkCMHw2U/Aw5WJjOpnitqM7mzT6HtoQknFekROn3aRukswy1vUhZscv
6pZjamVFkpUBtA==
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICPzCCAcWgAwIBAgIQBVVWvPJepDU1w6QP1atFcjAKBggqhkjOPQQDAzBhMQsw
CQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cu
ZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBHMzAe
Fw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVTMRUw
EwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5jb20x
IDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEczMHYwEAYHKoZIzj0CAQYF
K4EEACIDYgAE3afZu4q4C/sLfyHS8L6+c/MzXRq8NOrexpu80JX28MzQC7phW1FG
fp4tn+6OYwwX7Adw9c+ELkCDnOg/QW07rdOkFFk2eJ0DQ+4QE2xy3q6Ip6FrtUPO
Z9wj/wMco+I+o0IwQDAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAd
BgNVHQ4EFgQUs9tIpPmhxdiuNkHMEWNpYim8S8YwCgYIKoZIzj0EAwMDaAAwZQIx
AK288mw/EkrRLTnDCgmXc/SINoyIJ7vmiI1Qhadj+Z4y3maTD/HMsQmP3Wyr+mt/
oAIwOWZbwmSNuJ5Q3KjVSaLtx9zRSX8XAbjIho9OjIgrqJqpisXRAL34VOKa5Vt8
sycX
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIFkDCCA3igAwIBAgIQBZsbV56OITLiOQe9p3d1XDANBgkqhkiG9w0BAQwFADBi
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3Qg
RzQwHhcNMTMwODAxMTIwMDAwWhcNMzgwMTE1MTIwMDAwWjBiMQswCQYDVQQGEwJV
UzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQu
Y29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3QgRzQwggIiMA0GCSqG
SIb3DQEBAQUAA4ICDwAwggIKAoICAQC/5pBzaN675F1KPDAiMGkz7MKnJS7JIT3y
ithZwuEppz1Yq3aaza57G4QNxDAf8xukOBbrVsaXbR2rsnnyyhHS5F/WBTxSD1If
xp4VpX6+n6lXFllVcq9ok3DCsrp1mWpzMpTREEQQLt+C8weE5nQ7bXHiLQwb7iDV
ySAdYyktzuxeTsiT+CFhmzTrBcZe7FsavOvJz82sNEBfsXpm7nfISKhmV1efVFiO
DCu3T6cw2Vbuyntd463JT17lNecxy9qTXtyOj4DatpGYQJB5w3jHtrHEtWoYOAMQ
jdjUN6QuBX2I9YI+EJFwq1WCQTLX2wRzKm6RAXwhTNS8rhsDdV14Ztk6MUSaM0C/
CNdaSaTC5qmgZ92kJ7yhTzm1EVgX9yRcRo9k98FpiHaYdj1ZXUJ2h4mXaXpI8OCi
EhtmmnTK3kse5w5jrubU75KSOp493ADkRSWJtppEGSt+wJS00mFt6zPZxd9LBADM
fRyVw4/3IbKyEbe7f/LVjHAsQWCqsWMYRJUadmJ+9oCw++hkpjPRiQfhvbfmQ6QY
uKZ3AeEPlAwhHbJUKSWJbOUOUlFHdL4mrLZBdd56rF+NP8m800ERElvlEFDrMcXK
chYiCd98THU/Y+whX8QgUWtvsauGi0/C1kVfnSD8oR7FwI+isX4KJpn15GkvmB0t
9dmpsh3lGwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIB
hjAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5nP+e6mK4cD08wDQYJKoZIhvcNAQEMBQAD
ggIBALth2X2pbL4XxJEbw6GiAI3jZGgPVs93rnD5/ZpKmbnJeFwMDF/k5hQpVgs2
SV1EY+CtnJYYZhsjDT156W1r1lT40jzBQ0CuHVD1UvyQO7uYmWlrx8GnqGikJ9yd
+SeuMIW59mdNOj6PWTkiU0TryF0Dyu1Qen1iIQqAyHNm0aAFYF/opbSnr6j3bTWc
fFqK1qI4mfN4i/RN0iAL3gTujJtHgXINwBQy7zBZLq7gcfJW5GqXb5JQbZaNaHqa
sjYUegbyJLkJEVDXCLG4iXqEI2FCKeWjzaIgQdfRnGTZ6iahixTXTBmyUEFxPT9N
cCOGDErcgdLMMpSEDQgJlxxPwO5rIHQw0uA5NBCFIRUBCOhVMt5xSdkoF1BN5r5N
0XWs0Mr7QbhDparTwwVETyw2m+L64kW4I1NsBm9nVX9GtUw/bihaeSbSpKhil9Ie
4u1Ki7wb/UdKDd9nZn6yW0HQO+T0O/QEY+nvwlQAUaCKKsnOeMzV6ocEGLPOr0mI
r/OSmbaz5mEP0oUA51Aa5BuVnRmhuZyxm7EAHu/QD09CbMkKvO5D+jpxpchNJqU1
/YldvIViHTLSoCtU7ZpXwdv6EM8Zt4tKG48BtieVU+i2iW1bvGjUI+iLUaJW+fCm
gKDWHrO8Dw9TdSmq6hN35N6MgSGtBxBHEa2HPQfRdbzP82Z+
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIDXzCCAkegAwIBAgILBAAAAAABIVhTCKIwDQYJKoZIhvcNAQELBQAwTDEgMB4G
A1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjMxEzARBgNVBAoTCkdsb2JhbFNp
Z24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMDkwMzE4MTAwMDAwWhcNMjkwMzE4
MTAwMDAwWjBMMSAwHgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMzETMBEG
A1UEChMKR2xvYmFsU2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjCCASIwDQYJKoZI
hvcNAQEBBQADggEPADCCAQoCggEBAMwldpB5BngiFvXAg7aEyiie/QV2EcWtiHL8
RgJDx7KKnQRfJMsuS+FggkbhUqsMgUdwbN1k0ev1LKMPgj0MK66X17YUhhB5uzsT
gHeMCOFJ0mpiLx9e+pZo34knlTifBtc+ycsmWQ1z3rDI6SYOgxXG71uL0gRgykmm
KPZpO/bLyCiR5Z2KYVc3rHQU3HTgOu5yLy6c+9C7v/U9AOEGM+iCK65TpjoWc4zd
QQ4gOsC0p6Hpsk+QLjJg6VfLuQSSaGjlOCZgdbKfd/+RFO+uIEn8rUAVSNECMWEZ
XriX7613t2Saer9fwRPvm2L7DWzgVGkWqQPabumDk3F2xmmFghcCAwEAAaNCMEAw
DgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFI/wS3+o
LkUkrk1Q+mOai97i3Ru8MA0GCSqGSIb3DQEBCwUAA4IBAQBLQNvAUKr+yAzv95ZU
RUm7lgAJQayzE4aGKAczymvmdLm6AC2upArT9fHxD4q/c2dKg8dEe3jgr25sbwMp
jjM5RcOO5LlXbKr8EpbsU8Yt5CRsuZRj+9xTaGdWPoO4zzUhw8lo/s7awlOqzJCK
6fBdRoyV3XpYKBovHd7NADdBj+1EbddTKJd+82cEHhXXipa0095MJ6RMG3NzdvQX
mcIfeg7jLQitChws/zyrVQ4PkX4268NXSb7hLi18YIvDQVETI53O9zJrlAGomecs
Mx86OyXShkDOOyyGeMlhLxS67ttVb9+E7gUJTb0o2HLO02JQZR7rkpeDMdmztcpH
WD9f
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICHjCCAaSgAwIBAgIRYFlJ4CYuu1X5CneKcflK2GwwCgYIKoZIzj0EAwMwUDEk
MCIGA1UECxMbR2xvYmFsU2lnbiBFQ0MgUm9vdCBDQSAtIFI1MRMwEQYDVQQKEwpH
bG9iYWxTaWduMRMwEQYDVQQDEwpHbG9iYWxTaWduMB4XDTEyMTExMzAwMDAwMFoX
DTM4MDExOTAzMTQwN1owUDEkMCIGA1UECxMbR2xvYmFsU2lnbiBFQ0MgUm9vdCBD
QSAtIFI1MRMwEQYDVQQKEwpHbG9iYWxTaWduMRMwEQYDVQQDEwpHbG9iYWxTaWdu
MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAER0UOlvt9Xb/pOdEh+J8LttV7HpI6SFkc
8GIxLcB6KP4ap1yztsyX50XUWPrRd21DosCHZTQKH3rd6zwzocWdTaRvQZU4f8ke
hOvRnkmSh5SHDDqFSmafnVmTTZdhBoZKo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYD
VR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUPeYpSJvqB8ohREom3m7e0oPQn1kwCgYI
KoZIzj0EAwMDaAAwZQIxAOVpEslu28YxuglB4Zf4+/2a4n0Sye18ZNPLBSWLVtmg
515dTguDnFt2KaAJJiFqYgIwcdK1j1zqO+F4CYWodZI7yFz9SO8NdCKoCOJuxUnO
xwy8p2Fp8fc74SrL+SvzZpA3
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIFgzCCA2ugAwIBAgIORea7A4Mzw4VlSOb/RVEwDQYJKoZIhvcNAQEMBQAwTDEg
MB4GA1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjYxEzARBgNVBAoTCkdsb2Jh
bFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMTQxMjEwMDAwMDAwWhcNMzQx
MjEwMDAwMDAwWjBMMSAwHgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSNjET
MBEGA1UEChMKR2xvYmFsU2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjCCAiIwDQYJ
KoZIhvcNAQEBBQADggIPADCCAgoCggIBAJUH6HPKZvnsFMp7PPcNCPG0RQssgrRI
xutbPK6DuEGSMxSkb3/pKszGsIhrxbaJ0cay/xTOURQh7ErdG1rG1ofuTToVBu1k
ZguSgMpE3nOUTvOniX9PeGMIyBJQbUJmL025eShNUhqKGoC3GYEOfsSKvGRMIRxD
aNc9PIrFsmbVkJq3MQbFvuJtMgamHvm566qjuL++gmNQ0PAYid/kD3n16qIfKtJw
LnvnvJO7bVPiSHyMEAc4/2ayd2F+4OqMPKq0pPbzlUoSB239jLKJz9CgYXfIWHSw
1CM69106yqLbnQneXUQtkPGBzVeS+n68UARjNN9rkxi+azayOeSsJDa38O+2HBNX
k7besvjihbdzorg1qkXy4J02oW9UivFyVm4uiMVRQkQVlO6jxTiWm05OWgtH8wY2
SXcwvHE35absIQh1/OZhFj931dmRl4QKbNQCTXTAFO39OfuD8l4UoQSwC+n+7o/h
bguyCLNhZglqsQY6ZZZZwPA1/cnaKI0aEYdwgQqomnUdnjqGBQCe24DWJfncBZ4n
WUx2OVvq+aWh2IMP0f/fMBH5hc8zSPXKbWQULHpYT9NLCEnFlWQaYw55PfWzjMpY
rZxCRXluDocZXFSxZba/jJvcE+kNb7gu3GduyYsRtYQUigAZcIN5kZeR1Bonvzce
MgfYFGM8KEyvAgMBAAGjYzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTAD
AQH/MB0GA1UdDgQWBBSubAWjkxPioufi1xzWx/B/yGdToDAfBgNVHSMEGDAWgBSu
bAWjkxPioufi1xzWx/B/yGdToDANBgkqhkiG9w0BAQwFAAOCAgEAgyXt6NH9lVLN
nsAEoJFp5lzQhN7craJP6Ed41mWYqVuoPId8AorRbrcWc+ZfwFSY1XS+wc3iEZGt
Ixg93eFyRJa0lV7Ae46ZeBZDE1ZXs6KzO7V33EByrKPrmzU+sQghoefEQzd5Mr61
55wsTLxDKZmOMNOsIeDjHfrYBzN2VAAiKrlNIC5waNrlU/yDXNOd8v9EDERm8tLj
vUYAGm0CuiVdjaExUd1URhxN25mW7xocBFymFe944Hn+Xds+qkxV/ZoVqW/hpvvf
cDDpw+5CRu3CkwWJ+n1jez/QcYF8AOiYrg54NMMl+68KnyBr3TsTjxKM4kEaSHpz
oHdpx7Zcf4LIHv5YGygrqGytXm3ABdJ7t+uA/iU3/gKbaKxCXcPu9czc8FB10jZp
nOZ7BN9uBmm23goJSFmH63sUYHpkqmlD75HHTOwY3WzvUy2MmeFe8nI+z1TIvWfs
pA9MRf/TuTAjB0yPEL+GltmZWrSZVxykzLsViVO6LAUP5MSeGbEYNNVMnbrt9x+v
JJUEeKgDu+6B5dpffItKoZB0JaezPkvILFa9x8jvOOJckvB595yEunQtYQEgfn7R
8k8HWV+LLUNS60YMlOH1Zkd5d9VUWx+tJDfLRVpOoERIyNiwmcUVhAn21klJwGW4
5hpxbqCo8YLoRT5s1gLXCmeDBVrJpBA=
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIDxTCCAq2gAwIBAgIBADANBgkqhkiG9w0BAQsFADCBgzELMAkGA1UEBhMCVVMx
EDAOBgNVBAgTB0FyaXpvbmExEzARBgNVBAcTClNjb3R0c2RhbGUxGjAYBgNVBAoT
EUdvRGFkZHkuY29tLCBJbmMuMTEwLwYDVQQDEyhHbyBEYWRkeSBSb290IENlcnRp
ZmljYXRlIEF1dGhvcml0eSAtIEcyMB4XDTA5MDkwMTAwMDAwMFoXDTM3MTIzMTIz
NTk1OVowgYMxCzAJBgNVBAYTAlVTMRAwDgYDVQQIEwdBcml6b25hMRMwEQYDVQQH
EwpTY290dHNkYWxlMRowGAYDVQQKExFHb0RhZGR5LmNvbSwgSW5jLjExMC8GA1UE
AxMoR28gRGFkZHkgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgLSBHMjCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL9xYgjx+lk09xvJGKP3gElY6SKD
E6bFIEMBO4Tx5oVJnyfq9oQbTqC023CYxzIBsQU+B07u9PpPL1kwIuerGVZr4oAH
/PMWdYA5UXvl+TW2dE6pjYIT5LY/qQOD+qK+ihVqf94Lw7YZFAXK6sOoBJQ7Rnwy
DfMAZiLIjWltNowRGLfTshxgtDj6AozO091GB94KPutdfMh8+7ArU6SSYmlRJQVh
GkSBjCypQ5Yj36w6gZoOKcUcqeldHraenjAKOc7xiID7S13MMuyFYkMlNAJWJwGR
tDtwKj9useiciAF9n9T521NtYJ2/LOdYq7hfRvzOxBsDPAnrSTFcaUaz4EcCAwEA
AaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYE
FDqahQcQZyi27/a9BUFuIMGU2g/eMA0GCSqGSIb3DQEBCwUAA4IBAQCZ21151fmX
WWcDYfF+OwYxdS2hII5PZYe096acvNjpL9DbWu7PdIxztDhC2gV7+AJ1uP2lsdeu
9tfeE8tTEH6KRtGX+rcuKxGrkLAngPnon1rpN5+r5N9ss4UXnT3ZJE95kTXWXwTr
gIOrmgIttRD02JDHBHNA7XIloKmf7J6raBKZV8aPEjoJpL1E/QYVN8Gb5DKj7Tjo
2GTzLH4U/ALqn83/B2gX2yKQOC16jdFU8WnjXzPKej17CuPKf1855eJ1usV2GDPO
LPAvTK33sefOT6jEm0pUBsV/fdUID+Ic/n4XuKxe9tQWskMJDE32p2u0mYRlynqI
4uJEvlz36hz1
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIID3TCCAsWgAwIBAgIBADANBgkqhkiG9w0BAQsFADCBjzELMAkGA1UEBhMCVVMx
EDAOBgNVBAgTB0FyaXpvbmExEzARBgNVBAcTClNjb3R0c2RhbGUxJTAjBgNVBAoT
HFN0YXJmaWVsZCBUZWNobm9sb2dpZXMsIEluYy4xMjAwBgNVBAMTKVN0YXJmaWVs
ZCBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAtIEcyMB4XDTA5MDkwMTAwMDAw
MFoXDTM3MTIzMTIzNTk1OVowgY8xCzAJBgNVBAYTAlVTMRAwDgYDVQQIEwdBcml6
b25hMRMwEQYDVQQHEwpTY290dHNkYWxlMSUwIwYDVQQKExxTdGFyZmllbGQgVGVj
aG5vbG9naWVzLCBJbmMuMTIwMAYDVQQDEylTdGFyZmllbGQgUm9vdCBDZXJ0aWZp
Y2F0ZSBBdXRob3JpdHkgLSBHMjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBAL3twQP89o/8ArFvW59I2Z154qK3A2FWGMNHttfKPTUuiUP3oWmb3ooa/RMg
nLRJdzIpVv257IzdIvpy3Cdhl+72WoTsbhm5iSzchFvVdPtrX8WJpRBSiUZV9Lh1
HOZ/5FSuS/hVclcCGfgXcVnrHigHdMWdSL5stPSksPNkN3mSwOxGXn/hbVNMYq/N
Hwtjuzqd+/x5AJhhdM8mgkBj87JyahkNmcrUDnXMN/uLicFZ8WJ/X7NfZTD4p7dN
dloedl40wOiWVpmKs/B/pM293DIxfJHP4F8R+GuqSVzRmZTRouNjWwl2tVZi4Ut0
HZbUJtQIBFnQmA4O5t78w+wfkPECAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAO
BgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFHwMMh+n2TB/xH1oo2Kooc6rB1snMA0G
CSqGSIb3DQEBCwUAA4IBAQARWfolTwNvlJk7mh+ChTnUdgWUXuEok21iXQnCoKjU
sHU48TRqneSfioYmUeYs0cYtbpUgSpIB7LiKZ3sx4mcujJUDJi5DnUox9g61DLu3
4jd/IroAow57UvtruzvE03lRTs2Q9GcHGcg8RnoNAX3FWOdt5oUwF5okxBDgBPfg
8n/Uqgr/Qh037ZTlZFkSIHc40zI+OIF1lnP6aI+xy84fxez6nH7PfrHxBy22/L/K
pL/QlwVKvOoYKAKQvVR4CSFx09F9HdkWsKlhPdAKACL8x3vLCWRFCztAgfd9fDL1
mMpYjn0q7pBZc2T5NnReJaH1ZgUufzkVqSr7UIuOhWn0
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICiTCCAg+gAwIBAgIQH0evqmIAcFBUTAGem2OZKjAKBggqhkjOPQQDAzCBhTEL
MAkGA1UEBhMCR0IxGzAZBgNVBAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4GA1UE
BxMHU2FsZm9yZDEaMBgGA1UEChMRQ09NT0RPIENBIExpbWl0ZWQxKzApBgNVBAMT
IkNPTU9ETyBFQ0MgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMDgwMzA2MDAw
MDAwWhcNMzgwMTE4MjM1OTU5WjCBhTELMAkGA1UEBhMCR0IxGzAZBgNVBAgTEkdy
ZWF0ZXIgTWFuY2hlc3RlcjEQMA4GA1UEBxMHU2FsZm9yZDEaMBgGA1UEChMRQ09N
T0RPIENBIExpbWl0ZWQxKzApBgNVBAMTIkNPTU9ETyBFQ0MgQ2VydGlmaWNhdGlv
biBBdXRob3JpdHkwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQDR3svdcmCFYX7deSR
FtSrYpn1PlILBs5BAH+X4QokPB0BBO490o0JlwzgdeT6+3eKKvUDYEs2ixYjFq0J
cfRK9ChQtP6IHG4/bC8vCVlbpVsLM5niwz2J+Wos77LTBumjQjBAMB0GA1UdDgQW
BBR1cacZSBm8nZ3qQUfflMRId5nTeTAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/
BAUwAwEB/zAKBggqhkjOPQQDAwNoADBlAjEA7wNbeqy3eApyt4jf/7VGFAkK+qDm
fQjGGoe9GKhzvSbKYAydzpmfz1wPMOG+FDHqAjAU9JM8SaczepBGR7NjfRObTrdv
GDeAU/7dIOA1mjbRxwG55tzd8/8dLDoWV9mSOdY=
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIF2DCCA8CgAwIBAgIQTKr5yttjb+Af907YWwOGnTANBgkqhkiG9w0BAQwFADCB
hTELMAkGA1UEBhMCR0IxGzAZBgNVBAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4G
A1UEBxMHU2FsZm9yZDEaMBgGA1UEChMRQ09NT0RPIENBIExpbWl0ZWQxKzApBgNV
BAMTIkNPTU9ETyBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTAwMTE5
MDAwMDAwWhcNMzgwMTE4MjM1OTU5WjCBhTELMAkGA1UEBhMCR0IxGzAZBgNVBAgT
EkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4GA1UEBxMHU2FsZm9yZDEaMBgGA1UEChMR
Q09NT0RPIENBIExpbWl0ZWQxKzApBgNVBAMTIkNPTU9ETyBSU0EgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCR
6FSS0gpWsawNJN3Fz0RndJkrN6N9I3AAcbxT38T6KhKPS38QVr2fcHK3YX/JSw8X
pz3jsARh7v8Rl8f0hj4K+j5c+ZPmNHrZFGvnnLOFoIJ6dq9xkNfs/Q36nGz637CC
9BR++b7Epi9Pf5l/tfxnQ3K9DADWietrLNPtj5gcFKt+5eNu/Nio5JIk2kNrYrhV
/erBvGy2i/MOjZrkm2xpmfh4SDBF1a3hDTxFYPwyllEnvGfDyi62a+pGx8cgoLEf
Zd5ICLqkTqnyg0Y3hOvozIFIQ2dOciqbXL1MGyiKXCJ7tKuY2e7gUYPDCUZObT6Z
+pUX2nwzV0E8jVHtC7ZcryxjGt9XyD+86V3Em69FmeKjWiS0uqlWPc9vqv9JWL7w
qP/0uK3pN/u6uPQLOvnoQ0IeidiEyxPx2bvhiWC4jChWrBQdnArncevPDt09qZah
SL0896+1DSJMwBGB7FY79tOi4lu3sgQiUpWAk2nojkxl8ZEDLXB0AuqLZxUpaVIC
u9ffUGpVRr+goyhhf3DQw6KqLCGqR84onAZFdr+CGCe01a60y1Dma/RMhnEw6abf
Fobg2P9A3fvQQoh/ozM6LlweQRGBY84YcWsr7KaKtzFcOmpH4MN5WdYgGq/yapiq
crxXStJLnbsQ/LBMQeXtHT1eKJ2czL+zUdqnR+WEUwIDAQABo0IwQDAdBgNVHQ4E
FgQUu69+Aj36pvE8hI6t7jiY7NkyMtQwDgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB
/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAArx1UaEt65Ru2yyTUEUAJNMnMvl
wFTPoCWOAvn9sKIN9SCYPBMtrFaisNZ+EZLpLrqeLppysb0ZRGxhNaKatBYSaVqM
4dc+pBroLwP0rmEdEBsqpIt6xf4FpuHA1sj+nq6PK7o9mfjYcwlYRm6mnPTXJ9OV
2jeDchzTc+CiR5kDOF3VSXkAKRzH7JsgHAckaVd4sjn8OoSgtZx8jb8uk2Intzna
FxiuvTwJaP+EmzzV1gsD41eeFPfR60/IvYcjt7ZJQ3mFXLrrkguhxuhoqEwWsRqZ
CuhTLJK7oQkYdQxlqHvLI7cawiiFwxv/0Cti76R7CZGYZ4wUAc1oBmpjIXUDgIiK
boHGhfKppC3n9KUkEEeDys30jXlYsQab5xoq2Z0B15R97QNKyvDb6KkBPvVWmcke
jkk9u+UJueBPSZI9FoJAzMxZxuY67RIuaTxslbH9qh17f4a+Hg4yRvv7E491f0yL
S0Zj/gA0QHDBw7mh3aZw4gSzQbzpgJHqZJx64SIDqZxubw5lT2yHh17zbqD5daWb
QOhTsiedSrnAdyGN/4fy3ryM7xfft0kL0fJuMAsaDk527RH89elWsn2/x20Kk4yl
0MC2Hb46TpSi125sC8KKfPog88Tk5c0NqMuRkrF8hey1FGlmDoLnzc7ILaZRfyHB
NVOFBkpdn627G190
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICjzCCAhWgAwIBAgIQXIuZxVqUxdJxVt7NiYDMJjAKBggqhkjOPQQDAzCBiDEL
MAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNl
eSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMT
JVVTRVJUcnVzdCBFQ0MgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTAwMjAx
MDAwMDAwWhcNMzgwMTE4MjM1OTU5WjCBiDELMAkGA1UEBhMCVVMxEzARBgNVBAgT
Ck5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNleSBDaXR5MR4wHAYDVQQKExVUaGUg
VVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMTJVVTRVJUcnVzdCBFQ0MgQ2VydGlm
aWNhdGlvbiBBdXRob3JpdHkwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQarFRaqflo
I+d61SRvU8Za2EurxtW20eZzca7dnNYMYf3boIkDuAUU7FfO7l0/4iGzzvfUinng
o4N+LZfQYcTxmdwlkWOrfzCjtHDix6EznPO/LlxTsV+zfTJ/ijTjeXmjQjBAMB0G
A1UdDgQWBBQ64QmG1M8ZwpZ2dEl23OA1xmNjmjAOBgNVHQ8BAf8EBAMCAQYwDwYD
VR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAwNoADBlAjA2Z6EWCNzklwBBHU6+4WMB
zzuqQhFkoJ2UOQIReVx7Hfpkue4WQrO/isIJxOzksU0CMQDpKmFHjFJKS04YcPbW
RNZu9YO6bVi9JNlWSOrvxKJGgYhqOkbRqZtNyWHa0V1Xahg=
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIF3jCCA8agAwIBAgIQAf1tMPyjylGoG7xkDjUDLTANBgkqhkiG9w0BAQwFADCB
iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl
cnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV
BAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTAw
MjAxMDAwMDAwWhcNMzgwMTE4MjM1OTU5WjCBiDELMAkGA1UEBhMCVVMxEzARBgNV
BAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0plcnNleSBDaXR5MR4wHAYDVQQKExVU
aGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNVBAMTJVVTRVJUcnVzdCBSU0EgQ2Vy
dGlmaWNhdGlvbiBBdXRob3JpdHkwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
AoICAQCAEmUXNg7D2wiz0KxXDXbtzSfTTK1Qg2HiqiBNCS1kCdzOiZ/MPans9s/B
3PHTsdZ7NygRK0faOca8Ohm0X6a9fZ2jY0K2dvKpOyuR+OJv0OwWIJAJPuLodMkY
tJHUYmTbf6MG8YgYapAiPLz+E/CHFHv25B+O1ORRxhFnRghRy4YUVD+8M/5+bJz/
Fp0YvVGONaanZshyZ9shZrHUm3gDwFA66Mzw3LyeTP6vBZY1H1dat//O+T23LLb2
VN3I5xI6Ta5MirdcmrS3ID3KfyI0rn47aGYBROcBTkZTmzNg95S+UzeQc0PzMsNT
79uq/nROacdrjGCT3sTHDN/hMq7MkztReJVni+49Vv4M0GkPGw/zJSZrM233bkf6
c0Plfg6lZrEpfDKEY1WJxA3Bk1QwGROs0303p+tdOmw1XNtB1xLaqUkL39iAigmT
Yo61Zs8liM2EuLE/pDkP2QKe6xJMlXzzawWpXhaDzLhn4ugTncxbgtNMs+1b/97l
c6wjOy0AvzVVdAlJ2ElYGn+SNuZRkg7zJn0cTRe8yexDJtC/QV9AqURE9JnnV4ee
UB9XVKg+/XRjL7FQZQnmWEIuQxpMtPAlR1n6BB6T1CZGSlCBst6+eLf8ZxXhyVeE
Hg9j1uliutZfVS7qXMYoCAQlObgOK6nyTJccBz8NUvXt7y+CDwIDAQABo0IwQDAd
BgNVHQ4EFgQUU3m/WqorSs9UgOHYm8Cd8rIDZsswDgYDVR0PAQH/BAQDAgEGMA8G
A1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAFzUfA3P9wF9QZllDHPF
Up/L+M+ZBn8b2kMVn54CVVeWFPFSPCeHlCjtHzoBN6J2/FNQwISbxmtOuowhT6KO
VWKR82kV2LyI48SqC/3vqOlLVSoGIG1VeCkZ7l8wXEskEVX/JJpuXior7gtNn3/3
ATiUFJVDBwn7YKnuHKsSjKCaXqeYalltiz8I+8jRRa8YFWSQEg9zKC7F4iRO/Fjs
8PRF/iKz6y+O0tlFYQXBl2+odnKPi4w2r78NBc5xjeambx9spnFixdjQg3IM8WcR
iQycE0xyNN+81XHfqnHd4blsjDwSXWXavVcStkNr/+XeTWYRUc+ZruwXtuhxkYze
Sf7dNXGiFSeUHM9h4ya7b6NnJSFd5t0dCy5oGzuCr+yDZ4XUmFF0sbmZgIn/f3gZ
XHlKYC6SQK5MNyosycdiyA5d9zZbyuAlJQG03RoHnHcAP9Dc1ew91Pq7P8yF1m9/
qS3fuQL39ZeatTXaw2ewh0qpKJ4jjv9cJ2vhsE/zB+4ALtRZh8tSQZXq9EfX7mRB
VXyNWQKV3WKdwrnuWih0hKWbt5DHDAff9Yk2dDLWKMGwsAvgnEzDHNb842m1R0aB
L6KCq9NjRHDEjf8tM7qtj3u1cIiuPhnPQCjY/MiQu12ZIvVS5ljFH4gxQ+6IHdfG
jjxDah2nGN59PRbxYvnKkKj9
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIFjzCCA3egAwIBAgIQdq/uiJMVRbZQU5uAnKTfmjANBgkqhkiG9w0BAQsFADBR
MQswCQYDVQQGEwJVUzEYMBYGA1UECgwPU1NMIENvcnBvcmF0aW9uMSgwJgYDVQQD
DB9TU0wuY29tIENsaWVudCBSU0EgUm9vdCBDQSAyMDIyMB4XDTIyMDgyNTE2MzEw
N1oXDTQ2MDgxOTE2MzEwNlowUTELMAkGA1UEBhMCVVMxGDAWBgNVBAoMD1NTTCBD
b3Jwb3JhdGlvbjEoMCYGA1UEAwwfU1NMLmNvbSBDbGllbnQgUlNBIFJvb3QgQ0Eg
MjAyMjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBALhY20Yw+8k/48jw
ATM04tpIqBjpIG6a1wHh1SmPMLQjauTLYrC+4p8gvT5UoDlox4Y3ZnQGBu90K9rc
n4SpUi+Q0u5+fPulIq1vcEZnlj0p1KO7VnsUBFnBIWNEHrIfElyQh2UNiPYeiCLi
Y1S78zb41n/c2v8pNanGbg5pWz/YvoKHFXBdsMdcEg9jpjjNz3O5ww6JJjcbP2Ic
MmnRm9n/VZAx3rFj3c/FdHf874ghU78AMRomLAAwpV9s4+T2AIrKmIecdAN6i2bs
fv2jjzUlXHils6T7PW2pivBsiIKL/UrQb+TXo7SONEk4vs5F5dIcyl7CNxSLzWZW
Mzed5WvsQ5JkoELadW/AFez5ab00uYp7+hb7Vf5SIOgEBFZWZfU3RJjIikbpt6y4
6L5ijlQ2W/c7cL9d7i26X95CGYbwf4vrCMvYvuoOQkKgNnNXF+0y6tCN6Acbm5no
xJpiBA5I9zwSuvdYwZqM6cewIzZWNB3LbNq6B4Qd/dGsn+bCie/DuWwYs2mHV1+1
DDhbpyEkKjunNJGetFTqKE/TwaOL5OYr1fKdv5thACLd1ktEHz9dVv7enHjMmVuq
5L2620NLrUwmTKNNNIpsdDYT22L8m7IFgf+uPwzN9hui9DnnyvVMXPtUdzWAWsAS
oRMBM2c9nYGhqfWFJFiIeOf042hVAgMBAAGjYzBhMA8GA1UdEwEB/wQFMAMBAf8w
HwYDVR0jBBgwFoAU8DhClDSpPAB/Uu45pfdLDbxqfSMwHQYDVR0OBBYEFPA4QpQ0
qTwAf1LuOaX3Sw28an0jMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOC
AgEAmU/b8OrWEfoq/cirbeQOc2LSQp8V/nxwUj9kh4IxP0VALuEinwZmKfyW0y2N
tjjH2fMnwVkpoIz2cyQPKCLXTmHdE93bnzJSk/tPzOo4PJhqA6sWryHRQq59RSvq
xM+KWZ+CcHY6+GImyRCXWEAkpC25LymAJ+GJa3LKSQhxN1MF8YDO00IC0vzC0ZQG
7gfi9oPif5/nu1bDW7/dlZMJHiTBzybNraSuwrRp56q17TeU6d3RY4VrmnpKVnbc
GYUo1OTGpNi4lkF30LRZ8UYFh4cCH2m5ghjQQ9km2hpnqNZ1durybQ5C/4gmom6E
/n5iG/DGPe3AHGrHkda4ADdJm7mEBaHNbjHWROpTi7pTmB2hkIrphfgb8pNYw8jc
miZPPiDPT0PzEIx/EGF6NsqqC33Mn0dEWa6llcaZU+MHaz1JELAY/10OhUMUS+dr
00q1smBh3GlJAiNd6JJxw5yfRWd5HtwyhrqqVTxkbzK1EEAV3nJAeOBucLtu6wno
OdmsupJ13UPKugGVrRqBKzrw48UvDBhNEMauwO3+BVJ/GQXLqa81CAw4IuT+VuVT
Pr/k1rPZCMM91TMygSTFqeFlEbgyMzBxGEkdGkXGmhSKWDkobvPLUblJJmR4A8eR
EYOpuZA0tm+qBZ6FKFeZvn8nBkliTaH8CeErRglMFJtWj0U=
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIICQDCCAcagAwIBAgIQdvhIHq7wPHAf4D8lVAGD1TAKBggqhkjOPQQDAzBRMQsw
CQYDVQQGEwJVUzEYMBYGA1UECgwPU1NMIENvcnBvcmF0aW9uMSgwJgYDVQQDDB9T
U0wuY29tIENsaWVudCBFQ0MgUm9vdCBDQSAyMDIyMB4XDTIyMDgyNTE2MzAzMloX
DTQ2MDgxOTE2MzAzMVowUTELMAkGA1UEBhMCVVMxGDAWBgNVBAoMD1NTTCBDb3Jw
b3JhdGlvbjEoMCYGA1UEAwwfU1NMLmNvbSBDbGllbnQgRUNDIFJvb3QgQ0EgMjAy
MjB2MBAGByqGSM49AgEGBSuBBAAiA2IABC1Tfp+LPrM2ulDizOvcuiaK04wGP2cP
7/UX5dSumkYqQQEHaedncfHCAzbG8CtSjs8UkmikPnBREmmNeKKCyikUwOSUIrJE
kmBvyASkZ9Wi0PPQ1+qOPA+60kBHkDTufaNjMGEwDwYDVR0TAQH/BAUwAwEB/zAf
BgNVHSMEGDAWgBS3/i1ixYFTzVIaL11goMNd+7IcHDAdBgNVHQ4EFgQUt/4tYsWB
U81SGi9dYKDDXfuyHBwwDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMDA2gAMGUC
ME0HES0R+7kmwyHdcuEX/MHPFOpJznGHjtZT3BHNXVSKr9kt9IxR6rxmR+J/lYNg
ZQIxAIwhTE+75bBQ35BiSebMkdv4P11xkQiOT5LJf6Zc6hN+7W3E6MMqb1wR4aXz
alqaTQ==
-----END CERTIFICATE-----

)PEM";


constexpr uint32_t RACK_SAMPLE_MS = 20u;
constexpr uint32_t RACK_STABLE_MS = 300u;
constexpr bool RACK_OCCUPIED_WHEN_LOW = true;  // Change only if bench testing shows inverted sensor output.
constexpr bool RACK_VERBOSE_SYNC = true;      // Prints raw edges and occupancy request diagnostics.
constexpr char kHost[] = "firebasedataconnect.googleapis.com";
constexpr uint32_t kPollMs = 5000;
constexpr uint32_t kReconnectMs = 10000;
constexpr uint32_t kMinimumCycleMs = 1000;
constexpr time_t kMinimumTime = 1735689600;  // 2025-01-01, TLS sanity only.
// END EDITABLE SETTINGS.

static_assert(RACK_SAMPLE_MS > 0 && RACK_STABLE_MS >= RACK_SAMPLE_MS,
              "Debounce interval must be at least one sample interval");

// Pure sensor/report scheduling logic is shared with native tests of this file.
namespace rack {
constexpr size_t kSlotCount = 8;
constexpr uint8_t kHallPins[kSlotCount] = {4, 5, 6, 7, 15, 16, 17, 18};

struct Sensor {
  bool rawOccupied = false;
  bool candidateOccupied = false;
  bool stableOccupied = false;
  bool initialized = false;
  bool baselineReady = false;
  uint32_t candidateSince = 0;
  uint32_t generation = 0;
};

// Return true only when accepting a baseline or a new stable state.
inline bool sample(Sensor &s, bool occupied, uint32_t now, uint32_t stableMs) {
  s.rawOccupied = occupied;
  if (!s.initialized || occupied != s.candidateOccupied) {
    s.initialized = true;
    s.candidateOccupied = occupied;
    s.candidateSince = now;
    ++s.generation;
  }
  if (uint32_t(now - s.candidateSince) >= stableMs &&
      (!s.baselineReady || s.stableOccupied != s.candidateOccupied)) {
    s.stableOccupied = s.candidateOccupied;
    s.baselineReady = true;
    ++s.generation;
    return true;
  }
  return false;
}

inline bool settled(const Sensor &s, uint32_t now, uint32_t stableMs) {
  // Even a bounce back to the old stable value needs a full quiet interval.
  return s.baselineReady && s.rawOccupied == s.candidateOccupied &&
         s.candidateOccupied == s.stableOccupied &&
         uint32_t(now - s.candidateSince) >= stableMs;
}

inline bool mayReport(const Sensor &before, const Sensor &current,
                      uint32_t now, uint32_t stableMs) {
  return before.generation == current.generation &&
         before.stableOccupied == current.stableOccupied &&
         settled(before, now, stableMs) && settled(current, now, stableMs);
}

// Worker-owned receipts, not queued observations. Always send a fresh Sensor copy.
struct ReportSchedule {
  bool attempted = false;
  bool accepted = false;
  uint32_t acceptedGeneration = 0;
  uint32_t lastAttempt = 0;
};

inline bool reportDue(const Sensor &s, const ReportSchedule &report, uint32_t now) {
  if (!settled(s, now, RACK_STABLE_MS)) return false;
  if (!report.attempted) return true;
  const uint32_t elapsed = now - report.lastAttempt;
  return elapsed >= kMinimumCycleMs &&
         (!report.accepted || s.generation != report.acceptedGeneration || elapsed >= kPollMs);
}

inline void finishReport(ReportSchedule &report, const Sensor &sent,
                         bool accepted, uint32_t now) {
  report.attempted = true;
  report.accepted = accepted;
  report.lastAttempt = now;
  if (accepted) report.acceptedGeneration = sent.generation;
}

inline void resetReports(ReportSchedule (&reports)[kSlotCount]) {
  for (auto &report : reports) report = ReportSchedule{};
}

// RAM-only cloud assignment cache. A vacant awaiting-placement slot never blinks.
struct LedAssignment {
  bool known = false;
  bool assigned = false;
  bool previouslyOnRack = false;
};

inline void observePlacement(LedAssignment &a, const Sensor &s) {
  if (a.known && a.assigned && s.baselineReady && s.stableOccupied)
    a.previouslyOnRack = true;
}

inline void updateAssignment(LedAssignment &a, bool sameIdentity, bool assigned,
                             bool cloudPreviouslyOnRack, const Sensor &s) {
  if (!sameIdentity) a = LedAssignment{};
  a.known = true;
  a.assigned = assigned;
  a.previouslyOnRack = assigned && (a.previouslyOnRack || cloudPreviouslyOnRack);
  observePlacement(a, s);
}

// Wire digits: 0=off, 1=on/free, 2=blink/removed but still assigned.
inline char ledMode(const LedAssignment &a, const Sensor &s) {
  if (!s.baselineReady || s.stableOccupied || !a.known) return '0';
  if (!a.assigned) return '1';
  return a.previouslyOnRack ? '2' : '0';
}

// Button bits: back=1, mode=2, next=4. One event per debounced press.
struct SlotBrowser {
  size_t slot = 0;
  bool showTime = false;
  uint8_t candidate = 0;
  uint8_t stable = 0;
  bool blocked = false;
  uint32_t candidateSince = 0;
  uint32_t pageSince = 0;

  bool poll(uint8_t pressed, uint32_t now) {
    if (pressed && (pressed & (pressed - 1))) blocked = true;
    if (pressed != candidate) {
      candidate = pressed;
      candidateSince = now;
    }
    if (uint32_t(now - candidateSince) < 30u) return false;
    if (!pressed) blocked = false;
    if (stable == pressed) return false;
    stable = pressed;
    if (!pressed || blocked) return false;
    if (pressed == 1) slot = (slot + kSlotCount - 1) % kSlotCount;
    else if (pressed == 2) showTime = !showTime;
    else if (pressed == 4) slot = (slot + 1) % kSlotCount;
    else return false;
    pageSince = now;
    return true;
  }
};

inline int monthDays(int year, int month) {
  const int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  return days[month - 1] + (month == 2 && year % 4 == 0 &&
                            (year % 100 != 0 || year % 400 == 0));
}

inline int decimal(const char *text, size_t count) {
  int value = 0;
  for (size_t i = 0; i < count; ++i) {
    if (text[i] < '0' || text[i] > '9') return -1;
    value = value * 10 + text[i] - '0';
  }
  return value;
}

// Firebase RFC3339 timestamp -> Philippine time, independent of system TZ/NTP.
inline bool assignedTimeText(const char *text, char (&out)[17]) {
  const size_t length = strlen(text);
  if (length < 20 || text[4] != '-' || text[7] != '-' || text[10] != 'T' ||
      text[13] != ':' || text[16] != ':') return false;
  int year = decimal(text, 4), month = decimal(text + 5, 2), day = decimal(text + 8, 2);
  const int hour = decimal(text + 11, 2), minute = decimal(text + 14, 2);
  const int second = decimal(text + 17, 2);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays(year, month) ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59)
    return false;
  size_t pos = 19;
  if (text[pos] == '.') {
    const size_t start = ++pos;
    while (text[pos] >= '0' && text[pos] <= '9') ++pos;
    if (start == pos) return false;
  }
  int offset = 0;
  if (text[pos] == 'Z' && pos + 1 == length) {
    // UTC.
  } else if ((text[pos] == '+' || text[pos] == '-') && pos + 6 == length && text[pos + 3] == ':') {
    const int hours = decimal(text + pos + 1, 2), minutes = decimal(text + pos + 4, 2);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return false;
    offset = (hours * 60 + minutes) * (text[pos] == '+' ? 1 : -1);
  } else return false;
  int localMinutes = hour * 60 + minute - offset + 8 * 60;
  while (localMinutes < 0) {
    localMinutes += 1440;
    if (--day == 0) {
      if (--month == 0) { month = 12; --year; }
      day = monthDays(year, month);
    }
  }
  while (localMinutes >= 1440) {
    localMinutes -= 1440;
    if (++day > monthDays(year, month)) {
      day = 1;
      if (++month == 13) { month = 1; ++year; }
    }
  }
  if (year < 1 || year > 9999) return false;
  snprintf(out, sizeof(out), "%04d-%02d-%02d %02d:%02d", year, month, day,
           localMinutes / 60, localMinutes % 60);
  return true;
}

inline void lcdRow(char (&out)[17], const char *text, size_t page = 0) {
  const size_t length = strlen(text);
  const size_t offset = (page % (length ? (length + 15) / 16 : 1)) * 16;
  for (size_t i = 0; i < 16; ++i) {
    const unsigned char value = offset + i < length ? text[offset + i] : ' ';
    out[i] = value >= 32 && value <= 126 ? static_cast<char>(value) : '?';
  }
  out[16] = '\0';
}

inline void browserDetail(char (&out)[17], bool known, bool assigned, bool showTime,
                          const char *content, uint32_t pageElapsed) {
  char timestamp[17];
  if (!known) lcdRow(out, "Sync pending");
  else if (!assigned) lcdRow(out, "Unassigned");
  else if (showTime)
    lcdRow(out, assignedTimeText(content, timestamp) ? timestamp : "Time unavailable");
  else lcdRow(out, content, pageElapsed / 1000u);
}
}  // namespace rack

#ifndef RACK_LOGIC_TEST
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>

// ESP32-S3 native USB needs USB CDC On Boot enabled. Mirror to UART0 too.
class RackLogger : public Print {
 public:
  using Print::write;
  size_t write(uint8_t value) override { return write(&value, 1); }
  size_t write(const uint8_t *buffer, size_t size) override {
    if (Serial) Serial.write(buffer, size);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
    Serial0.write(buffer, size);
#endif
    return size;
  }
};
RackLogger rackLog;

rack::Sensor sensors[rack::kSlotCount];
rack::LedAssignment ledAssignments[rack::kSlotCount];
String assignedContainerIDs[rack::kSlotCount];  // Protected by sensorMutex too.
String assignedAtTimes[rack::kSlotCount];  // Distinguish a new assignment of the same box.
SemaphoreHandle_t sensorMutex = nullptr;
TaskHandle_t cloudTask = nullptr;
hd44780_I2Cexp rackLcd;  // Auto-detect backpack address and pin mapping.
rack::SlotBrowser browser;
bool lcdReady = false;
constexpr uint8_t kPrevPin = 11, kModePin = 12, kNextPin = 10;

void setupLcd() {
  for (uint8_t pin : {kPrevPin, kModePin, kNextPin}) pinMode(pin, INPUT_PULLUP);
  Wire.begin(8, 9, 100000);
  Wire.setTimeOut(10);  // Bound failed transactions on a disconnected/stuck bus.
  const int status = rackLcd.begin(16, 2);
  lcdReady = status == 0;
  if (!lcdReady) rackLog.printf("LCD: initialization failed (%d); rack continues without display.\n", status);
}

void serviceLcd(uint32_t now) {
  const uint8_t pressed = (digitalRead(kPrevPin) == LOW ? 1 : 0) |
                          (digitalRead(kModePin) == LOW ? 2 : 0) |
                          (digitalRead(kNextPin) == LOW ? 4 : 0);
  const bool navigation = browser.poll(pressed, now);
  if (!lcdReady) return;
  static uint32_t lastRefresh = 0;
  static char desired[2][17] = {};
  static char displayed[2][17] = {};
  static String lastContent;
  static bool lastKnown = false, lastAssigned = false;
  if (navigation || !desired[0][0] || uint32_t(now - lastRefresh) >= 20u) {
    lastRefresh = now;
    String content;
    bool known = false, assigned = false;
    if (sensorMutex) {
      xSemaphoreTake(sensorMutex, portMAX_DELAY);
      known = ledAssignments[browser.slot].known;
      assigned = ledAssignments[browser.slot].assigned;
      content = browser.showTime ? assignedAtTimes[browser.slot] : assignedContainerIDs[browser.slot];
      xSemaphoreGive(sensorMutex);
    }
    if (content != lastContent || known != lastKnown || assigned != lastAssigned) {
      browser.pageSince = now;
      lastContent = content;
      lastKnown = known;
      lastAssigned = assigned;
    }
    char heading[17];
    snprintf(heading, sizeof(heading), browser.showTime ? "Slot %u Time +08" : "Slot %u Container",
             unsigned(browser.slot + 1));
    rack::lcdRow(desired[0], heading);
    rack::browserDetail(desired[1], known, assigned, browser.showTime, content.c_str(),
                         uint32_t(now - browser.pageSince));
  }
  // Update at most one dirty character per loop, with bounded I2C work. No clear/flicker.
  for (uint8_t row = 0; row < 2; ++row) {
    for (uint8_t col = 0; col < 16; ++col) {
      if (displayed[row][col] == desired[row][col]) continue;
      if (rackLcd.setCursor(col, row) != 0 || rackLcd.write(uint8_t(desired[row][col])) != 1) {
        lcdReady = false;
        rackLog.println("LCD: write failed; display disabled until restart, rack continues.");
      } else displayed[row][col] = desired[row][col];
      return;
    }
  }
}

void sendLedModes(uint32_t now) {
  static char previous[rack::kSlotCount] = {};
  static uint32_t lastSent = 0;
  static bool sent = false;
  char frame[] = "L:00000000\n";
  if (sensorMutex) {
    xSemaphoreTake(sensorMutex, portMAX_DELAY);
    for (size_t i = 0; i < rack::kSlotCount; ++i)
      frame[i + 2] = rack::ledMode(ledAssignments[i], sensors[i]);
    xSemaphoreGive(sensorMutex);
  }
  if (!sent || memcmp(previous, frame + 2, rack::kSlotCount) != 0 ||
      uint32_t(now - lastSent) >= 1000u) {
    Serial1.write(reinterpret_cast<const uint8_t *>(frame), sizeof(frame) - 1);
    memcpy(previous, frame + 2, rack::kSlotCount);
    lastSent = now;
    sent = true;
  }
}

rack::Sensor sensorSnapshot(size_t index) {
  xSemaphoreTake(sensorMutex, portMAX_DELAY);
  const rack::Sensor result = sensors[index];
  xSemaphoreGive(sensorMutex);
  return result;
}

bool configurationReady() {
  const String ca = RACK_ROOT_CA;
  const bool ready = strlen(RACK_WIFI_SSID) && strlen(RACK_FIREBASE_API_KEY) &&
                     strlen(RACK_FIREBASE_APP_ID) && strlen(RACK_PROJECT) &&
                     strlen(RACK_REGION) && strlen(RACK_SERVICE) &&
                     strlen(RACK_CONNECTOR) &&
                     ca.indexOf("-----BEGIN CERTIFICATE-----") >= 0 &&
                     ca.indexOf("-----END CERTIFICATE-----") >= 0;
  if (!ready)
    rackLog.println("CONFIG: set Wi-Fi, Firebase public config and a trusted PEM CA at the top of esp32.ino; no cloud requests.");
  return ready;
}

// HTTPClient connects inside POST. Recheck after TLS without holding a sensor
// mutex during network I/O. Changes after transmission are reported next time.
class SnapshotTLSClient : public WiFiClientSecure {
 public:
  SnapshotTLSClient(size_t index, const rack::Sensor &expected)
      : index_(index), expected_(expected) {}
  using WiFiClientSecure::connect;
  int connect(const char *host, uint16_t port, int32_t timeout) override {
    const int result = WiFiClientSecure::connect(host, port, timeout);
    if (result &&
        !rack::mayReport(expected_, sensorSnapshot(index_), millis(), RACK_STABLE_MS)) {
      rackLog.printf("DB: slot %u changed/unsettled during TLS; stale report cancelled.\n",
                    unsigned(index_ + 1));
      stop();
      return 0;
    }
    return result;
  }

 private:
  size_t index_;
  const rack::Sensor &expected_;
};

String redacted(String message) {
  for (const char *secret : {RACK_WIFI_SSID, RACK_WIFI_PASSWORD,
                             RACK_FIREBASE_API_KEY, RACK_FIREBASE_APP_ID})
    if (strlen(secret)) message.replace(secret, "[redacted]");
  return message;
}

bool connectorRequest(const JsonDocument &request, JsonDocument &response,
                      size_t slotIndex, const rack::Sensor &expected) {
  if (WiFi.status() != WL_CONNECTED || time(nullptr) < kMinimumTime ||
      !rack::mayReport(expected, sensorSnapshot(slotIndex), millis(), RACK_STABLE_MS))
    return false;
  String body;
  if (request.overflowed() || !serializeJson(request, body)) return false;
  const String url = String("https://") + kHost + "/v1/projects/" + RACK_PROJECT +
      "/locations/" + RACK_REGION + "/services/" + RACK_SERVICE + "/connectors/" +
      RACK_CONNECTOR + ":executeMutation?key=" + RACK_FIREBASE_API_KEY;

  SnapshotTLSClient tls(slotIndex, expected);
  tls.setCACert(RACK_ROOT_CA);
  tls.setHandshakeTimeout(5);  // Seconds; TCP and HTTP timeouts below are ms.
  HTTPClient http;
  if (!http.begin(tls, url)) return false;
  http.setConnectTimeout(5000);
  http.setTimeout(8000);
  http.setReuse(false);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-firebase-gmpid", RACK_FIREBASE_APP_ID);

  const int status = http.POST(body);
  String payload = status > 0 ? http.getString() : String();
  http.end();
  tls.stop();
  const char *operation = request["operationName"] | "unknown";
  const DeserializationError error = deserializeJson(response, payload);
  if (status < 200 || status >= 300) {
    rackLog.printf("DB: %s HTTP %d FAILED; update not confirmed.\n", operation, status);
    if (status < 0)
      rackLog.println(HTTPClient::errorToString(status));
    if (!error && response["error"]["message"].is<const char *>())
      rackLog.println(redacted(response["error"]["message"].as<String>()).substring(0, 300));
    return false;
  }
  if (error || response.overflowed()) {
    rackLog.printf("DB: %s invalid JSON (%s); update not confirmed.\n", operation, error.c_str());
    return false;
  }
  // An empty errors array is a successful GraphQL response, not an error.
  const JsonVariantConst errors = response["errors"];
  if (!errors.isNull() && (!errors.is<JsonArrayConst>() || errors.size() > 0)) {
    rackLog.printf("DB: %s GraphQL FAILED; transaction/update not confirmed.\n", operation);
    for (JsonObjectConst entry : errors.as<JsonArrayConst>()) {
      rackLog.println(redacted(entry["message"] | "Unspecified GraphQL error").substring(0, 300));
    }
    return false;
  }
  if (!response["error"].isNull()) {
    rackLog.println("DB: error envelope; occupancy report not confirmed.");
    rackLog.println(redacted(response["error"]["message"] | "Unspecified API error").substring(0, 300));
    return false;
  }
  if (!response["data"].is<JsonObjectConst>()) {
    rackLog.printf("DB: %s missing response data; update not confirmed.\n", operation);
    return false;
  }
  return true;
}

bool reportSlot(size_t index, const rack::Sensor &before) {
  if (RACK_VERBOSE_SYNC)
    rackLog.printf("CHECK: slot %u GPIO %u=%s raw=%s stable=%s settled=yes.\n",
                  unsigned(index + 1), rack::kHallPins[index],
                  before.rawOccupied == RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH",
                  before.rawOccupied ? "occupied" : "vacant",
                  before.stableOccupied ? "occupied" : "vacant");
  rackLog.printf("[FIREBASE SEND] %lu ms | Slot %u | %s | isOccupied=%s\n",
                static_cast<unsigned long>(millis()), unsigned(index + 1),
                before.stableOccupied ? "DETECTED / ON RACK" : "NOT DETECTED / OFF RACK",
                before.stableOccupied ? "true" : "false");
  JsonDocument request, response;
  request["operationName"] = "ReportSlotOccupancy";
  request["variables"]["slotID"] = int(index + 1);
  request["variables"]["occupied"] = before.stableOccupied;
  if (!connectorRequest(request, response, index, before)) {
    rackLog.printf("[FIREBASE FAIL] Slot %u | isOccupied=%s | update NOT CONFIRMED; will refresh latest sensor state.\n",
                  unsigned(index + 1), before.stableOccupied ? "true" : "false");
    return false;
  }
  // Confirm the deployed ReportSlotOccupancy operation saved this slot's reading.
  const JsonVariantConst observation = response["data"]["observation"];
  const JsonVariantConst slot = response["data"]["query"]["slot"];
  if (!observation.is<int>() || observation.as<int>() != 1 ||
      !slot.is<JsonObjectConst>() || !slot["slotId"].is<int>() ||
      slot["slotId"].as<int>() != int(index + 1) || !slot["isOccupied"].is<bool>() ||
      slot["isOccupied"].as<bool>() != before.stableOccupied ||
      !slot["occupancyUpdatedAt"].is<const char *>()) {
    rackLog.printf("[FIREBASE FAIL] Slot %u | response does not confirm the requested update.\n",
                  unsigned(index + 1));
    return false;
  }
  rackLog.printf("[FIREBASE OK] DB UPDATED: slot %u isOccupied=%s (%s); confirmed by Firebase response.\n",
                unsigned(index + 1), before.stableOccupied ? "true" : "false",
                before.stableOccupied ? "ON RACK" : "OFF RACK");
  // Missing/malformed assignment fields must not turn a vacant slot into "free".
  const JsonVariantConst product = slot["containerID"];
  const char *assignedAt = slot["assignedAt"] | "";
  const char *status = slot["stock"]["currentStatus"] | "";
  const bool assigned = product.is<const char *>() && strlen(product.as<const char *>()) > 0;
  const bool cloudPreviouslyOnRack = strcmp(status, "OCCUPIED") == 0 ||
                                     strcmp(status, "PENDING_DISPATCH") == 0;
  if (!product.isUnbound() &&
      (product.isNull() || (assigned && strlen(assignedAt) &&
                           (cloudPreviouslyOnRack || strcmp(status, "EMPTY") == 0)))) {
    const String identity = assigned ? product.as<const char *>() : "";
    const String assignmentTime = assigned ? assignedAt : "";
    xSemaphoreTake(sensorMutex, portMAX_DELAY);
    const bool sameIdentity = ledAssignments[index].known && assignedContainerIDs[index] == identity &&
                              assignedAtTimes[index] == assignmentTime;
    rack::updateAssignment(ledAssignments[index], sameIdentity, assigned,
                           cloudPreviouslyOnRack, sensors[index]);
    assignedContainerIDs[index] = identity;
    assignedAtTimes[index] = assignmentTime;
    xSemaphoreGive(sensorMutex);
  } else {
    rackLog.printf("LED: slot %u invalid assignment response; keeping cached assignment.\n",
                   unsigned(index + 1));
  }
  if (!slot.isNull()) {
    const String interpretation = redacted(String("container=") + (slot["containerID"] | "unassigned") +
        " status=" + (slot["stock"]["currentStatus"] | "unassigned/unknown") +
        " occupancyUpdatedAt=" + (slot["occupancyUpdatedAt"] | "not returned"));
    rackLog.printf("DB: slot %u cloud-reported %s\n", unsigned(index + 1), interpretation.c_str());
  }
  // No product lookup or dispatch request is made by the rack. The phone confirms departure.
  return true;
}

void cloudWorker(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  uint32_t lastReconnect = millis() - kReconnectMs;
  uint32_t lastClockLog = millis() - kReconnectMs;
  bool connected = false;
  rack::ReportSchedule reports[rack::kSlotCount];
  size_t nextSlot = 0;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      if (connected) rackLog.println("Wi-Fi lost; sampling continues.");
      connected = false;

      if (uint32_t(millis() - lastReconnect) >= kReconnectMs) {
        lastReconnect = millis();
        rackLog.println("Wi-Fi: connecting/reconnecting...");
        WiFi.begin(RACK_WIFI_SSID, RACK_WIFI_PASSWORD);
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    if (!connected) {
      connected = true;
      rack::resetReports(reports);
      rackLog.println("Wi-Fi connected; report all current stable slots after UTC clock sync for TLS.");
      configTime(0, 0, "time.google.com", "pool.ntp.org");
    }
    if (time(nullptr) < kMinimumTime) {
      if (uint32_t(millis() - lastClockLog) >= kReconnectMs) {
        lastClockLog = millis();
        rackLog.println("CLOCK: waiting for NTP; no HTTPS until clock is plausible.");
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100));
    // Round-robin due slots so a failed/noisy slot cannot starve the other seven.
    for (size_t offset = 0; offset < rack::kSlotCount; ++offset) {
      const size_t index = (nextSlot + offset) % rack::kSlotCount;
      const rack::Sensor before = sensorSnapshot(index);
      if (!rack::reportDue(before, reports[index], millis())) continue;
      const bool accepted = reportSlot(index, before);
      rack::finishReport(reports[index], before, accepted, millis());
      nextSlot = (index + 1) % rack::kSlotCount;
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(9600, SERIAL_8N1, 14, 13);  // UNO D12 -> divider -> RX; TX -> UNO D11.
  sendLedModes(millis());  // All OFF until sensor baselines and assignments are known.
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial0.begin(115200);
#endif
  rackLog.println("[BOOT] Rack S3 logging v2 — heartbeat every 2 seconds; monitor at 115200 baud.");
  rackLog.printf("Rack MVP: %s=occupied; report occupancy only; cloud resolves assignment/status/activity.\n",
                RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH");
  rackLog.println("Slot 3 Hall input is GPIO 6. Serial Monitor: 115200 baud.");
  for (uint8_t pin : rack::kHallPins) pinMode(pin, INPUT_PULLUP);
  setupLcd();  // Independent of cloud configuration; browsing works offline too.
  sensorMutex = xSemaphoreCreateMutex();
  if (!sensorMutex) {
    rackLog.println("FATAL: sensor mutex allocation failed; cloud disabled.");
    return;
  }
  if (!configurationReady()) return;
  if (xTaskCreate(cloudWorker, "rack-cloud", 12288, nullptr, 1, &cloudTask) != pdPASS) {
    cloudTask = nullptr;
    rackLog.println("ERROR: cloud task allocation failed; Hall diagnostics only.");
  }
}

void loop() {
  static uint32_t lastSample = millis() - RACK_SAMPLE_MS;
  const uint32_t now = millis();
  static uint32_t lastHeartbeat = millis() - 2000u;
  if (uint32_t(now - lastHeartbeat) >= 2000u) {
    lastHeartbeat = now;
    rackLog.printf("[ALIVE] uptime=%lu ms | WiFi=%s | cloud worker=%s\n",
                   static_cast<unsigned long>(now),
                   WiFi.status() == WL_CONNECTED ? "connected" : "disconnected",
                   cloudTask ? "running" : "disabled (check settings)");
    rackLog.print("[HALL SNAPSHOT] ");
    for (size_t i = 0; i < rack::kSlotCount; ++i) {
      const bool low = digitalRead(rack::kHallPins[i]) == LOW;
      rackLog.printf("S%u(GPIO%u)=%s/%s ", unsigned(i + 1), rack::kHallPins[i],
                     low ? "LOW" : "HIGH",
                     low == RACK_OCCUPIED_WHEN_LOW ? "detected" : "not-detected");
    }
    rackLog.println();
  }
  if (sensorMutex && uint32_t(now - lastSample) >= RACK_SAMPLE_MS) {
    lastSample = now;
    for (size_t i = 0; i < rack::kSlotCount; ++i) {
      const bool occupied = (digitalRead(rack::kHallPins[i]) == LOW) == RACK_OCCUPIED_WHEN_LOW;
      xSemaphoreTake(sensorMutex, portMAX_DELAY);
      const bool rawChanged = !sensors[i].initialized || sensors[i].rawOccupied != occupied;
      const bool changed = rack::sample(sensors[i], occupied, now, RACK_STABLE_MS);
      rack::observePlacement(ledAssignments[i], sensors[i]);
      const rack::Sensor current = sensors[i];
      xSemaphoreGive(sensorMutex);
      if (rawChanged && RACK_VERBOSE_SYNC)
        rackLog.printf("[HALL RAW] %lu ms | Slot %u GPIO %u=%s candidate=%s stable=%s\n",
                      static_cast<unsigned long>(now), unsigned(i + 1), rack::kHallPins[i],
                      occupied == RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH",
                      occupied ? "occupied" : "vacant",
                      current.baselineReady ? (current.stableOccupied ? "occupied" : "vacant") : "unknown");
      if (changed) {
        rackLog.printf("[HALL UPDATE] %lu ms | Slot %u GPIO %u | %s | stable for %lu ms\n",
                      static_cast<unsigned long>(now), unsigned(i + 1), rack::kHallPins[i],
                      occupied ? "DETECTED / ON RACK" : "NOT DETECTED / OFF RACK",
                      static_cast<unsigned long>(RACK_STABLE_MS));
        if (cloudTask) xTaskNotifyGive(cloudTask);
      }
    }
  }
  sendLedModes(now);
  serviceLcd(now);
  delay(1);  // Yield to FreeRTOS, never wait for Wi-Fi/HTTP in this loop.
}
#endif  // RACK_LOGIC_TEST
