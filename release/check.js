(function () {
    const axios = require('axios').default
    const fs = require('fs')
    const adm = require('adm-zip')
    const path = require('path')
    var args = process.argv.slice(2)
    function unzip() {
        const zip = new adm('temp.zip')
        zip.extractAllTo('../', true)
        console.log('Unzipping complete..\nDeleting temp.zip..')
        fs.unlinkSync('./temp.zip')
        console.log('Delete complete..\nAdd your own Discord Bot token to src/bot_config.json..\nInstalling local packages..')
        process.exit(0)
    }
    if (args.includes('--install')) {
        axios.get('https://github.com/B1ANK3/Discord_100KC/blob/Proto_Install/.bin/binaries.zip?raw=true', { method: 'GET', responseType: 'stream' })
            .then((res) => {
                if (res.status == 200) {
                    const dir = path.resolve(__dirname, './temp.zip')
                    res.data.pipe(fs.createWriteStream(dir))
                        .on('finish', () => {
                            console.log('Download complete.. \nUnzipping..')
                            unzip()
                        })
                } else {
                    console.log(`ERROR >> ${res.status}`)
                }
            }).catch(err => {
                console.error(`Failed to install: ${err}`)
                process.exit(1)
            })
    } else if (args.includes('--update')) {

    } else {
        console.warn(`bad option: ${args}`)
    }
})()
