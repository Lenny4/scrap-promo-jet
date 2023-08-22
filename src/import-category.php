<?php

// https://woocommerce.github.io/woocommerce-rest-api-docs/

$years = json_decode(file_get_contents(__DIR__ . '/data/years.json'), true);
$models = [];
$bundles = [];
$products = [];
$product = [];

function getProductIdentifier(array $product): string
{
    return implode('-', $product["partNumbers"]);
}

foreach (
    json_decode(file_get_contents(__DIR__ . '/data/models.json'), true, 512, JSON_THROW_ON_ERROR)
    as $model) {
    if (count($model['years']) !== 1) {
        throw new UnexpectedValueException();
    }
    if (!isset($models[$model["years"][0]])) {
        $models[$model["years"][0]] = [];
    }
    $models[$model["years"][0]][] = $model;
}

foreach (
    json_decode(file_get_contents(__DIR__ . '/data/bundles.json'), true, 512, JSON_THROW_ON_ERROR)
    as $bundle) {
    if (isset($bundles[$bundle["url"]])) {
        throw new UnexpectedValueException();
    }
    $bundles[$bundle["url"]] = $bundle;
}

foreach (
    json_decode(file_get_contents(__DIR__ . '/data/products.json'), true, 512, JSON_THROW_ON_ERROR)
    as $product) {
    $products[getProductIdentifier($product)] = $product;
}

function createCategory(
    string $name,
    int    $parentId,
    string $display, // Options: `default`, `products`, `subcategories`, `both`
): int
{
    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => 'http://caddy/wp-json/wc/v3/products/categories',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => array('name' => $name, 'parent' => (string)$parentId, 'display' => $display),
        CURLOPT_HTTPHEADER => array(
            'Content-Type: multipart/form-data',
            'Authorization: Basic YWRtaW46MXd1VCB6d3pJIGRPVlUgc043cCBvTTdFIFhPdkg='
        ),
    ));

    $response = curl_exec($curl);

    curl_close($curl);
    return json_decode($response, true, 512, JSON_THROW_ON_ERROR)['id'];
}

function postMedia(array $bundle): ?int
{
    if (count($bundle["images"]) === 0) {
        return null;
    }
    $curl = curl_init();
    $extension = pathinfo($bundle["images"][0], PATHINFO_EXTENSION);
    $filePath = __DIR__ . '/data/img/' . str_replace('/', '-', $bundle['url']) . '.' . $extension;
    if (!file_exists($filePath)) {
        throw new UnexpectedValueException();
    }
    curl_setopt_array($curl, array(
        CURLOPT_URL => 'http://caddy/wp-json/wp/v2/media',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POST => 1,
        CURLOPT_POSTFIELDS => file_get_contents($filePath),
        CURLOPT_HTTPHEADER => array(
            'Content-Disposition: form-data; filename="' . $bundle["text"] . '.' . $extension . '"',
            'Content-Type: image/' . $extension,
            'Authorization: Basic YWRtaW46MXd1VCB6d3pJIGRPVlUgc043cCBvTTdFIFhPdkg=',
        ),
    ));

    $response = curl_exec($curl);

    curl_close($curl);
    return json_decode($response, true, 512, JSON_THROW_ON_ERROR)['id'];
}

function getProductPrice(array $product): string
{
    if (!empty($product["price2"])) {
        return trim(str_replace(['$', '€'], '', $product["price2"]));
    }
    if (!empty($product["price"])) {
        return number_format((float)trim(str_replace(['$', '€'], '', $product["price"])) * 1.1, 2, '.', '');
    }
    return "0";
}

function createBundle(array $bundle, array $categories, ?int $mediaId, array $createdProducts): int
{

    $curl = curl_init();
    $value = [];
    foreach ($bundle["products"] as $i => $product) {
        $identifier = getProductIdentifier($product);
        if (!isset($identifier)) {
            continue;
        }
        if (!isset($createdProducts[$identifier])) {
            continue;
        }
        $value[(string)($i + 1)] = [
            "id" => (int)$createdProducts[$identifier],
            "sku" => "",
            "qty" => isset($product['quantity']) ? (int)$product['quantity'] : 0,
        ];
    }
    curl_setopt_array($curl, array(
        CURLOPT_URL => 'http://caddy/wp-json/wc/v3/products',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => json_encode([
            "name" => $bundle["text"],
            "images" => $mediaId ? [["id" => $mediaId]] : [],
            "type" => "woosb",
            "categories" => array_map(static fn(int $catId) => ['id' => $catId], $categories),
            "attributes" => [
                [
                    "name" => "Lien source",
                    "position" => 0,
                    "visible" => false,
                    "variation" => false,
                    "options" => [
                        'https://www.ronniesmailorder.com' . $bundle["url"]
                    ]
                ]
            ],
            "meta_data" => [
                [
                    "key" => "woosb_ids",
                    "value" => $value
                ],
                [
                    "key" => "woosb_disable_auto_price",
                    "value" => "off"
                ],
                [
                    "key" => "woosb_discount",
                    "value" => ""
                ],
                [
                    "key" => "woosb_discount_amount",
                    "value" => ""
                ],
                [
                    "key" => "woosb_shipping_fee",
                    "value" => "whole"
                ],
                [
                    "key" => "woosb_optional_products",
                    "value" => "on"
                ],
                [
                    "key" => "woosb_manage_stock",
                    "value" => "off"
                ],
                [
                    "key" => "woosb_limit_each_min",
                    "value" => ""
                ],
                [
                    "key" => "woosb_limit_each_max",
                    "value" => ""
                ],
                [
                    "key" => "woosb_limit_each_min_default",
                    "value" => "off"
                ],
                [
                    "key" => "woosb_limit_whole_min",
                    "value" => ""
                ],
                [
                    "key" => "woosb_limit_whole_max",
                    "value" => ""
                ],
                [
                    "key" => "woosb_total_limits",
                    "value" => "off"
                ],
                [
                    "key" => "woosb_total_limits_min",
                    "value" => ""
                ],
                [
                    "key" => "woosb_total_limits_max",
                    "value" => ""
                ],
                [
                    "key" => "woosb_layout",
                    "value" => "unset"
                ]
            ]
        ], JSON_THROW_ON_ERROR),
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            'Authorization: Basic YWRtaW46MXd1VCB6d3pJIGRPVlUgc043cCBvTTdFIFhPdkg=',
        ),
    ));

    $response = curl_exec($curl);

    curl_close($curl);
    return json_decode($response, true, 512, JSON_THROW_ON_ERROR)['id'];
}

$createdProducts = [];

function createProductIfNotExists(array $product, array $categories, array &$createdProducts): int
{
    $identifier = getProductIdentifier($product);
    if (isset($createdProducts[$identifier])) {
        return $createdProducts[$identifier];
    }
    $curl = curl_init();
    $postfields = [
        "name" => !empty($product["name2"]) ? $product["name2"] : $product["name"],
        "regular_price" => (string)getProductPrice($product),
        "categories" => array_map(static fn(int $catId) => ['id' => $catId], $categories),
        "attributes" => [
            [
                "name" => "Numéro constructeur",
                "position" => 0,
                "visible" => true,
                "variation" => false,
                "options" => array_map(static function (string $partNumber) {
                    return $partNumber;
                }, $product["partNumbers"])
            ]
        ],
    ];
    curl_setopt_array($curl, array(
        CURLOPT_URL => 'http://caddy/wp-json/wc/v3/products',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => json_encode($postfields, JSON_THROW_ON_ERROR),
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            'Authorization: Basic YWRtaW46MXd1VCB6d3pJIGRPVlUgc043cCBvTTdFIFhPdkg=',
        ),
    ));
    $response = curl_exec($curl);
    curl_close($curl);
    $id = json_decode($response, true, 512, JSON_THROW_ON_ERROR)['id'];
    $createdProducts[$identifier] = $id;
    return $id;
}

// /usr/bin/php /home/alexandre/Documents/project/scrap-promo-jet/src/import-category.php
$parentId = 30;
foreach ($years as $year) {
    $yearId = createCategory($year["text"], $parentId, 'subcategories');
    $countModel = count($models[$year["text"]]);
    foreach ($models[$year["text"]] as $indexModel => $model) {
        $modelId = createCategory($model["text"], $yearId, 'subcategories');
        $countBundle = count($model["bundles"]);
        foreach ($model["bundles"] as $indexBundle => $bundleIndex) {
            echo 'doing year ' . $year["text"] . ' | model ' . ($indexModel + 1) . '/' . $countModel . ' | bundle ' . ($indexBundle + 1) . '/' . $countBundle . "\n";
            $bundle = $bundles[$bundleIndex];
            $productIds = [];
            foreach ($bundle["products"] as $product) {
                $identifier = getProductIdentifier($product);
                if (!isset($products[$identifier])) {
                    continue;
                }
                $productIds[] = createProductIfNotExists($products[$identifier], [$parentId, $yearId, $modelId], $createdProducts);
            }
            $mediaId = postMedia($bundle);
            $bundleId = createBundle($bundle, [$parentId, $yearId, $modelId], $mediaId, $createdProducts);
        }
    }
}
