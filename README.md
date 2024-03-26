# PixieDB

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

A tiny javascript in memory database with indexing and sql like filters.

> [!WARNING]
> Please keep in mind that PixieDb is still in under active development.

## Usage
```ts
import { PixieDb } from "pixiedb";

const products = [
    { id: 1, name: "Apple", price: 5, category: "Fruit" },
    { id: 2, name: "Banana", price: 10, category: "Fruit" },
    { id: 3, name: "Grapes", price: 6, category: "Fruit" },
    { id: 4, name: "Orange", price: 8, category: "Fruit" },
    { id: 5, name: "Potato", price: 18, category: "Vegetable" },
    { id: 6, name: "Milk", price: 7, category: "Dairy" },
    // ...
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
const fruitBelow10 = pd.select(["id", "name", "price"]).eq("category", "Fruit").lte("price", 10).orderBy(["name", ["price", "desc"]]).range(2, 3).data()
console.log(fruitBelow10); // [{ id: 3, name: "Grapes", price: 6 }, ...]

const updatedBanana = pd.where().eq("name", "Banana").update({price: 100})
// [{ id: 2, name: "Banana", price: 100, category: "Fruit" }, ...]

// delete all docs where name equals "Apple"
const deletedApples = pd.where().eq("name", "Apple").delete()
// [{ id: 1, name: "Apple", price: 5, category: "Fruit"}, ...]
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


## Installation

```bash
# using npm
npm install pixiedb

# using pnpm
pnpm add pixiedb

# using yarn
yarn add pixiedb

# using bun
bun add pixiedb
```

## Docs

### PixieDb
This is a class which create an PixieDb instance to use.

```ts
// pass type/interface if using typescript
const pd = new PixieDb<Product>('id', ["price", "category"]) 

// or with data
const pd = new PixieDb<Product>('id', ["price", "category"], products)
```

### Methods

#### load
Used to import data without cloning (so don't mutate the data or clone before load).
Pass true as second parameter to clear the previous data and indexes state. (default: false).

```ts
pd.load(products)
// or
pd.load(products, true)
// remove previous data and index state
```

#### get
Get single doc/row using key (primary key/unique id).
Returns doc/row if present else undefined.

```ts
pd.get(2)
// { id: 2, name: "Banana", price: 10, category: "Fruit" }
```

#### select
Get single doc/row using key (primary key/unique id).
Returns doc/row if present else undefined.

```ts
pd.select().eq("category", "Fruit").gte("price", 6).data()
// [{ id: 2, name: "Banana", price: 10, category: "Fruit" }, { id: 3, name: "Grapes", price: 6, category: "Fruit" }, ...]

pd.select(["id", "name", "price"]).eq("category", "Fruit").lte("price", 6).data()
// [{ id: 1, name: "Apple", price: 5 }, ...]

pd.select().eq("category", "Fruit").between("price", [6, 10]).data()
// [{ id: 2, name: "Banana", price: 10, category: "Fruit" }, { id: 3, name: "Grapes", price: 6, category: "Fruit" }, { id: 4, name: "Orange", price: 8, category: "Fruit" }, ...]
```

#### where
used to perform delete/update with complex filtering
```ts
// this will delete and return all the docs according to the filters
pd.where().eq("category", "Fruit").gte("price", 6).delete()
// [{ id: 2, name: "Banana", price: 10, category: "Fruit" }, { id: 3, name: "Grapes", price: 6, category: "Fruit" }, ...]

pd.where().eq("category", "Fruit").between("price", [6, 10]).update({price: 11})
// [{ id: 2, name: "Banana", price: 11, category: "Fruit" }, { id: 3, name: "Grapes", price: 11, category: "Fruit" }, { id: 4, name: "Orange", price: 11, category: "Fruit" }, ...]
```

#### data
Get all docs/rows ordered respect to primary key/unique id.
Pass false to get all without clone (don't modify). default: true
```ts
pd.data()
// [{ id: 1, name: "Apple", price: 5, category: "Fruit" }, ...]
```

#### count
Get all docs/rows ordered respect to primary key/unique id.
Pass false to get all without clone (don't modify). default: true
```ts
pd.select().count()
// 6

pd.select().eq("category", "Fruit").between("price", [6, 10]).count()
// 4
```

#### close
to close/quit/terminate the database and remove all data/indexes and fire "Q" ("quit") event.
Pass true to not emit events. default: false
```ts
pd.close()
// or
pd.close(true) // doesn't fire event
```

#### toJson
return JSON of all data (without cloning), key and index names.
```ts
pd.toJSON()
// { key: "id", indexes: ["price", "category", {name: "id", unique: true}], data: [{ id: 1, name: "Apple", price: 10, category: "Fruit" }, ...]

// this will call the above toJSON method
JSON.stringify(pd)
```


[view more](https://github.com/pixiedevpraveen/pixiedb/tree/master/README.md)
