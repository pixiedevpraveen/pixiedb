# PixieDB

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

A tiny in-memory javascript database with indexing and SQL like filters.

## Features
 - Speed - PixieDb perform get in the O(1) and other all operations (insert, delete, select*) in log(n) time. Can perform get operation with unique index (18M ops/s) and binary-index (5M ops/s) which is 15-20 times faster than [lokijs/lokidb](https://github.com/techfort/LokiJS).
 - Quick load - loads data 20x faster than [lokijs/lokidb](https://github.com/techfort/LokiJS).
 - Realtime filtering - perform filtering and event calling in realtime.
 - Memory efficient - use iterators and Binary indexes (red black tree) for indexes to perform filtering.
 - Events - notifies you about load, insert, update, delete, and quit to sync your state with the database.
 - Indexes = for fast filtering.
 - Chaining = supports filter chaining.


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
// 3rd param data is optional, Can be loaded after using the load method
const pd = new PixieDb('id', ["price", "category"], products) 
// or
const pd = new PixieDb<Product>('id', ["price", "category"]) // pass type if using typescript
pd.load(products) // to load data later

const byId = pd.select().eq("id", 2).single()
console.log(byId); // { id: 2, name: "Banana", price: 10, category: "Fruit" }

// can also pass an array of fields to select method to pick only those fields/properties
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
This is a class which creates an PixieDb instance to use.

```ts
// pass type/interface if using typescript
const pd = new PixieDb<Product>('id', ["price", "category"]) 

// or with data
const pd = new PixieDb<Product>('id', ["price", "category"], products)
```

### Methods

#### load
Used to import data without cloning (so don't mutate the data or clone before load).
Pass true as second parameter to clear the previous data and indexes state. (Default: false).

```ts
pd.load(products)
// or
pd.load(products, true)
// remove previous data and index state
```

#### get
Get single doc/row using key (primary key/unique id).
Returns doc/row, if present else undefined.

```ts
pd.get(2)
// { id: 2, name: "Banana", price: 10, category: "Fruit" }
```

#### select
Get single doc/row using key (primary key/unique id).
Returns doc/row, if present else undefined.

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
Get all docs/rows ordered respecting to primary key/unique id.
Pass false to get all without clone (don't modify). Default: true
```ts
pd.data()
// [{ id: 1, name: "Apple", price: 5, category: "Fruit" }, ...]
```

#### count
Get all docs/rows ordered respecting to primary key/unique id.
Pass false to get all without clone (don't modify). Default: true
```ts
pd.select().count()
// 6

pd.select().eq("category", "Fruit").between("price", [6, 10]).count()
// 4
```

#### close
to close/quit/terminate the database and remove all data/indexes and fire "Q" ("quit") event.
Pass true to not emit events. Default: false
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


## Roadmap
 - [X] load docs
 - [X] get all docs
 - [X] get docs with key
 - [X] Events (load, change, insert, update, delete, quit)
 - [X] orderBy with multiple keys (sorting)
 - [X] single doc with filters
 - [X] count of docs with filters
 - [X] update of docs with filters
 - [X] delete of docs with filters
 - [ ] Plugin support
 - [ ] Unique indexes (currently override the previous)
 - [X] filters
     - [X] eq (equal)
     - [X] neq (not equal)
     - [X] in (value in)
     - [X] nin (value not in)
     - [X] between - values within a given range (>= and <=). begin and end values are included.
     - [X] nbetween - values not within a given range (< or >). begin and end values are not included.
     - [X] gt (greater than)
     - [X] gte (greater than or equal to)
     - [X] lt (less than)
     - [X] lte (less than or equal to)
     - [ ] custom query method
 - [X] range offset (from) and count (limit of docs to return)
 - [ ] multiple tables
 - [ ] joins
 - [ ] changes api
 - [ ] custom clone method
 - [ ] custom compare method
 - [ ] views
    - [ ] Basic views
    - [ ] Materialized views (persist)
 - [ ] plugins
    - [ ] persist (localStorage, indexedb)
    - [ ] sync with other databases
    - [ ] sync with browser tabs
    - [ ] transaction


## Other Details
### query filters that use binary index (perform operation in log(n))
 - eq
 - in
 - between log(n) + count of docs between
 - gt log(n) + count of docs
 - gte log(n) + count of docs
 - lt log(n) + count of docs
 - lte log(n) + count of docs

### other query filters 
 - neq O(n)
 - nin O(n)
 - nbetween log(n) + count of docs (where value less than or equal to)
