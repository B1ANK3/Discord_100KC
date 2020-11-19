import { AxiosResponse } from "axios";
import { Client, Message } from "discord.js";
// import waifu2x from 'waifu2x'

interface config {
    token: string
    prefix: string
}

const dc = require('discord.js')
const tess = require('tesseract.js')
// const rias = require('waifu2x')
const fs = require('fs')
const sharp = require('sharp')
const axios = require('axios')

// const OUTDIR = './parsed/'
const IMAGEDIR = './training/'
const config = require('./config.json')

function makeid(length: number) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}


class DiscordTrack {
    private message: Message
    private embedMessage: any
    constructor(message: Message) {
        this.message = message;
        this.embedMessage = null
        this.send()
    }
    private async send() {
        this.embedMessage = await this.message.channel.send({ embed: this.embed('initial') })
    }
    public update(state: string, args?: string) {
        this.embedMessage.edit({ embed: this.embed(state, args) })
    }
    private embed(stage: string = 'initial', args: string = '') {
        switch (stage) {
            case 'initial':
                return {
                    title: 'Preparing to process image..',
                }
            case 'updated':
                return {
                    title: `Progress: ${args ? args : '0'}%`
                }
            case 'startup':
                return {
                    title: `Starting worker..`
                }
            case 'finished':
                return {
                    title: `Finished Image Processing..`,
                    description: `This is what I found in your image`,
                    fields: [
                        { name: 'Time: ', value: args }
                    ]
                }
            case 'error':
                return {
                    title: 'An Error occurred while processing your image..\nAbandoning..'
                }
            default: return {}
        }
    }
}

class Discord {
    bot: Client
    public track: DiscordTrack | null
    constructor() {
        this.bot = new dc.Client()
        this.bot.once('ready', () => { console.log(`Ready for orders..`) })
        this.bot.on('message', (mes: Message) => this.message(mes))
        this.bot.login(config.token);
        this.track = null
    }
    message(message: Message) {
        var self = this
        if (message.author.bot) return;
        if (message.attachments) {
            message.attachments.forEach((l, r) => {
                if (l.url.indexOf('.png') || l.url.indexOf('jpg') || l.url.indexOf('jpeg')) {
                    this.track = new DiscordTrack(message)
                    self.getImage(l.url).then((blob: ArrayBuffer) => self.record(l.url, blob, message))
                }
            })
        }
    }
    getImage(url: string): Promise<ArrayBuffer> {
        return new Promise(function (resolve) {
            axios.get(url, { responseType: 'arraybuffer' }).then((response: AxiosResponse) => {
                if (response.status != 200) throw new Error(`${response.status}`)
                resolve(response.data)
            })
        })
    }
    async record(url: string, image: ArrayBuffer, message: Message) {
        // Maybe port to google drive ?
        var id = makeid(15) // make folder id
        var self = this // inside callbacks
        if (!fs.existsSync(IMAGEDIR)) fs.mkdirSync(IMAGEDIR) // check dir exists
        fs.mkdir(`${IMAGEDIR}${id}/`, function (err: Error) {
            if (err) throw new Error(`FILE_CREATION_FAILED: ${err}`)
            var obj = {
                date: Date.now(),
                author: message.author,
                guild: message.guild,
                url: url,
                success: null,
                out: null,
                soft: null,
                imageRaw: image,
            }
            self.image(image, `${IMAGEDIR}${id}/`)
                .then((data: any) => {
                    if (!data.success) self.track?.update('error')
                    self.track?.update('finished', data.out)
                    obj['success'] = data.success
                    obj['out'] = data.out
                    obj['soft'] = data.soft
                    fs.writeFileSync(`${IMAGEDIR}${id}/results.json`, JSON.stringify(obj, null, 2))
                })
                .catch((data: any) => {
                    self.track?.update('error')
                    // TODO: LOG FILE
                    obj['success'] = data.success
                    obj['out'] = data.out
                    obj['soft'] = data.soft
                    fs.writeFileSync(`${IMAGEDIR}${id}/results.json`, JSON.stringify(obj, null, 2))
                })
        }) // create new dir with id
    }
    async image(data: any, fileID: string): Promise<any> {
        var self = this
        var t = await new Tesseract().init()
        var img = await sharp(data)
        return new Promise(function (resolve, reject) {
            img.metadata()
                .then((imgdata: any) => {
                    var kdi = {
                        l: Math.floor(0.40 * imgdata.width),
                        t: Math.floor(0.7 * imgdata.height),
                        w: Math.floor(0.2 * imgdata.width),
                        h: Math.floor(0.15 * imgdata.height),
                    }
                    img.extract({ left: kdi.l, top: kdi.t, width: kdi.w, height: kdi.h })
                        .greyscale(true)
                        .resize(kdi.w * 4, kdi.h * 4)
                        .threshold(180)
                        .sharpen()
                        .flatten()
                        .normalise()
                        .png()
                        .toFile(`${fileID}/outImage.png`, function (err: Error, info: any) {
                            if (err) {
                                self.track?.update('error')
                                reject(err)
                            }
                            console.log(info)
                            t.imageText(`${fileID}/outImage.png`).then((str: string) => {
                                if (str.includes('Time:')) {
                                    var n = str.slice(str.indexOf('Time:') + 5, str.indexOf('Time:') + 16).trim()
                                    resolve({ out: n, success: true, soft: true })
                                } else {
                                    resolve({ out: `No Time Value Found`, success: false, soft: true })
                                }
                            })
                        })
                })
                .catch((err: Error) => {
                    reject({ out: err, success: false, soft: false })
                })
        })

    }
}

class Tesseract {
    private worker: any
    constructor(options?: { logging: false }) {
        if (options && options.logging) tess.setLogging(true)
        this.worker = null
    }
    public async init(): Promise<Tesseract> {
        this.worker = tess.createWorker({ logger: (m: any) => this.track(m) });
        await this.worker.load()
        await this.worker.loadLanguage('eng')
        await this.worker.initialize('eng')
        return this
    }
    public async track(work: any) {
        console.log(`Worker %: ${Math.floor(work.progress * 10000) / 100}`)
        if (work.status == 'recognizing text') client.track?.update('updated', `${Math.floor(work.progress * 10000) / 100}`) //TODO make 4/7 points 
    }
    public async imageText(url: string): Promise<string> {
        if (!this.worker) throw new Error('Worker has not been initialized')
        const { data: { text } } = await this.worker.recognize(url)
        await this.free()
        return text
    }
    private async free(): Promise<void> {
        if (this.worker) await this.worker.terminate().then(() => { console.log('Terminated Worker') }).catch((err: any) => console.log(err))
        this.worker = null
    }
}

const client = new Discord()
