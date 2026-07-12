import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');

const BASE_URLS = {
    static: 'https://cdn.discordapp.com/assets/content',
    animated: 'https://cdn.discordapp.com/assets/content',
};

async function downloadFile(url, filepath) {
    if (!url) return;
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = url.includes('.webp')
            ? 'webp'
            : url.includes('.png')
            ? 'png'
            : 'gif';
        const finalPath = `${filepath}.${ext}`;
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });
        fs.writeFileSync(finalPath, buffer);
    } catch (error) {
        console.error(`Failed to download ${url}:`, error.message);
    }
}

function extractUrls(obj, prefix = '') {
    const urls = [];
    if (!obj || typeof obj !== 'object') return urls;

    for (const [key, value] of Object.entries(obj)) {
        if (
            typeof value === 'string' &&
            value.startsWith('https://cdn.discordapp.com/assets/')
        ) {
            urls.push({ url: value, name: `${prefix}${key}` });
        } else if (typeof value === 'object') {
            urls.push(...extractUrls(value, `${prefix}${key}_`));
        }
    }
    return urls;
}

function extractAssetIds(obj, prefix = '') {
    const ids = [];
    if (!obj || typeof obj !== 'object') return ids;

    for (const [key, value] of Object.entries(obj)) {
        if (key === 'id' && typeof value === 'string' && value.match(/^\d+$/)) {
            ids.push({ id: value, name: prefix.replace(/_$/, '') || 'layer' });
        } else if (typeof value === 'object') {
            ids.push(...extractAssetIds(value, `${prefix}${key}_`));
        }
    }
    return ids;
}

async function processJsonFile(filename) {
    const filepath = path.join(DATA_DIR, filename);
    console.log(`Fetching ${filename}...`);
       const url = `https://api.yapper.shop/v4/collectibles-pages/${filename.replace('.json', '')}?static_api=true`;
    
    const response = await fetch(url, {
        headers: {
            "referer": "https://yapper.shop/",
            "origin": "https://yapper.shop"
        }
    });
    const data = await response.json();
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    const content = fs.readFileSync(filepath, 'utf8');
    const items = Array.isArray(data) ? data : [data];

    console.log(`Processing ${filename}...`);

    for (const page of items) {
        const urls = extractUrls(page);
        for (const { url, name } of urls) {
            const hash = url.split('/').pop();
            const ext = url.includes('.webm')
                ? 'webm'
                : url.includes('.webp')
                ? 'webp'
                : url.includes('.png')
                ? 'png'
                : 'gif';
            const outPath = path.join(ASSETS_DIR, `${name}_${hash}.${ext}`);
            await downloadFile(url, outPath);
        }

        if (page.products) {
            for (const product of page.products) {
                const productUrls = extractUrls(product);
                for (const { url, name } of productUrls) {
                    const hash = url.split('/').pop();
                    const outPath = path.join(
                        ASSETS_DIR,
                        `${product.sku_id}_${name}_${hash}`,
                    );
                    await downloadFile(url, outPath);
                }

                if (product.items) {
                    for (const item of product.items) {
                        const itemUrls = extractUrls(item);
                        for (const { url, name } of itemUrls) {
                            const hash = url.split('/').pop();
                            const outPath = path.join(
                                ASSETS_DIR,
                                `${item.id || item.sku_id}_${name}_${hash}`,
                            );
                            await downloadFile(url, outPath);
                        }

                        if (item.effects) {
                            for (const effect of item.effects) {
                                const effectUrls = extractUrls(effect);
                                for (const { url, name } of effectUrls) {
                                    const hash = url.split('/').pop();
                                    const outPath = path.join(
                                        ASSETS_DIR,
                                        `effect_${
                                            effect.sku_id || item.sku_id
                                        }_${name}_${hash}`,
                                    );
                                    await downloadFile(url, outPath);
                                }
                            }
                        }

                        if (item.layers) {
                            for (const layer of item.layers) {
                                if (layer.id) {
                                                  const assetUrl = `https://api.yapper.shop/v4/assets/${layer.id}`;
                                
                                const response = await fetch(assetUrl, {
                                    headers: {
                                        "referer": "https://yapper.shop/",
                                        "origin": "https://yapper.shop"
                                    }
                                });
                                    if (response.ok) {
                                        const assetData = await response.json();
                                        const assetUrls =
                                            extractUrls(assetData);
                                        for (const { url, name } of assetUrls) {
                                            const hash = url.split('/').pop();
                                            const outPath = path.join(
                                                ASSETS_DIR,
                                                `layer_${layer.id}_${name}_${hash}`,
                                            );
                                            await downloadFile(url, outPath);
                                        }
                                    }
                                }
                            }
                        }

                        if (item.assets) {
                            for (const [assetKey, assetValue] of Object.entries(
                                item.assets,
                            )) {
                                if (
                                    typeof assetValue === 'string' &&
                                    assetValue.startsWith('https://')
                                ) {
                                    const hash = assetValue.split('/').pop();
                                    const outPath = path.join(
                                        ASSETS_DIR,
                                        `${
                                            item.id || item.sku_id
                                        }_${assetKey}_${hash}`,
                                    );
                                    await downloadFile(assetValue, outPath);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    console.log(`Finished processing ${filename}`);
}

async function main() {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });

    const files = ['miscellaneous.json', 'catalog.json'];

    for (const file of files) {
        await processJsonFile(file);
    }

    console.log('Archive complete!');
}

main().catch(console.error);
