# PixieDB

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

A tiny javascript in memory database with indexing and sql like filters.

> [!WARNING]
> Please keep in mind that PixieDb is still in under active development.

## Installation

```bash
npm install pixiedb
```

```ts
import { PixieDb } from "pixiedb";

const products = [
    { id: 1, name: "Apple", price: 5, category: "Fruit" },
    { id: 2, name: "Banana", price: 10, category: "Fruit" },
    { id: 3, name: "Grapes", price: 6, category: "Fruit" },
    { id: 4, name: "Orange", price: 8, category: "Fruit" },
    { id: 5, name: "Potato", price: 18, category: "Vegetable" },
    { id: 6, name: "Milk", price: 7, category: "Dairy" },
]

// provide unique key, data and indexes for better performance
// 3rd param data is optional can be load after using the load method
const pd = new PixieDb('id', ["price", "category"], products) 
// or
const pd = new PixieDb<Product>('id', ["price", "category"]) // pass type if using typescript
pd.load(products) // to load data later

const byId = pd.select().eq("id", 2).single()
console.log(byId); // { id: 2, name: "Banana", price: 10, category: "Fruit" }

// can also pass array of fields to select method to pick only those fields/properties
const fruitBelow10 = pd.select(["id", "name", "price"]).eq("category", "Fruit").lte("price", 10).orderBy("name", ["price", "desc"]).range(2, 3).data()
console.log(fruitBelow10); // [{ id: 3, name: "Grapes", price: 6 }, {...}, {...}]

const updatedBanana = pd.where().eq("name", "Banana").update({price: 100})
const deletedApples = pd.where().eq("name", "Apple").delete()

```
<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/pixiedb?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/pixiedb
[npm-downloads-src]: https://img.shields.io/npm/dm/pixiedb?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/pixiedb
[bundle-src]: https://img.shields.io/bundlephobia/minzip/pixiedb?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=pixiedb
[license-src]: https://img.shields.io/github/license/pixiedevpraveen/pixiedb.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/pixiedevpraveen/pixiedb/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/pixiedb
