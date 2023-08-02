<?php

$parentId = 30;

$bundles = json_decode(file_get_contents(__DIR__ . '/data/bundles.json'), true);
$models = json_decode(file_get_contents(__DIR__ . '/data/models.json'), true);
$products = json_decode(file_get_contents(__DIR__ . '/data/products.json'), true);
$years = json_decode(file_get_contents(__DIR__ . '/data/years.json'), true);

$curl = curl_init();

foreach ($models as $model) {
    if (count($model['years']) !== 1) {
        throw new UnexpectedValueException();
    }
}

foreach ($years as $year) {
    $t = 0;
}
