# AutoSPD for YouTube — Privacy Policy

Last updated: November 2, 2026

AutoSPD is a Chrome extension that sets YouTube's playback speed from what a video is about. This policy explains what the extension reads and stores, and where that data goes.

## Summary

- AutoSPD **sends no data to the developer or any third party**. The extension makes no network requests of its own and contains no analytics, tracking or advertising code.
- All decisions are made on your computer, including the optional AI content analysis.
- Data stays in your browser and is deleted when you remove the extension.

## What the extension reads

On YouTube video pages, AutoSPD reads the following about the current video to decide the playback speed:

- Title, description, tags and channel name
- YouTube category
- Whether it is live, or a replay of a finished stream

This is processed only in your browser and is not sent anywhere. AutoSPD only runs on `youtube.com` and does not read other sites.

## What the extension stores

| Data | Where | Contents |
|---|---|---|
| Settings | Chrome sync storage (`chrome.storage.sync`) | Your categories, keywords, channel rules and switches |
| AI result cache | Local (`chrome.storage.local`) | Video IDs and the category the AI picked, up to 2,000 entries, so a video is not analyzed twice. Only created when you use AI content analysis |

AutoSPD **keeps no watch history**: it does not save the titles or a list of videos you have watched. Versions before 1.2 kept a local log of recent speed changes, which is deleted automatically when updating to 1.2 or later.

**About Chrome sync:** if you have turned on sync in Chrome, Chrome syncs your settings between your own devices through your Google account. This is a Chrome feature and the developer cannot access that data. The AI result cache is not synced.

## AI content analysis

If you choose the AI content analysis mode, AutoSPD uses Chrome's built-in AI model (Gemini Nano) to judge what a video is about. The model runs entirely on your computer, so video information is not sent to any server for this. Chrome downloads and manages the model from Google; see Chrome's privacy policy for details.

## Permissions

- **storage**: stores the settings and AI result cache above.
- **Access to youtube.com**: reads video information on YouTube video pages and sets the playback speed; the popup also uses it to check whether the current tab is YouTube.

## Deleting data

- Removing the extension makes Chrome delete everything it stored locally.
- "Restore default categories" on the settings page clears your custom categories and the AI result cache.

## Children's privacy

AutoSPD does not collect personal data from anyone, including children.

## Changes to this policy

If this policy changes, this document and the date above will be updated.

## Contact

For questions about this policy, open an issue on the GitHub project: <https://github.com/george16886/AutoSPD/issues>
