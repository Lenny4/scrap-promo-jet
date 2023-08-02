import fs from "fs";

const request = require('request');
const mergeImages = require('node-merge-images');
const Path = require('path');
const cliProgress = require('cli-progress');

const bundles = JSON.parse(fs.readFileSync('/home/alexandre/Documents/project/scrap-promo-jet/src/data/bundles.json', 'utf8'));

const download = (uri: string, filename: string) => {
    return new Promise((resolve, reject) => {
        request.head(uri, (err: any, res: any, body: any) => {
            request(uri).pipe(fs.createWriteStream(filename)).on('close', resolve);
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
        const path = '/home/alexandre/Documents/project/scrap-promo-jet/src/data/img/' + folderName;
        const extension = bundle.images[0].src.split('.').pop();
        if (fs.existsSync(path + '.' + extension) && !path.includes('500d8f71f870020908258799-magneto')) {
            continue;
        }
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
        let names: any = {};
        for (const img of bundle.images) {
            let filename = img.src.replaceAll('/', '-');
            const currentKey = img.style.match(/matrix\(.*\)/)[0].split(',')[4];
            await download(img.src, path + '/' + filename);
            if (!names.hasOwnProperty(currentKey)) {
                names[currentKey] = [];
            }
            names[currentKey].push(path + '/' + filename);
        }
        const allKeys = [];
        for (const key in names) {
            await mergeImages(names[key].reverse().map((imgPath: string) => imgPath), path + '/' + key + '.' + extension);
            allKeys.push(key);
        }
        await mergeImages(allKeys.reverse().map((key) => path + '/' + key + '.' + extension), path + '.' + extension, {direction: 'horizontal'});
        fs.rmSync(path, {recursive: true, force: true});
    }
    bar1.stop();
}
start();
