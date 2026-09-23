# Adonis Gashi — portfolio

A single-screen portfolio. The name arrives out of deep space letter by letter, and each project is a small light drifting in orbit around it. Hovering a light (or tapping it on a phone) opens a HUD panel: a scan line reveals the project's thumbnail, then the project name decodes below it.

No build step and no dependencies. It's plain HTML, CSS and JS.

## Run locally

```sh
python3 -m http.server 8000   # or: npx serve
```

Then open http://localhost:8000.

## Add your projects

Edit `projects.js`. Each entry becomes one light:

```js
{
  name: 'Project name',
  year: '2026',
  tags: ['React', 'WebGL'],
  description: 'One or two lines.',
  url: 'https://…',            // '' hides the link
  image: 'images/project.jpg',  // null = a generated sci-fi thumbnail
  hue: 210,                     // tint of the light and thumbnail (0–360)
}
```

Screenshots look best at a 16:10 ratio, about 1280×800.

## Deploy

It's a static folder, so it works on Vercel, Netlify or GitHub Pages without any configuration.
