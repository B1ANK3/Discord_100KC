import { AxiosResponse } from "axios";
import { Client, EmbedField, Message, MessageAttachment } from "discord.js";

const dc = require('discord.js')
const tess = require('tesseract.js')
const fs = require('fs')
const sharp = require('sharp')
const axios = require('axios')
const minimist = require('minimist')(process.argv.slice(2))
const IMAGEDIR = './training/'

//-------------------- GLOBAL VAR --------------------------
var CLIENT: Discord;
var BOARD_G: LeaderBoard;
var DEBUG_G: boolean = false
var debug = function (message: any) {
    if (DEBUG_G) console.log(message)
}
function makeid(length: number) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

class DBclone {
    public cache: any
    private path: string
    constructor(filePath: string) {
        if (!fs.existsSync(filePath)) throw new Error(`File: ${filePath} does not exist..`)
        this.cache = JSON.parse(fs.readFileSync(filePath))
        this.path = filePath;
    }
    updateCache(): void {
        var self = this
        fs.readFile(this.path, (err: Error, data: string) => {
            if (err) throw new Error('File has been moved or no longer exists: ' + err.message)
            self.cache = JSON.parse(data)
        })
    }
    setCache(): void {
        fs.writeFileSync(this.path, JSON.stringify(this.cache, null, 2), 'utf8')
        this.updateCache()
    }
    public value(valPath: string): any {
        var p: string, path: string[], o: any;
        if (valPath.includes(p = '.') || valPath.includes(p = '/')) {
            path = valPath.split(p)
            o = this.cache[path.shift() || 0]
            while (path.length > 0) {
                if (o == undefined) return undefined
                o = o[path.shift() || 0]
            }
            return o
        }
        if (this.cache[valPath] !== undefined) {
            return this.cache[valPath]
        }
        return undefined
    }
    get cached(): any {
        return this.cache
    }
    set cached(obj: any) {
        this.cache = obj
    }
}
function DB(filePath: string): DBclone {
    return new DBclone(filePath)
}
class LeaderBoard {
    private file: DBclone
    constructor() {
        this.file = DB('./res/leaderboard.json')
    }
    public addPlayer(message: Message, time: string) {
        if (message.guild == undefined) return
        var g = this.file.cached.leaderboard.guild
        if (!g.hasOwnProperty(message.guild?.id)) {
            g[message.guild.id] = {
                name: message.guild.name,
                high: { name: message.author.username, seconds: this.parseTime(time), score: time, position: 1 },
                board: [
                    { name: message.author.username, seconds: this.parseTime(time), score: time, position: 1 }
                ]
            }
        }
        else {
            var t = this.file.cached.leaderboard.guild[message.guild.id]
            // add to board
            t.board.push({
                name: message.author.username,
                seconds: this.parseTime(time),
                score: time,
                position: t.board.length + 1
            })
            // Sort players positions
            this.reposition(message.guild.id)
            t.high = t.board[0]
        }
        this.file.setCache()
    }
    public getBoard(guild: string): EmbedField[] | undefined {
        if (this.file.cached.leaderboard.guild[guild] == undefined) return undefined
        var res: any[] = []
        res = this.file.cached.leaderboard.guild[guild]?.board.map((p: any, _i: number) => {
            return { field: { name: p.name, value: `Score: ${p.score} | Position: ${p.position}` }, score: p.seconds }
        })
        res.sort((a, b) => a.score - b.score)
        return res.map((v, _j) => {
            return v.field
        })
    }
    public getTop(guild: string): any {
        if (this.file.cached.leaderboard.guild[guild] == undefined) return undefined
        return this.file.cached.leaderboard.guild[guild]?.high
    }
    private parseTime(time: string): number {
        var f = 0
        f += parseFloat(time.slice(0, time.indexOf(':'))) * 60
        f += parseFloat(time.slice(time.indexOf(':') + 1, time.indexOf('.')))
        f += parseFloat(time.slice(time.indexOf('.') + 1, time.length)) / 1000
        return f
    }
    private reposition(guild: string): any {
        var b = this.file.cached.leaderboard.guild[guild].board
        b.sort((c: any, d: any) => c.seconds - d.seconds)
        b.forEach((f: any, k: number) => { f.position = k + 1 })
    }
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
    public update(state: string, success: boolean, args?: string) {
        this.embedMessage.edit({ embed: this.embed(state, args) })
        if (state == 'finished' && success) {
            if (args == undefined) return
            BOARD_G.addPlayer(this.message, args)
        }
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
    private prefix: string
    constructor() {
        var bot_config = DB('./res/bot_config.json')
        this.bot = new dc.Client()
        this.bot.once('ready', () => { console.log(`Ready for orders..`) })
        this.bot.on('message', (mes: Message) => this.message(mes))
        this.bot.login(bot_config.value('token'));
        this.prefix = bot_config.value('prefix')
        this.track = null
    }
    message(message: Message) {
        var self = this
        if (message.author.bot) return;
        if (message.content != '') {
            this.command(message)
        }
        if (message.attachments) {
            message.attachments.forEach((l: MessageAttachment, _r: string) => {
                if (l.url.indexOf('.png') || l.url.indexOf('jpg') || l.url.indexOf('jpeg')) {
                    this.track = new DiscordTrack(message)
                    self.getImage(l.url).then((blob: ArrayBuffer) => self.record(l.url, blob, message))
                }
            })
        }
    }
    async command(mess: Message): Promise<void> {
        if (mess.content.startsWith(`${this.prefix}lb`)
            || mess.content.startsWith(`${this.prefix}ranks`)) {
            this.leaderboardShow(mess)
        } else if (mess.content.startsWith(`${this.prefix}top`)) {
            this.topShow(mess)
        }
    }
    async topShow(message: Message) {
        if (message.guild == undefined) return
        var top = BOARD_G.getTop(message.guild.id)
        message.channel.send({
            embed: {
                title: `Top Player for ${message.guild.name}`,
                description: `Player to beat: `,
                fields: [
                    { name: top.name, value: `Score: ${top.score} | Position: ${top.position} | KPM: ${Math.round((100 / top.seconds) * 100) / 100}` }
                ],
                footer: { text: `Use ${this.prefix}lb / ${this.prefix}ranks to see the top 20 players. ${this.prefix}top to see the best player` }
            }
        })
    }
    async leaderboardShow(mess: Message): Promise<void> {
        if (mess.guild == undefined) return;
        let fields: EmbedField[] | undefined = BOARD_G.getBoard(mess.guild.id)
        if (fields == undefined) {
            mess.channel.send({
                embed: {
                    title: 'Nothing to show.. Really?',
                    footer: { text: `Use ${this.prefix}lb / ${this.prefix}ranks to see the top 20 players. ${this.prefix}top to see the best player` }
                }
            }); return
        }
        mess.channel.send({
            embed: {
                title: `Leaderboard for ${mess.guild.name}`,
                fields: fields,
                footer: { text: `Use ${this.prefix}lb / ${this.prefix}ranks to see the top 20 players. ${this.prefix}top to see the best player` }
            }
        })
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
                    if (!data.success) self.track?.update('error', false)
                    self.track?.update('finished', true, data.out)
                    obj['success'] = data.success
                    obj['out'] = data.out
                    obj['soft'] = data.soft
                    fs.writeFileSync(`${IMAGEDIR}${id}/results.json`, JSON.stringify(obj, null, 2))
                })
                .catch((data: any) => {
                    self.track?.update('error', false)
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
                                self.track?.update('error', false)
                                debug(err)
                                reject(err)
                            }
                            debug(info)
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
        debug(`Worker %: ${Math.floor(work.progress * 10000) / 100}`)
        if (work.status == 'recognizing text') CLIENT.track?.update('updated', true, `${Math.floor(work.progress * 10000) / 100}`) //TODO make 4/7 points 
    }
    public async imageText(url: string): Promise<string> {
        if (!this.worker) throw new Error('Worker has not been initialized')
        const { data: { text } } = await this.worker.recognize(url)
        await this.free()
        return text
    }
    private async free(): Promise<void> {
        if (this.worker) await this.worker.terminate().then(() => { debug('Terminated Worker') }).catch((err: any) => debug(err))
        this.worker = null
    }
}

(function () {
    var p: string
    if (minimist != null) {
        if (typeof minimist == "object") {
            if (minimist.hasOwnProperty(p = 'debug')) {
                DEBUG_G = minimist[p]
            }
        }
    }
    BOARD_G = new LeaderBoard()
    CLIENT = new Discord()
})()