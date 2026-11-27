# Browser regression checks

Build the root standalone page before running the suite.

```sh
npm ci
npm run build
npm run test:browser
```

The suite uses Chromium at `/usr/bin/chromium` when available. Set `CHROMIUM_PATH` to use another Chromium installation. Without either, the suite uses Playwright's installed Chromium binary.

Playwright fulfills the document from the built `index.html` while the browser context runs offline. The suite requires neither a web server nor network requests and reports any uncaught JavaScript errors or attempted external game assets. It drives the generated page through its controls and uses seeded saves for progression boundaries and storage failure scenarios.

To compare scan counts and HUD mutations with the Equipment Forge release, extract its standalone page from Git and pass its path to the suite.

```sh
git show 327d85025fa11596dea6c5f578b88c9771ea5daf:index.html > /tmp/button-field-before-foundation.html
BUTTON_FIELD_BASELINE=/tmp/button-field-before-foundation.html npm run test:browser
```
