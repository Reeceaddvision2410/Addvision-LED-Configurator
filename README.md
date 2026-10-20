# Add Vision LED Configurator

The Add Vision LED Configurator lets customers design an LED video wall, see it at real size on a photo of their own shopfront, and send you an enquiry. You manage it from an **Admin page** at `/admin`, where you can see enquiries (with photos and mockups) and change products, prices, options, branding and contact details without touching code.

## What's in the project

```
public/                    the website Netlify serves
  index.html               configurator (4 steps)
  admin/index.html         admin page (password protected)
  thanks.html              thank-you page
  favicon.svg
  assets/
    brand.css, brand.js    shared Add Vision branding (header, footer, colours)
    styles.css, app.js     configurator and mockup maker
    admin.css, admin.js    admin page
    default-config.json    built-in products and settings, used until you save in the admin
netlify/
  functions/               the backend API
    login.mjs              admin sign-in
    config.mjs             saves and loads settings
    enquiries.mjs          saves enquiries and photos; lists, updates and deletes them for the admin
  lib/auth.mjs             password check and sign-in sessions
netlify.toml               Netlify settings
package.json               backend dependency (@netlify/blobs)
```

Everything you save, including settings, enquiries and photos, is stored in **Netlify Blobs**, which comes with your Netlify site. You don't need a database.

## Updating from the previous version

The website files now live in a `public` folder. The simplest way to update GitHub:

1. Delete the old files from the repo: `index.html`, `thanks.html`, `favicon.svg` and the `assets` folder.
2. Upload everything from this zip, including the `public` and `netlify` folders, `netlify.toml`, `package.json`, `README.md` and `.gitignore`. Keep the folders as they are.
3. In Netlify, open **Site configuration → Build & deploy → Build settings**. Clear **Base directory**, **Build command** and **Publish directory**, because `netlify.toml` sets them now.

## One-time setup in Netlify

1. **Set the admin password.** Go to **Site configuration → Environment variables → Add a variable**. Set the key to `ADMIN_PASSWORD` and the value to a long password only you know. Optionally, add `SESSION_SECRET` with any long random text.
2. **Redeploy.** Go to **Deploys → Trigger deploy → Deploy site**.
3. **Turn on email alerts (optional but recommended).** Go to **Forms**, click **Enable form detection** and redeploy once. Then go to **Forms → Form notifications → Add notification → Email notification**, choose the `led-enquiry` form and enter `info@addvision.co`. You'll get an email for every enquiry. The photos and mockups are in the admin.
4. Open `https://YOUR-SITE.netlify.app/admin` and sign in with your password.

Changing `ADMIN_PASSWORD` signs out everyone who's signed in.

## Using the admin

| Tab | What you can do |
| --- | --- |
| **Enquiries** | See every enquiry, newest first. Open one to see the contact details, screen spec, the customer's site photo and the mockup. Set a status (New, Contacted, Quoted, Won, Lost), add internal notes, delete enquiries, or export a filtered list to CSV for Excel. |
| **Products** | Switch environments (Indoor, Window-facing, Outdoor) on or off. Add, duplicate, edit or remove products: pitch, cabinet size, brightness, weight, power, LED type, refresh rate, service access and price per m². Pixels per cabinet is worked out for you. |
| **Options & pricing** | Turn the customer-facing budget estimate on or off, and set the ± range and the note shown with it. Edit mounting options and services with their prices (per m² or fixed), and the dropdown lists on the enquiry form. |
| **Branding & contact** | The Add Vision logo, sky blue (#71C8FA) and white header are built in. Here you can change the colours, upload a different logo, edit the **booking buttons** (Book a sales call, Book a CMS demo: text, Zoho link, style, on/off), the headline and intro, and your contact details. Changes preview straight away in the admin header. |
| **Backup** | Download your settings as a file, restore from a file, or reset everything to the built-in defaults. |

Nothing changes on the live site until you press **Save & publish**. **Discard** undoes everything since your last save.

**Pricing:** a budget only shows when pricing is switched on **and** the chosen product has a price per m². The estimate is screen area × product price, plus the mounting price, plus the services the customer ticked. It's shown as a range of ± the percentage you set, rounded to £100.

## Booking buttons

**Book a sales call** and **Book a CMS demo** link to your Zoho Bookings pages. They show in the header of every page, on the review step, on the thank-you page and in the footer, and open in a new tab. You can change them under **Admin → Branding & contact → Booking buttons**.

## The mockup maker (step 2 for customers)

1. The customer uploads a shopfront photo, or tries the built-in sample shopfront.
2. They drag two dots to each end of their door, or anything else whose size they know, to set the scale.
3. The screen appears at the **exact size they configured**. They can drag it into place, move it with the arrow keys, or change the number of cabinets.
4. Options include showing their own artwork on the screen, an evening view with screen glow, and downloading the mockup as a branded JPG.
5. When they send the enquiry, their photo and the mockup are attached. You'll see both in the admin.

## Embedding on addvision.co

```html
<iframe src="https://YOUR-SITE.netlify.app" style="width:100%;height:1500px;border:0" title="LED screen configurator"></iframe>
```

`netlify.toml` already allows framing from addvision.co. The admin page can't be framed.

## Running it on your computer (optional)

```bash
npm install
npm install -g netlify-cli
ADMIN_PASSWORD=choose-one netlify dev
```

Then open http://localhost:8888 for the configurator and http://localhost:8888/admin for the admin.
