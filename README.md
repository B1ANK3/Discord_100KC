# Discord 100 kill-challenge tracking bot

## Description  

Discord Bot for tracking aimbotz 100 kill challenge. [Aimbotz CSGO Map](https://steamcommunity.com/sharedfiles/filedetails/?l=english&id=243702660)

## How to use 

Add the bot to your server via the invite [link](https://discord.com/api/oauth2/authorize?client_id=777921727555698729&permissions=256064&scope=bot). Members of a server can upload a screenshot of their times to a channel.
eg: ![Example Upload Image](https://github.com/B1ANK3/discord_100kc/blob/master/res/example.jpg)
The bot will automatically detect the time with OCR (Optical Character Recognition) and create a leaderboard for the whole server

## Installing 

To host your own version of the bot (if thats what you desire), download the source code [here](https://github.com/B1ANK3/Discord_100KC/releases/download/v1.0.0/release.zip) from Github and put it in your desired folder.
To install the bot, unpack the release folder and run `npm start` through a terminal (cmd or bash). The dependancies will be installed and bot setup. Add your own Discord bot token to `res/bot_config.json` under `"token"`. To run the bot, run `npm start` in the main folder NOT the release folder.

## TODO

- [x] OCR recognition and time return - high
- [x] Users own hosting, package and source cleaning - high
- [x] Installing files - high
- [x] Complete Leaderboard - high
- [ ] Updating files - high
- [ ] Bot hosting, image - high
- [ ] Clean up. refs, docs, adding to server - med
- [ ] Greetings and so forth.. - med
- [ ] Data collection. eg: accuracy and what can be improved - med
- [ ] Issue report system - low 
- [ ] Other stuff? - unknown

## Dependancies

* [Tesseract.js](https://github.com/naptha/tesseract.js)
* [discord.js](https://github.com/discordjs/discord.js)
* [sharp](https://github.com/lovell/sharp)
* [axios](https://github.com/axios/axios)

## License 

    ISC License

    Copyright (c) 2020, B1ANK3

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted, provided that the above
    copyright notice and this permission notice appear in all copies.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
    WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
    MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
    ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
    WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
    ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
    OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. 