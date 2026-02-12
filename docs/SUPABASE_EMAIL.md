# Customizing Supabase confirmation email

The default confirmation email comes from **Supabase Auth \<noreply@mail.app.supabase.io\>** with a generic "Confirm your signup" message. To use your own sender and wording:

## Ready-to-use: Confirm signup template

Paste these into **Authentication → Email Templates → Confirm signup** in the Supabase Dashboard.

### Option A: Arabic (recommended for ALSSAA audience)

**Subject:**
```
تأكيد بريدك الإلكتروني — ALSSAA HR
```

**Body (HTML):** (use `dir="rtl"` so the email displays right-to-left)
```html
<div dir="rtl" style="text-align: right;">
  <h2>مرحباً بك في ALSSAA HR</h2>
  <p>شكراً لتسجيلك. يرجى تأكيد بريدك الإلكتروني للوصول إلى حسابك.</p>
  <p><a href="{{ .ConfirmationURL }}">تأكيد بريدي</a></p>
  <p>إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة.</p>
</div>
```

### Option B: English

**Subject:**
```
Verify your email — ALSSAA HR
```

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
