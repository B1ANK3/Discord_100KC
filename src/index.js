"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc = require('discord.js');
const tess = require('tesseract.js');
const fs = require('fs');
const sharp = require('sharp');
const axios = require('axios');
const IMAGEDIR = './training/';
const config = __importStar(require("./config.json"));
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
class DiscordTrack {
    constructor(message) {
        this.message = message;
        this.embedMessage = null;
        this.send();
    }
    async send() {
        this.embedMessage = await this.message.channel.send({ embed: this.embed('initial') });
    }
    update(state, args) {
        this.embedMessage.edit({ embed: this.embed(state, args) });
    }
    embed(stage = 'initial', args = '') {
        switch (stage) {
            case 'initial':
                return {
                    title: 'Preparing to process image..',
                };
            case 'updated':
                return {
                    title: `Progress: ${args ? args : '0'}%`
                };
            case 'startup':
                return {
                    title: `Starting worker..`
                };
            case 'finished':
                return {
                    title: `Finished Image Processing..`,
                    description: `This is what I found in your image`,
                    fields: [
                        { name: 'Time: ', value: args }
                    ]
                };
            case 'error':
                return {
                    title: 'An Error occurred while processing your image..\nAbandoning..'
                };
            default: return {};
        }
    }
}
class Discord {
    constructor() {
        this.bot = new dc.Client();
        this.bot.once('ready', () => { console.log(`Ready for orders..`); });
        this.bot.on('message', (mes) => this.message(mes));
        this.bot.login(config.token);
        this.track = null;
    }
    message(message) {
        var self = this;
        if (message.author.bot)
            return;
        if (message.attachments) {
            message.attachments.forEach((l, r) => {
                if (l.url.indexOf('.png') || l.url.indexOf('jpg') || l.url.indexOf('jpeg')) {
                    this.track = new DiscordTrack(message);
                    self.getImage(l.url).then((blob) => self.record(l.url, blob, message));
                }
            });
        }
    }
    getImage(url) {
        return new Promise(function (resolve) {
            axios.get(url, { responseType: 'arraybuffer' }).then((response) => {
                if (response.status != 200)
                    throw new Error(`${response.status}`);
                resolve(response.data);
            });
        });
    }
    async record(url, image, message) {
        var id = makeid(15);
        var self = this;
        if (!fs.existsSync(IMAGEDIR))
            fs.mkdirSync(IMAGEDIR);
        fs.mkdir(`${IMAGEDIR}${id}/`, function (err) {
            if (err)
                throw new Error(`FILE_CREATION_FAILED: ${err}`);
            var obj = {
                date: Date.now(),
                author: message.author,
                guild: message.guild,
                url: url,
                success: null,
                out: null,
                soft: null,
                imageRaw: image,
            };
            self.image(image, `${IMAGEDIR}${id}/`)
                .then((data) => {
                var _a, _b;
                if (!data.success)
                    (_a = self.track) === null || _a === void 0 ? void 0 : _a.update('error');
                (_b = self.track) === null || _b === void 0 ? void 0 : _b.update('finished', data.out);
                obj['success'] = data.success;
                obj['out'] = data.out;
                obj['soft'] = data.soft;
                fs.writeFileSync(`${IMAGEDIR}${id}/results.json`, JSON.stringify(obj, null, 2));
            })
                .catch((data) => {
                var _a;
                (_a = self.track) === null || _a === void 0 ? void 0 : _a.update('error');
                obj['success'] = data.success;
                obj['out'] = data.out;
                obj['soft'] = data.soft;
                fs.writeFileSync(`${IMAGEDIR}${id}/results.json`, JSON.stringify(obj, null, 2));
            });
        });
    }
    async image(data, fileID) {
        var self = this;
        var t = await new Tesseract().init();
        var img = await sharp(data);
        return new Promise(function (resolve, reject) {
            img.metadata()
                .then((imgdata) => {
                var kdi = {
                    l: Math.floor(0.40 * imgdata.width),
                    t: Math.floor(0.7 * imgdata.height),
                    w: Math.floor(0.2 * imgdata.width),
                    h: Math.floor(0.15 * imgdata.height),
                };
                img.extract({ left: kdi.l, top: kdi.t, width: kdi.w, height: kdi.h })
                    .greyscale(true)
                    .resize(kdi.w * 4, kdi.h * 4)
                    .threshold(180)
                    .sharpen()
                    .flatten()
                    .normalise()
                    .png()
                    .toFile(`${fileID}/outImage.png`, function (err, info) {
                    var _a;
                    if (err) {
                        (_a = self.track) === null || _a === void 0 ? void 0 : _a.update('error');
                        reject(err);
                    }
                    console.log(info);
                    t.imageText(`${fileID}/outImage.png`).then((str) => {
                        if (str.includes('Time:')) {
                            var n = str.slice(str.indexOf('Time:') + 5, str.indexOf('Time:') + 16).trim();
                            resolve({ out: n, success: true, soft: true });
                        }
                        else {
                            resolve({ out: `No Time Value Found`, success: false, soft: true });
                        }
                    });
                });
            })
                .catch((err) => {
                reject({ out: err, success: false, soft: false });
            });
        });
    }
}
class Tesseract {
    constructor(options) {
        if (options && options.logging)
            tess.setLogging(true);
        this.worker = null;
    }
    async init() {
        this.worker = tess.createWorker({ logger: (m) => this.track(m) });
        await this.worker.load();
        await this.worker.loadLanguage('eng');
        await this.worker.initialize('eng');
        return this;
    }
    async track(work) {
        var _a;
        console.log(`Worker %: ${Math.floor(work.progress * 10000) / 100}`);
        if (work.status == 'recognizing text')
            (_a = client.track) === null || _a === void 0 ? void 0 : _a.update('updated', `${Math.floor(work.progress * 10000) / 100}`);
    }
    async imageText(url) {
        if (!this.worker)
            throw new Error('Worker has not been initialized');
        const { data: { text } } = await this.worker.recognize(url);
        await this.free();
        return text;
    }
    async free() {
        if (this.worker)
            await this.worker.terminate().then(() => { console.log('Terminated Worker'); }).catch((err) => console.log(err));
        this.worker = null;
    }
}
const client = new Discord();
