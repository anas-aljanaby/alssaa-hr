# Confirm signup email (Supabase)

**Where to set:** Supabase Auth → Email Templates → **Confirm signup**

---

## Subject

```
تأكيد بريدك الإلكتروني — ALSSAA HR
```

---

## Body (HTML)

<!--
ALSSAA HR App — Confirm Signup Email (Arabic / RTL)
Paste into: Supabase Auth -> Email Templates -> "Confirm signup" -> Email body (HTML)

Notes:
- Replace the placeholders in ALL CAPS (LOGO_URL, PRIMARY_COLOR, etc.).
- Use an absolute HTTPS URL for the logo.
- Supabase variable used: {{ .ConfirmationURL }}
-->

```html
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>تأكيد إنشاء الحساب</title>
  </head>

  <body style="margin:0; padding:0; background:#F6F8FB;">
    <!-- Preheader (hidden) -->
    <div
      style="
        display:none;
        font-size:1px;
        line-height:1px;
        max-height:0;
        max-width:0;
        opacity:0;
        overflow:hidden;
        mso-hide:all;
      "
    >
      أكمل إنشاء حسابك في تطبيق الموارد البشرية الخاص بـ ALSSAA.
    </div>

    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      width="100%"
      style="background:#F6F8FB;"
    >
      <tr>
        <td align="center" style="padding:24px 12px;">
          <!-- Container -->
          <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            border="0"
            width="600"
            style="
              width:600px;
              max-width:600px;
              background:#ffffff;
              border-radius:16px;
              overflow:hidden;
              box-shadow:0 8px 30px rgba(16,24,40,0.08);
            "
          >
            <!-- Header bar -->
            <tr>
              <td
                style="
                  background: #081767;
                  padding:18px 20px;
                "
              >
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  width="100%"
                >
                  <tr>
                    <td align="right" style="vertical-align:middle;">
                      <img
                        src="https://mimetztocwlppmsfmyry.supabase.co/storage/v1/object/public/images/output-onlinepngtools(1).png"
                        width="140"
                        alt="ALSSAA"
                        style="
                          display:block;
                          border:0;
                          outline:none;
                          text-decoration:none;
                          height:auto;
                          max-width:140px;
                        "
                      />
                    </td>
                    <td
                      align="left"
                      style="
                        vertical-align:middle;
                        color: #ffffff;
                        font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                        font-size: 14px;
                        line-height: 1.4;
                      "
                    >
                      تطبيق الموارد البشرية
                      <div style="opacity:0.9; font-size:12px;">
                        alssaa.com
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 22px 10px 22px;">
                <div
                  style="
                    font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                    color:#101828;
                    font-size:18px;
                    line-height:1.6;
                    font-weight:700;
                    margin:0 0 10px 0;
                  "
                >
                  مرحبًا،
                </div>

                <div
                  style="
                    font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                    color:#344054;
                    font-size:14px;
                    line-height:1.9;
                    margin:0 0 16px 0;
                  "
                >
                  تم إنشاء طلب تسجيل حسابك في
                  <strong style="color:#101828;">تطبيق الموارد البشرية</strong>
                  الخاص بـ <strong style="color:#101828;">ALSSAA</strong>.
                  لإكمال التسجيل وتفعيل حسابك، يرجى الضغط على زر التأكيد أدناه.
                </div>

                <!-- Button -->
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  width="100%"
                  style="margin:18px 0 10px 0;"
                >
                  <tr>
                    <td align="center">
                      <a
                        href="{{ .ConfirmationURL }}"
                        style="
                          display:inline-block;
                          background: #081767;
                          color:#ffffff;
                          font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                          font-size:14px;
                          font-weight:700;
                          text-decoration:none;
                          padding:12px 22px;
                          border-radius:12px;
                          border: 1px solid rgba(255,255,255,0.18);
                        "
                        >تأكيد الحساب</a
                      >
                    </td>
                  </tr>
                </table>

                <!-- Secondary text -->
                <div
                  style="
                    font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                    color:#667085;
                    font-size:12.5px;
                    line-height:1.9;
                    margin:12px 0 0 0;
                  "
                >
                  إذا لم تقم بطلب إنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.
                </div>

                <!-- Divider -->
                <div style="height:1px; background:#EAECF0; margin:18px 0;"></div>

                <!-- Fallback link -->
                <div
                  style="
                    font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                    color:#667085;
                    font-size:12.5px;
                    line-height:1.9;
                  "
                >
                  في حال لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
                  <div
                    style="
                      direction:ltr;
                      text-align:left;
                      margin-top:8px;
                      padding:10px 12px;
                      background:#F9FAFB;
                      border:1px solid #EAECF0;
                      border-radius:12px;
                      color:#101828;
                      word-break:break-all;
                      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco,
                        Consolas, 'Liberation Mono', 'Courier New', monospace;
                      font-size:12px;
                      line-height:1.6;
                    "
                  >
                    {{ .ConfirmationURL }}
                  </div>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 22px 22px 22px;">
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  width="100%"
                  style="
                    background: #F9FAFB;
                    border:1px solid #EAECF0;
                    border-radius:14px;
                  "
                >
                  <tr>
                    <td style="padding:14px 14px;">
                      <div
                        style="
                          font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                          color:#344054;
                          font-size:12.5px;
                          line-height:1.8;
                        "
                      >
                        <strong style="color:#101828;">ملاحظة:</strong>
                        لأسباب أمنية، لا تشارك رابط التأكيد مع أي شخص.
                      </div>
                    </td>
                  </tr>
                </table>

                <div
                  style="
                    font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
                    color:#98A2B3;
                    font-size:11.5px;
                    line-height:1.8;
                    margin-top:14px;
                    text-align:center;
                  "
                >
                  © ALSSAA — جميع الحقوق محفوظة<br />
                  <span style="direction:ltr; unicode-bidi:bidi-override;"
                    >alssaa.com</span
                  >
                </div>
              </td>
            </tr>
          </table>

          <!-- Small spacer -->
          <div style="height:18px;"></div>

          <!-- Plain footer note (outside card) -->
          <div
            style="
              font-family: Arial, 'Tahoma', 'Segoe UI', sans-serif;
              color:#98A2B3;
              font-size:11px;
              line-height:1.7;
              text-align:center;
              max-width:600px;
            "
          >
            هذه رسالة تلقائية من نظام ALSSAA للموارد البشرية.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
```
