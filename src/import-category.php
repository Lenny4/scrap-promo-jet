<?php
$parentId = 30;

$bundles = json_decode(file_get_contents(__DIR__ . '/data/bundles.json'), true);
$models = json_decode(file_get_contents(__DIR__ . '/data/models.json'), true);
$products = json_decode(file_get_contents(__DIR__ . '/data/products.json'), true);
$years = json_decode(file_get_contents(__DIR__ . '/data/years.json'), true);

$curl = curl_init();

foreach ($years as $year) {

}
