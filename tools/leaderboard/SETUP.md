# Leaderboard setup (Google Sheets + Apps Script)

The online leaderboard is a Google Sheet with a small script in front of it. It takes about five minutes to set up, and it costs nothing.

Until it's set up, the game still works: scores are kept on each player's device, and the Leaderboard screen shows those.

## 1. Create the sheet

1. Go to [sheets.new](https://sheets.new) and name the sheet, for example "Aleforge Leaderboard".
2. You don't need to add anything to it. The script creates a `Scores` tab with headers the first time a score arrives.

## 2. Add the script

1. In the sheet, open **Extensions → Apps Script**.
2. Delete the placeholder code in `Code.gs`.
3. Paste in the whole contents of [`Code.gs`](Code.gs) from this folder.
4. Click **Save**.

## 3. Deploy it as a web app

1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Fill in the settings:
   - **Description:** Aleforge leaderboard
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*. This is required: players aren't signed in to your Google account.
4. Click **Deploy**.
5. Authorize the script when Google asks. Google warns about an unverified app because it's your own script: choose **Advanced → Go to … (unsafe)**, then **Allow**.
6. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

## 4. Point the game at it

Use either of these:

- **For everyone (recommended):** put the URL in [`src/config.js`](../../src/config.js):

  ```js
  export const LEADERBOARD_URL = 'https://script.google.com/macros/s/AKfy…/exec';
  ```

  Then commit and redeploy the game.
- **For just your browser (testing):** open the game, go to **Settings → Leaderboard URL**, and paste it in.

Play a game to the end, then open **Leaderboard**. Your score should appear, and a row should appear in the `Scores` tab.

## How it works

| Request | What it does |
| --- | --- |
| `POST` (body: JSON as `text/plain`) | Validates a score and appends a row. |
| `GET ?map=cumstead&limit=20` | Returns `{"rows":[…]}`: the best score per name on that map, highest wave first. Ties go to whoever reached that wave first. |

The script's safeguards:

- **Name cleanup:** names are trimmed to 20 characters. Leading `= + - @` are stripped so the sheet never treats a name as a formula.
- **Wave checks:**
  - Waves above 30 are only accepted from Freeplay runs, which require a campaign clear.
  - A "cleared" run must have reached wave 30.
- **Rate limit:** one score per name every 20 seconds.
- **Locking:** a script lock keeps simultaneous submissions from colliding.

This is a friendly leaderboard, not an anti-cheat system. Anyone can send a request to the URL. To remove a bad entry, delete its row in the sheet.

## Updating the script later

After you change `Code.gs`, go to **Deploy → Manage deployments**, click the pencil, choose **Version → New version**, then **Deploy**. The URL stays the same.

## Testing locally

`node tools/leaderboard/test.mjs` runs `Code.gs` against stubbed Google services and checks validation, rate limiting and ranking.

## Troubleshooting

- **"Couldn't reach the leaderboard"** on the Leaderboard screen:
  - Check that the URL ends in `/exec`, not `/dev`.
  - Check that access is set to *Anyone*.
- **Scores never arrive:**
  - Open the web-app URL with `?map=cumstead` in a browser. You should see JSON.
  - Check **Executions** in the Apps Script editor for errors.
- **Scores that fail to send** are queued on the player's device and retried the next time the title screen opens.
