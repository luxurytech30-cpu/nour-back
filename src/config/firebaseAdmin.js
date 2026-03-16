const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "nour-4a810",
      clientEmail: "firebase-adminsdk-fbsvc@nour-4a810.iam.gserviceaccount.com",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDA/nHHVRGRyKDI\nAw05xyHgRtW/oD+LF+6RMBXX0w1i1WOv1ONEflMQkWqi2rIyfpOVBS73APK7uZFJ\nYf57NadGZd2ftWawvmUmVdtOS4ThxXK2xLrztGY/wa6Npi8c/Kq+lDMMWbqyd3Zg\nJlaXgUBVlFrP5UWoK3COQxmELYwT/SKs6pKq5CmLDLi1IIFKihBnIrpD7H5oo7Mg\nh9tF3vZ1TFjVmkYDF59M8YP8GDlJRGs7BACMVm3ViJE2vbCU37+XxBRfG6+4MSL7\n0QuUxCtIsW+OhIaTU2iIe8G02V9HtELq8ceHJ5CPtV3unmuevJ2jcoxktKR4UhoT\nGWyqvyIFAgMBAAECggEACiZXktrPzbxLbblwsfUzEY8oIVKAL68r23Q38d3Q+mhW\nkcy/FxRoXJqz4lS2F8m9tpH14lpTvw5crGCm+DveIZRXOisEIjohKl725as7FdSY\nhTGGKNhNTaprT6/JvTCHRPaY/gafYaYUElfHKLiiIDNpLeh/kqnrhXp/QQr+2Z4t\nxHCDbe4ePLGQnUBNfWu0qysYPJurhOoBGXJMxWuaEP5kFfa8vw3/010e6MPaRukt\n6lKqanNACVmenfdQbELkmUKcbuuTGjPcuTpGKeCMBTTsvdg1r/BFb4mCtsrrTRBN\nqWfSps9Jh9evuBmww8jxBGr6/nfxjUKfSP3Pe2wGEQKBgQDgpHdVvYojs2/IpjrK\nzBnki9QXuLr7RXfVsOClANzS3W9g8qP52OK6NpPvIxgqskhrdbgfArTJz9V+ZIbE\nh5t6BQ3SXHKXosYmh6MXjpbWQOMpZAPaoUEZmtb9btQD3Z2B4+tlB8YKRxVKxauS\nHJQCm0+oyBvMfQ1+Cef1i3PR0wKBgQDb7wcBOhYS51+8v4D9q2jJZw9lqRu3L2/y\n95Imvf+zivR1PGCOe5sUuFAkZ4BgL4kPQbzSmY0OJBQg0MievRnSYvAQ+XMrQ1jY\nBx6l+Zi9rVGLx0zQLjyw/C5BVFvBnhxLpUSsFOApjfT6hEBUAGXY7OcElMDZ+Md9\nj/6gU9F9xwKBgHv6KKYYMgnb+OBq5V2Q4OViSk5BNGiCgU1dDc3iuPxjGxoNL3Qv\nP4n3nxNGcgr2U8OCt3fd3XrXigL0ZfBGywa/jU5AmTmYqvUOvHK+zf4212e7e+kI\nP85qxyYdKUNs5oWODRa4AJMhgd2/VB4SSZlar879iWIEzhJ2Ux8PtH7jAoGAaick\nqmLu5JDolKGaENX67brgo6DLz88Fqa/0yt5J3M7kzvElaaAfahDMHcYXIFXRQZvp\nF30lp/2h+XTMYFHFdNZsKMU94VPQPfSxxkqCfop5IY5AdPrcMFCHwuCEqR83aQuL\n6cLpryTlaUUMB39pqRovJvblXk/FecVWkOvj4WECgYA74mEYDrDyqwmNUSZtJdWS\nEQt4qn5w38HB4kz9dgNZU7CDJSQUR9P5GRb5HmKWjM/u3TUStfVItUOPX4T6NOOH\n0nihrhfob93t5E1IuxLdefOCpUUmpSdNXuet7MMWEFnoQz+36zJvpc8qYw8lxFw7\ntIsPNcF3VeUQpW3LYPa5TQ==\n-----END PRIVATE KEY-----\n"?.replace(
          /\\n/g,
          "\n",
        ),
    }),
  });
}

module.exports = admin;
