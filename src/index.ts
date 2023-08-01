// https://khalilstemmler.com/blogs/typescript/node-starter-project/
'use strict';

import PuppeteerService from "./Service/PuppeteerService";
import {Page} from "puppeteer";

const fs = require('fs');

const hostname = 'https://www.ronniesmailorder.com';

let years: any[] = [];
let models: any[] = [];
let bundles: any[] = [];
let products: any[] = [];

async function getYearsToDo(page: Page): Promise<any[]> {
    // @ts-ignore
    return (await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            var years: any[] = [];
            $('ul.partsubselect > li').each((i, element) => {
                years.push({
                    text: $(element).text().trim(),
                    url: $(element).find('a').attr('href'),
                });
            });
            resolve(years);
        });
    }))
        .filter((yearToDo: any) => yearToDo.url && years.find((year) => year.url === yearToDo.url) === undefined)
        .reverse();
}

async function getAllModelsForYear(page: Page): Promise<any[]> {
    // @ts-ignore
    return (await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            var models: any[] = [];
            $('ul.partsubselect > li').each((i, element) => {
                models.push({
                    text: $(element).text().trim(),
                    url: $(element).find('a').attr('href'),
                });
            });
            resolve(models);
        });
    })).filter((modelForYear: any) => modelForYear.url);
}

async function getBundlesToDo(page: Page): Promise<any[]> {
    // @ts-ignore
    return (await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            var years: any[] = [];
            $('#partassemthumblist > div').each((i, element) => {
                years.push({
                    text: $(element).find('.passemname').text().trim(),
                    url: $(element).find('.passemname a').attr('href'),
                });
            });
            resolve(years);
        });
    }))
        .filter((bundleToDo: any) => bundleToDo.url && bundles.find((bundle) => bundle.url === bundleToDo.url) === undefined);
}

async function getProductsForBundle(page: Page): Promise<any[]> {
    // @ts-ignore
    return (await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            var products: any[] = [];
            $('.partlistrow').each((i, element) => {
                var partNumbers: any[] = [];
                $(element).find('.c1b a').map(function () {
                    partNumbers.push($(this).text().trim());
                })
                products.push({
                    ref: $(element).find('.c0').text().trim(),
                    name: $(element).find('.c1 .c1a').text().trim(),
                    price: $(element).find('.c2').text().trim(),
                    quantity: $(element).find('.c3 input').val(),
                    partNumbers: partNumbers,
                });
            });
            resolve(products);
        });
    }))
        .filter((productToDo: any) => productToDo.partNumbers.length > 0);
}

async function scrapBundle(page: Page, bundle: any) {
    await PuppeteerService.goTo(page, hostname + bundle.url);
    let imagesOk = false;
    try {
        await page.waitForSelector('#diagram img');
        imagesOk = true;
    } catch (e) {
        // nothing
    }
    const productBundles = await getProductsForBundle(page);
    bundle.products = productBundles.map((p) => {
        return {
            ref: p.ref,
            partNumbers: p.partNumbers,
            quantity: p.quantity,
        }
    });
    bundle.images = [];
    let attempt = 0;
    if (imagesOk) {
        while (bundle.images.length !== 6 && attempt < 10) {
            bundle.images = await page.evaluate(() => {
                var images: any[] = [];
                $('#diagram img').each((i, element) => {
                    images.push({
                        src: $(element).attr('src'),
                        style: $(element).attr('style'),
                    });
                });
                return images;
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            attempt++;
        }
    }
    for (let productBundle of productBundles) {
        let found = false;
        for (const partNumber of productBundle.partNumbers) {
            if (found) {
                break;
            }
            found = products.find((p) => p.partNumbers.includes(partNumber)) !== undefined
        }
        if (found) {
            continue;
        }
        if ((new URL(page.url())).hostname !== 'www.pieces-sea-doo.fr') {
            await PuppeteerService.goTo(page, 'https://www.pieces-sea-doo.fr/seadoo-motomarine/affectation_pieces_detachees');
        }
        await page.type('#chercher_reference', productBundle.partNumbers[productBundle.partNumbers.length - 1]);
        await page.click('button[type="submit"]');
        await page.waitForSelector('div[itemprop="name"], .border-warning .bi-info-square');
        const productData = await page.evaluate(() => {
            if ($('div[itemprop="name"]').length === 0) {
                return null;
            }
            return {
                name: $('div[itemprop="name"]').text().trim(),
                price: $('span[itemprop="price"]').text().trim()
            }
        });
        if (productData) {
            productBundle.name2 = productData.name;
            productBundle.price2 = productData.price;
        }
        products.push(productBundle);
    }
}

async function scrapModel(page: Page, model: any) {
    await PuppeteerService.goTo(page, hostname + model.url);
    const bundlesToDo: any[] = await getBundlesToDo(page);
    for (const bundleToDo of bundlesToDo) {
        await scrapBundle(page, bundleToDo);
        bundles.push(bundleToDo);
        model.bundles.push(bundleToDo.url);
    }
}

async function scrapYear(page: Page, year: any) {
    await PuppeteerService.goTo(page, hostname + year.url);
    const allModelsForYear: any[] = await getAllModelsForYear(page);
    const modelsToDo: any[] = allModelsForYear.filter((allModelForYear) => models.find((model) => model.url === allModelForYear.url) === undefined);
    for (const modelToDo of modelsToDo) {
        modelToDo.years = [];
        modelToDo.bundles = [];
        models.push(modelToDo);
    }
    for (const model of models) {
        if (
            !model.years.includes(year.text) &&
            allModelsForYear.find(allModelForYear => allModelForYear.url === model.url) !== undefined
        ) {
            model.years.push(year.text);
        }
    }
    for (const modelToDo of modelsToDo) {
        await scrapModel(page, modelToDo);
    }
    years.push(year);
}

function initData() {
    if (!fs.existsSync('/srv/app/src/data/years.json')) {
        fs.writeFileSync('/srv/app/src/data/years.json', JSON.stringify([]));
    }
    if (!fs.existsSync('/srv/app/src/data/models.json')) {
        fs.writeFileSync('/srv/app/src/data/models.json', JSON.stringify([]));
    }
    if (!fs.existsSync('/srv/app/src/data/bundles.json')) {
        fs.writeFileSync('/srv/app/src/data/bundles.json', JSON.stringify([]));
    }
    if (!fs.existsSync('/srv/app/src/data/products.json')) {
        fs.writeFileSync('/srv/app/src/data/products.json', JSON.stringify([]));
    }
    years = JSON.parse(fs.readFileSync('/srv/app/src/data/years.json', 'utf8'));
    models = JSON.parse(fs.readFileSync('/srv/app/src/data/models.json', 'utf8'));
    bundles = JSON.parse(fs.readFileSync('/srv/app/src/data/bundles.json', 'utf8'));
    products = JSON.parse(fs.readFileSync('/srv/app/src/data/products.json', 'utf8'));
}

(async () => {
    initData();
    const browser = await PuppeteerService.createBrowser();
    const page = await PuppeteerService.createPage(browser);
    await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.2.1.min.js'})
    await PuppeteerService.goTo(page, hostname + '/oemparts/c/sea_doo_personal_watercraft/parts');
    const yearsToDo: any[] = await getYearsToDo(page);
    for (const yearToDo of yearsToDo) {
        console.log('doing year ' + yearToDo.text + ' ...');
        await scrapYear(page, yearToDo);
        fs.writeFileSync('/srv/app/src/data/years.json', JSON.stringify(years));
        fs.writeFileSync('/srv/app/src/data/models.json', JSON.stringify(models));
        fs.writeFileSync('/srv/app/src/data/bundles.json', JSON.stringify(bundles));
        fs.writeFileSync('/srv/app/src/data/products.json', JSON.stringify(products));
    }
    console.log('finished !');
})();
