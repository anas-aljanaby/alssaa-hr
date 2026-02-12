# Customizing Supabase confirmation email

The default confirmation email comes from **Supabase Auth \<noreply@mail.app.supabase.io\>** with a generic "Confirm your signup" message. To use your own sender and wording:

## Ready-to-use: Confirm signup template

Paste these into **Authentication → Email Templates → Confirm signup** in the Supabase Dashboard.

### Option A: Arabic — branded (alssaa.com colors & logo)

**Subject:**
```
تأكيد بريدك الإلكتروني — ALSSAA HR
```

**Body (HTML):** Uses ALSSAA brand colors (#081866, #00b1dd, #029f56) and logo from alssaa.com.
```html
<table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5;">
  <tr>
    <td style="padding: 32px 24px; background: #ffffff; border-bottom: 3px solid #00b1dd;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="text-align: center;">
            <img src="https://alssaa.com/images/favicon/favicon.ico" alt="ALSSAA" width="40" height="40" style="vertical-align: middle; margin-left: 8px;" />
            <span style="font-size: 22px; font-weight: bold; color: #081866;">ALSSAA HR</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding: 28px 24px; background: #ffffff;">
      <p style="margin: 0 0 8px; font-size: 16px; color: #081866; font-weight: 600;">مرحباً،</p>
      <p style="margin: 0 0 20px; font-size: 15px; color: #444; line-height: 1.6;">شكراً لتسجيلك في ALSSAA HR. يرجى النقر على الزر أدناه لتأكيد بريدك الإلكتروني.</p>
      <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
        <tr>
          <td style="background-color: #00b1dd; padding: 2px; border-radius: 6px;">
            <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">تأكيد البريد الإلكتروني</a>
          </td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 13px; color: #706f6f; line-height: 1.6;">أو انسخ الرابط ولصقه في المتصفح: <a href="{{ .ConfirmationURL }}" style="color: #00b1dd; text-decoration: underline;">{{ .ConfirmationURL }}</a></p>
      <p style="margin: 20px 0 0; font-size: 12px; color: #8f8f8f;">إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة.</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px 24px; background: #f2f2f2; border-top: 1px solid #e4e4e4;">
      <p style="margin: 0; font-size: 12px; color: #8f8f8f; text-align: center;">شبكة الساعة الإعلامية — ALSSAA</p>
    </td>
  </tr>
</table>
```

### Option B: Arabic — simple (plain text style)
**Subject:** `تأكيد بريدك الإلكتروني — ALSSAA HR`
```html
<table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f7f9fc;">
  <tr>
    <td style="padding: 28px 24px 16px; text-align: center; background: #081866;">
      <img src="https://alssaa.com/images/favicon/favicon.ico" alt="ALSSAA" width="48" height="48" style="display: block; margin: 0 auto 10px;" />
      <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">ALSSAA HR</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 26px 24px; background: #ffffff; text-align: right;">
      <h2 style="margin: 0 0 12px; color: #081866; font-size: 20px;">مرحباً بك في ALSSAA HR</h2>
      <p style="margin: 0 0 20px; color: #3e4a59; line-height: 1.8; font-size: 15px;">
        شكراً لتسجيلك. لتفعيل حسابك، يرجى تأكيد بريدك الإلكتروني عبر الزر التالي.
      </p>
      <p style="margin: 0 0 20px;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #00b1dd; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 6px;">تأكيد البريد الإلكتروني</a>
      </p>
      <p style="margin: 0; color: #6b7280; line-height: 1.8; font-size: 13px;">
        إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة.
      </p>
    </td>
  </tr>
</table>
```

### Option C: English

**Subject:** `Verify your email — ALSSAA HR`

**Body (HTML):**
```html
<h2>Welcome to ALSSAA HR</h2>
<p>Thanks for signing up. Please verify your email address so you can access your account.</p>
<p><a href="{{ .ConfirmationURL }}">Verify my email</a></p>
<p>If you didn’t create an account, you can ignore this email.</p>
```

---

## 1. Change the email content (subject & body)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Email Templates**.
3. Select **Confirm signup**.
4. Paste the **Subject** and **Body (HTML)** from the section above, or edit to your liking.

**Useful variables:**

| Variable             | Description                    |
|----------------------|--------------------------------|
| `{{ .ConfirmationURL }}` | Link user must click to confirm |
| `{{ .Email }}`       | User’s email                   |
| `{{ .SiteURL }}`     | Your app’s Site URL from Auth settings |

Save the template.

## 2. Change the sender (from "noreply@mail.app.supabase.io")

To send from your own address (e.g. `noreply@alssaa.com` or `hr@alssaa.com`):

1. In the Dashboard go to **Authentication** → **SMTP Settings** (or **Project Settings** → **Auth** depending on layout).
2. Enable **Custom SMTP**.
3. Enter your SMTP provider details (SendGrid, Resend, AWS SES, Brevo, Postmark, etc.):
   - Host, port, user, password
   - **Sender email**: e.g. `noreply@alssaa.com` (must be a verified address/domain with your provider)
   - **Sender name**: e.g. `ALSSAA HR`

After saving, confirmation (and other auth) emails will use your custom SMTP and show your chosen “From” address and name.

**Note:** The built-in Supabase mailer is limited and for non-production; custom SMTP is required for production and to control the sender.
