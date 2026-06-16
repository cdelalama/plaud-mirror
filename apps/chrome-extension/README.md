# Plaud Mirror Chrome Extension

Local Chrome extension for refreshing Plaud Mirror's bearer token without DevTools or bookmarklets.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `apps/chrome-extension`.
5. Pin **Plaud Mirror Connector** in the Chrome toolbar.

## Use

1. Open Plaud Mirror and log in.
2. Click **Reconectar Plaud** in the Configuration tab. This creates the one-time capture session and opens Plaud.
3. Log into Plaud with Google if needed.
4. Click the **Plaud Mirror Connector** extension button.
5. Click **Send token to mirror**.

The extension reads the active Plaud tab's browser token and redirects that tab to Plaud Mirror's `/connect#token=...` page. It does not store or log Plaud tokens.
