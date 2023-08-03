import fs from "fs";

const request = require('request');
const mergeImages = require('node-merge-images');
const Path = require('path');
const cliProgress = require('cli-progress');

const bundles = JSON.parse(fs.readFileSync('/home/alexandre/Documents/project/scrap-promo-jet/src/data/bundles.json', 'utf8'));

const download = (uri: string, filename: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        request.head(uri, (err: any, res: any, body: any) => {
            request(uri)
                .pipe(fs.createWriteStream(filename))
                .on('close', () => resolve(res.statusCode));
        });
    })
};

const start = async () => {
    console.log(bundles.length, ' to do');
    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar1.start(bundles.length, 0);
    let i = -1;
    for (const bundle of bundles) {
        i++;
        if (i > 0) {
            bar1.update(i);
        }
        const folderName = bundle.url.replaceAll('/', '-');
        // if (folderName !== '-oemparts-a-sea-62a373f5292e49162cb03f6f-crankcase-rotary-valve-2') {
        //     continue;
        // }
        const path = '/home/alexandre/Documents/project/scrap-promo-jet/src/data/img/' + folderName;
        const extension = bundle.images[0].split('.').pop();
        if (fs.existsSync(path + '.' + extension)) {
            continue;
        }
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
        let names: any = {};
        let nbLines = 0;
        let nbColumns = 0;
        let statusCode = 200;
        const downloadUrl = bundle.images[0].match(/.*assembly_files/)[0] + '/11/';
        while (statusCode === 200) {
            const filename = nbColumns + '_' + nbLines + '.' + extension;
            statusCode = await download(downloadUrl + filename, path + '/' + filename);
            if (statusCode !== 200 && nbColumns === 0 && nbLines === 0) {
                throw 'init image not found';
            }
            if (statusCode !== 200 && statusCode !== 404) {
                throw 'why statusCode !== 200 && statusCode !== 404';
            }
            nbLines++;
        }
        const maxLine = nbLines - 2;
        nbLines = 0;
        statusCode = 200;
        while (statusCode === 200) {
            nbColumns++;
            const filename = nbColumns + '_' + nbLines + '.' + extension;
            statusCode = await download(downloadUrl + filename, path + '/' + filename);
            if (statusCode !== 200 && statusCode !== 404) {
                throw 'why statusCode !== 200 && statusCode !== 404';
            }
        }
        const maxColumn = nbColumns - 1;
        for (let c = 0; c <= maxColumn; c++) {
            names[c] = [];
            for (let l = 0; l <= maxLine; l++) {
                const filename = c + '_' + l + '.' + extension;
                names[c].push(path + '/' + filename);
                if (l === 0 || c === 0) {
                    continue;
                }
                statusCode = await download(downloadUrl + filename, path + '/' + filename);
                if (statusCode !== 200) {
                    throw 'why 2 != 200';
                }
            }
        }
        const allKeys = [];
        for (const key in names) {
            await mergeImages(names[key].map((imgPath: string) => imgPath), path + '/' + key + '.' + extension);
            allKeys.push(key);
        }
        await mergeImages(allKeys.map((key) => path + '/' + key + '.' + extension), path + '.' + extension, {direction: 'horizontal'});
        fs.rmSync(path, {recursive: true, force: true});
    }
    bar1.stop();
}
start();
