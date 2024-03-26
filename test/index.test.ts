import { assert, describe, test, type TestOptions } from 'vitest'
import { type Product, products, filtedSortedProducts } from './common';
import { PixieDb } from "../src";
import { SortOptions } from '../src/types';

const testOpt: TestOptions = { timeout: 1000 }

const key = 'id'
const indexes: Array<keyof Product> = ["price", "category"]

const db = new PixieDb<Product, "id">(key, indexes)


const sortOptions: SortOptions<Product> = ["name", ["price", "desc"]]
const filterFields: Array<keyof Product> = ["id", "name", "price"]
const selectFilterExpect = filtedSortedProducts(sortOptions, filterFields)

const inLen = 10
const inKeys = [1, 2, 3, 4, 7, 8, 9, 10]
const nInKeys = [1, 5, 6, 7, 8, 9, 10]

describe('PixieDb test', () => {
  test('db created', () => {
    assert.instanceOf(db, PixieDb)
  })

  test('has key', () => {
    assert.equal(db.key, key)
  })

  test('has all indexes', () => {
    assert.deepEqual(db.indexes, indexes)
  })

  test('Import data', () => {
    db.load(products)
    assert.lengthOf(db.data(), products.length)
  })

  test('Get by key', () => {
    const p1 = products[0]
    assert.deepStrictEqual(db.get(p1.id), p1)
  })

  test('Select one record', () => {
    const p1 = products[0]
    assert.deepEqual(db.select().eq("id", p1.id).single(), p1)
  })

  test('Select all records', () => {
    assert.deepEqual(db.select().data(), products)
  })

  test('Fruit gte 10, range 3-3, order ' + sortOptions, () => {
    assert.deepEqual(
      db.select(filterFields).eq("category", "Fruit").gte("price", 10).range(3, 3).orderBy(sortOptions).data(),
      selectFilterExpect
    )
  })

  test('Products lte 612', () => {
    assert.deepEqual(
      db.select().lte("price", 612).orderBy(["id"]).data(),
      products.filter(p => p.price <= 612)
    )
  })

  test('Products in ' + inKeys, () => {
    const kSet = new Set(inKeys)
    assert.deepEqual(
      db.select().in("price", inKeys).range(0, inLen).orderBy(["id"]).data(),
      products.filter(p => kSet.has(p.price)).slice(0, inLen)
    )
  })

  test('Products nin ' + nInKeys, () => {
    const kSet = new Set(nInKeys)
    assert.deepEqual(
      db.select().nin("price", inKeys).range(0, inLen).orderBy(["id"]).data(),
      products.filter(p => !kSet.has(p.price)).slice(0, inLen)
    )
  })

  test('Products lt 612', () => {
    assert.deepEqual(
      db.select().lt("price", 612).orderBy(["id"]).data(),
      products.filter(p => p.price < 612)
    )
  })

  test('Products gte 612', () => {
    assert.deepEqual(
      db.select().gte("price", 612).orderBy(["id"]).data(),
      products.filter(p => p.price >= 612)
    )
  })

  test('Products gt 612', () => {
    assert.deepEqual(
      db.select().gt("price", 612).orderBy(["id"]).data(),
      products.filter(p => p.price > 612)
    )
  })

  test('Products btw 500-700', () => {
    assert.deepEqual(
      db.select().between("price", [500, 700]).orderBy(["id"]).data(),
      products.filter(p => p.price >= 500 && p.price <= 700)
    )
  })

  test('Products nbtw 500-700', () => {
    assert.deepEqual(
      db.select().nbetween("price", [500, 700]).orderBy(["id"]).data(),
      products.filter(p => p.price < 500 || p.price > 700)
    )
  })

  const crudProd = products[10]
  test('Update product with id ' + crudProd.id, () => {
    assert.deepEqual(
      db.where().eq("id", crudProd.id).update({ price: 122 }),
      [{ ...crudProd, ...{ price: 122 } }]
    )
  })

  test('Delete product with id ' + crudProd.id, () => {
    assert.deepEqual(
      db.where().eq("id", crudProd.id).delete(),
      [crudProd]
    )
  })
  test('confirm deleted product with id ' + crudProd.id, () => {
    assert.deepEqual(
      db.select().eq("id", crudProd.id).single(),
      undefined
    )
  })

}, testOpt)
