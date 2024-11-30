import { EvEmit } from './EvEmit'
import { ResultSet } from './ResultSet'
import { PDBError } from './error'
import { deepClone, freeze, hasOwn, isArray, toArray } from './utils'
import type { Index, SelectQueryBuilder, WhereQueryBuilder } from './types'
import { BinaryIndex } from './BinaryIndex'

/**
 * -----------------------------------------------------
 * A tiny in-memory javascript database with indexing and filters.
 *
 * @author Praveen yadav
 * @see https://github.com/pixiedevpraveen/pixiedb/tree/master/README.md
 * ---
 * @example
 * const pd = new PixieDb('id', ['price', 'category'], products) // data is optional can be load after using the load method
 * const byId = pd.select().eq('id', 2).single() // { id: 2, name: 'Banana', price: 10, category: 'Fruit' }
 * const allByName = pd.select().eq('name', 'Apple').orderBy(['name', ['price', 'desc']]).data() // [{ id: 1, name: 'Apple', price: 10, category: 'Fruit' }, ...]
 */
export class PixieDb<T extends Record<any, any>, Key extends keyof T> extends EvEmit<T> {
    /**
     * primary key or unique key for the database
    */
    readonly key: Key

    /**
     * keyMap is a map of key and data
    */
    #keyMap: Map<T[Key], T> = freeze(new Map<T[Key], T>())

    /**
     * method to clone data
     * default clone method is JSON stringify and parse 
     */
    cloneMethod = deepClone

    /**
     * indexes is a map of index name and map of index value and set of keys
    */
    #idxs: Index<T, Key>
    #uniqIdx

    /**
     * @param key primary key or unique key for the database (key should be primitive).
     * @param indexes list of index names or for unique indexes { name: 'nameOfIndex', unique: true }
     * @param data data list/array to load (with clone)
    */
    constructor(key: Key, indexes: Array<keyof T | { name: keyof T, unique: boolean }> = [], data?: T[]) {
        super(200)
        this.key = key

        this.#uniqIdx = new Set<keyof T>([this.key])
        indexes.push(key)

        const idx = Object.create(null) as Index<T, Key>
        indexes.forEach((i) => {
            if (typeof i === 'object' && i.unique)
                this.#uniqIdx.add(i.name)
            idx[typeof i === 'object' ? i.name : i] = new BinaryIndex()
        })
        this.#idxs = freeze(idx)
        if (data)
            this.load(data)
    }

    /**
     * used to perform select after complex filtering
     * @example
     * pd.select(['name', 'price']).eq('category', 'Fruit').data() // [{ name: 'Apple', price: 10 }, { name: 'Banana', price: 10 }, ...]
     * pd.select().eq('category', 'Fruit').orderBy('name', ['price', 'desc']).data() // [{ id: 1, name: 'Apple', price: 10, category: 'Fruit' }, { id: 2, name: 'Banana', price: 10, category: 'Fruit' }, ...]
    */
    select<Fields extends readonly (keyof T)[]>(fields?: Fields): SelectQueryBuilder<T, Fields> {
        return this.#resutSet(isArray(fields) ? fields : []) as unknown as SelectQueryBuilder<T, Fields>
    }

    /**
     * used to perform delete/update with complex filtering
     * @example
     * pd.where().eq('category', 'Fruit').delete() // delete all fruit products
     * pd.where().eq('category', 'Fruit').update({ price: 20 }) // update all fruit products price to 20
    */
    where(): WhereQueryBuilder<T> {
        return this.#resutSet([], 'where')
    }

    /**
     * @param f fields to select default: [] (means all fields in select)
     * @param a action to for query builder
    */
    #resutSet(f: Readonly<Array<keyof T>> = [], a?: 'select' | 'where'): ResultSet<T, readonly (keyof T)[], Key> {
        return new ResultSet<T, typeof f, Key>(this, this.key, this.#keyMap, this.#idxs, f, a)
    }

    /**
     * Insert data or array of data into database
     * @example
     * pd.insert({ id: 3, name: 'Orange', price: 20, category: 'Fruit' }) // insert single record
     * pd.insert([{ id: 3, name: 'Orange', price: 20, category: 'Fruit' }, { id: 4, name: 'Mango', price: 30, category: 'Fruit' }]) // insert multiple records
     * @param docs data or array of data to insert
     * @param upsert set true to update if found
     * @param silent true to not emit events default false
     * @param clone false to not clone data before insert
    */
    insert<Doc extends T | T[]>(docs: Doc, { silent, clone, upsert }: { silent?: boolean, clone?: boolean, upsert?: boolean } = {}): Doc extends any[] ? T[] : (T | undefined) {
        if (typeof docs !== 'object')
            throw new PDBError('Value', 'Value must be an object or object array')
        let st: Set<any> | undefined
        const ds = toArray(docs), r: T[] = [], ix = this.#idxs, pk = this.key, keys = this.indexes

        ds.forEach((d) => {
            try {
                if (this.#keyMap.get(d[pk])) {
                    if (upsert) {
                        const u = this.where().eq(this.key, d[this.key]).update(d)
                        if (u.length)
                            r.push(d)
                    }
                    return
                }

                keys.forEach((i) => {
                    if (!hasOwn(ix, i))
                        return

                    if (this.#uniqIdx.has(i)) {
                        ix[i].set(d[i], d[pk])
                        return
                    }

                    st = ix[i].get(d[i])
                    if (!st)
                        ix[i].set(d[i], st = new Set())
                    st.add(d[pk])
                })
                this.#keyMap.set(d[pk], clone === false ? d : this.cloneMethod(d))
                if (!silent)
                    this.emit('I', d)
                r.push(d)

            }
            catch (er) {
            }
        })

        return (isArray(docs) ? r : r[0]) as Doc extends any[] ? T[] : (T | undefined)
    }

    /**
     * @param data data list/array to load (without clone)
     * @param clear true to clear existing data
    */
    load(data: T[], clear = false): void {
        if (clear) {
            this.#keyMap.clear()
            Object.values(this.#idxs).forEach(i => i.clear())
        }

        this.insert(data, { silent: true, clone: false })
        this.emit('L')
    }

    /**
     * get doc using key (primary key/unique id)
     * @example
     * const getByKey = pd.get(2)  // { id: 2, name: 'Banana', price: 10, category: 'Fruit' }
     *
     * @param {T[Key]} key key to get data by
     */
    get(key: T[Key]): T | undefined {
        return this.#keyMap.get(key)
    }

    /**
     * @param clone
     * clone the returning rows (don't modify values if pass clone as false)
     * default `true`
     * @example
     * const allData = pd.data() // [{ id: 1, name: 'Apple', price: 10, category: 'Fruit' }, ...]
    */
    data(clone = true): T[] {
        const d = [...this.#keyMap.values()]
        return clone ? d.map(i => this.cloneMethod(i)) : d
    }

    /**
     * get all indexes names (including unique and key)
    */
    get indexes(): (keyof T)[] {
        return Object.keys(this.#idxs)
    }

    /**
     * tell is the key is an unique index name
     * @param k name of the index
    */
    isUniqIdx(k: keyof T): boolean {
        return this.#uniqIdx.has(k)
    }

    /**
     * to close/quit/terminate the database
     * @param silent true to not emit events default false
    */
    close(silent = false): void {
        this.#keyMap.clear()
        Object.keys(this.#idxs).forEach((i) => {
            if (hasOwn(this.#idxs, i))
                this.#idxs[i].clear()
        })
        if (!silent)
            this.emit('Q')
        this.offAll()
    }

    /**
     * return JSON of all data without cloning, key and index names
     * @example
     * const json = pd.toJSON() // { key: 'id', indexes: ['price', 'category', {name: 'id', unique: true}], data: [{ id: 1, name: 'Apple', price: 10, category: 'Fruit' }, ...] }
    */
    toJSON(): {
        key: Key;
        indexes: (keyof T)[];
        data: T[];
    } {
        return { key: this.key, indexes: this.indexes.map(i => this.isUniqIdx(i) ? ({ name: i, unique: true }) : i), data: this.data() }
    }
}
