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
        const extension = bundle.images[0].split('.').pop();
        if (fs.existsSync(path + '.' + extension) && !path.includes('500d8f71f870020908258799-magneto')) {
            continue;
        }
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
        let names: any = {};
        let currentKey = 0;
        let nbImages;
        if (
            bundle.images.length === 6 ||
            bundle.images.length === 8
        ) {
            nbImages = Math.floor(bundle.images.length / 2);
        } else if (
            bundle.images.length === 9 ||
            bundle.images.length === 10 ||
            bundle.images.length === 12
        ) {
            nbImages = Math.floor(bundle.images.length / 3);
        } else if (
            bundle.images.length === 20
        ) {
            nbImages = Math.floor(bundle.images.length / 5);
        } else if (
            bundle.images.length === 30
        ) {
            console.log("skipped ", bundle.url)
            continue;
        } else {
            console.log("skipped ", bundle.url, bundle.images.length)
            continue;
        }
        for (const imgUrl of bundle.images) {
            let filename = imgUrl.replaceAll('/', '-');
            await download(imgUrl, path + '/' + filename);
            if (!names.hasOwnProperty(currentKey)) {
                names[currentKey] = [];
            }
            if (names[currentKey].length >= nbImages) {
                currentKey++;
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
