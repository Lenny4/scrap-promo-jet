'use strict';

import puppeteer, {Browser, HTTPRequest, Page, PuppeteerLaunchOptions} from 'puppeteer';
import * as fs from "fs";
import path from "path";

export default class PuppeteerService {
    public static blockResourceType: string[] = [];

    public static async createBrowser(): Promise<Browser> {
        // https://peter.sh/experiments/chromium-command-line-switches/
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized',
            '--disable-notifications',
        ];
        const cacheDirectoryPath = './cache/orbitx';
        const options: PuppeteerLaunchOptions | undefined = {
            headless: false,
            defaultViewport: {width: 0, height: 0},
            args: args,
            userDataDir: cacheDirectoryPath,
        };
        try {
            fs.unlinkSync(cacheDirectoryPath + '/Default/Preferences'); // prevent Chromium to display "Restore Pages?"
        } catch (err) {
            // nothing
        }
        try {
            // https://github.com/puppeteer/puppeteer/issues/4860
            const files = fs.readdirSync(cacheDirectoryPath);
            for (const file of files) {
                if (file.match('Singleton')) {
                    const filePath = path.join(cacheDirectoryPath, file)
                    fs.unlinkSync(filePath)
                }
            }
        } catch (err) {
            // nothing
        }
        return await puppeteer.launch(options);
    }

    public static async closePage(page: Page) {
        await page.goto('about:blank');
        await page.close();
    }

    public static async goTo(page: Page, url: string) {
        let response = await page.goto(url);
        while (response === null || response.status() !== 200) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            response = await page.goto(url);
        }
    }

    public static async createPage(browser: Browser | null): Promise<Page> {
        if (browser === null) {
            throw 'createPage browser is null';
        }
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req: HTTPRequest) => {
            if (this.blockResourceType.includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });
        return page;
    }
}
