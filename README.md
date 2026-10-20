# Add Vision LED Configurator

The Add Vision LED Configurator lets a customer design an LED video wall, preview it on a photo of their own site and send you an enquiry. It's a static site with no build step, and enquiries are collected with Netlify Forms.

## What's in the project

| File | Purpose |
| --- | --- |
| `index.html` | The configurator page and the enquiry form |
| `assets/app.js` | Product data, calculations, preview drawing, photo tool and form sending |
| `assets/styles.css` | All styling, with light and dark themes |
| `thanks.html` | Thank-you page, shown if a browser posts the form without JavaScript |
| `favicon.svg` | Browser tab icon |
| `netlify.toml` | Netlify settings and security headers |

## 1. Put it on GitHub

1. Go to github.com, click **New repository** and name it `addvision-led-configurator`. Set it to **Private** and don't add a README.
2. Choose one way to upload the files:
   - **In the browser:** open the new repo, click **uploading an existing file**, drag in everything from this folder (including the `assets` folder) and click **Commit changes**.
   - **From a terminal:** this folder is already a git repository, so run:
     ```bash
     git remote add origin https://github.com/YOUR-ACCOUNT/addvision-led-configurator.git
     git branch -M main
     git push -u origin main
     ```

## 2. Connect it to Netlify

1. In Netlify, go to **Add new site → Import an existing project → GitHub** and choose the repo.
2. Leave **Build command** empty and set **Publish directory** to `.` (netlify.toml already sets this).
3. Click **Deploy**. From then on, Netlify redeploys automatically every time you push to GitHub.

## 3. Turn on enquiry collection (required)

1. Go to **Site configuration → Forms** and click **Enable form detection**.
2. Redeploy the site once (**Deploys → Trigger deploy → Deploy site**) so Netlify finds the `led-enquiry` form.
3. Under **Forms → Form notifications → Add notification → Email notification**, choose the `led-enquiry` form and enter `info@addvision.co`.

Each enquiry includes:

- the contact details and the full specification as text
- a reference number, for example `AV-261020-K3P9`
- the customer's site photo, resized to 2000 px
- the mockup of the screen placed on that photo

To view them, go to **Forms → led-enquiry**. Netlify's free plan has monthly limits on form submissions and file uploads, so check your plan if volumes grow.

## 4. Use your own domain (optional)

Go to **Domain management → Add a domain** and enter something like `configurator.addvision.co`. Then add the CNAME record Netlify gives you at your DNS provider.

To embed the configurator in a page on addvision.co instead:

```html
<iframe src="https://configurator.addvision.co" style="width:100%;height:1400px;border:0" title="LED screen configurator"></iframe>
```

`netlify.toml` already allows framing from `addvision.co` and `www.addvision.co`.

## Editing products

Open `assets/app.js` and edit the `SERIES` object near the top. Each line is one product:

```js
{p:2.604, cw:500, ch:500, nits:900, kg:30, w:520, name:"AV Interior", tech:"SMD 2020", refresh:3840, service:"Front & rear"}
```

| Field | Meaning |
| --- | --- |
| `p` | Pixel pitch in mm |
| `cw`, `ch` | Cabinet width and height in mm |
| `nits` | Brightness |
| `kg` | Weight per m² |
| `w` | Maximum watts per m² |
| `name`, `tech`, `refresh`, `service` | Shown in the specification |

The figures shipped with the project are typical industry values, not your actual product range. Replace them with your real products before going live. You can edit the file directly on GitHub (click the pencil icon), and Netlify redeploys within a minute.

## Testing locally

Run a simple server from this folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Everything works locally except sending the enquiry, which only works once the site is on Netlify.
