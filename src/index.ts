import { EvEmit } from "./EvEmit";
import { ResultSet } from "./ResultSet";
import { PDBError } from "./error";
import { deepClone, freeze, hasOwn, isArray, toArray } from "./utils";
import type { Index, SelectQueryBuilder, WhereQueryBuilder } from "./types";
import { SpeedIndex } from "speed-index";

/**-----------------------------------------------------
 * A tiny javascript in memory database with indexing and filters.
 *
 * @author Praveen yadav
 * @see https://github.com/pixiedevpraveen/pixiedb/tree/master/README.md
 * ---
 * @example
 * const pd = new PixieDb('id', ["price", "category"], products) // data is optional can be load after using the load method
 * const byId = pd.select().eq("id", 2).single() // { id: 2, name: "Banana", price: 10, category: "Fruit" }
 * const allByName = pd.select().eq("name", "Apple").orderBy(["name", ["price", "desc"]]).data() // [{ id: 1, name: "Apple", price: 10, category: "Fruit" }, ...]
 */
export class PixieDb<T extends Record<any, any>, Key extends keyof T> extends EvEmit<T> {
    /**
     * primary key or unique key for the database
    */
    readonly key

    /**
     * keyMap is a map of key and data
    */
    private keyMap: Map<T[Key], T> = freeze(new Map<T[Key], T>())

    /**
     * indexes is a map of index name and map of index value and set of keys
    */
    private indexes: Index<T, Key>

    /**
     * @param key primary key or unique key for the database (key should be primitive).
     * @param indexes list of index names
     * @param data data list/array to load (with clone)
    */
    constructor(key: Key, indexes: readonly (keyof T)[] = [], data?: T[]) {
        super(200)
        this.key = key

        let idx = Object.create(null) as Index<T, Key>
        indexes.forEach(i => idx[i] instanceof SpeedIndex || (idx[i] = new SpeedIndex()))
        this.indexes = freeze(idx)
        if (data) this.load(data)
    }

    /**
     * used to perform select after complex filtering
     * @example
     * pd.select(["name", "price"]).eq("category", "Fruit").data() // [{ name: "Apple", price: 10 }, { name: "Banana", price: 10 }, ...]
     * pd.select().eq("category", "Fruit").orderBy("name", ["price", "desc"]).data() // [{ id: 1, name: "Apple", price: 10, category: "Fruit" }, { id: 2, name: "Banana", price: 10, category: "Fruit" }, ...] 
    */
    select<Fields extends readonly (keyof T)[]>(fields?: Fields) {
        return new ResultSet<T, Fields, Key>(this, this.key, this.keyMap, this.indexes, fields) as unknown as SelectQueryBuilder<T, Fields>
    }

    /**
     * used to perform delete/update with complex filtering
     * @example
     * pd.where().eq("category", "Fruit").delete() // delete all fruit products
     * pd.where().eq("category", "Fruit").update({ price: 20 }) // update all fruit products price to 20
    */
    where() {
        return new ResultSet<T, [], Key>(this, this.key, this.keyMap, this.indexes, [], "where") as unknown as WhereQueryBuilder<T>
    }

    /**
     * Insert data or array of data into database
     * @example
     * pd.insert({ id: 3, name: "Orange", price: 20, category: "Fruit" }) // insert single record
     * pd.insert([{ id: 3, name: "Orange", price: 20, category: "Fruit" }, { id: 4, name: "Mango", price: 30, category: "Fruit" }]) // insert multiple records
     * @param docs data or array of data to insert
     * @param upsert set true to update if found
     * @param silent true to not emit events default false
     * @param clone false to not clone data before insert
    */
    insert<Doc extends T | T[]>(docs: Doc, { silent, clone, upsert }: { silent?: boolean, clone?: boolean, upsert?: boolean } = {}) {
        if (typeof docs !== 'object') throw new PDBError("Value", "Value must be an object or object array")
        const ds = toArray(docs)
        let st: Set<any> | undefined
        const r: T[] = []
        const ix = this.indexes
        const key = this.key
        const keys = this.indexNames

        ds.forEach(d => {
            try {
                if (this.keyMap.get(d[key])) {
                    if (upsert) {
                        const u = this.where().eq(this.key, d[this.key]).update(d)
                        if (u.length)
                            r.push(d)
                    }
                    return
                }

                keys.forEach(i => {
                    if (!hasOwn(ix, i)) return

                    st = ix[i as keyof T].get(d[i as keyof T])
                    if (!st) {
                        st = new Set();
                        ix[i as keyof T].set(d[i as keyof T], st);
                    }
                    st.add(d[key])
                })
                this.keyMap.set(d[key], clone === false ? d : deepClone(d))
                if (!silent) this.emit("I", d)
                r.push(d)

            } catch (er) {
            }
        })

        return (isArray(docs) ? r : r[0]) as Doc extends any[] ? T[] : (T | undefined)
    }

    /**
     * @param data data list/array to load (without clone)
     * @param clear true to clear existing data
    */
    load(data: T[], clear = false) {
        if (clear) {
            this.keyMap.clear()
            Object.values(this.indexes).forEach(i => i.clear())
        }

        this.insert(data, { silent: true, clone: false })
        this.emit("L")
    }

    /**
     * get doc using key (primary key/unique id)
     * @example
     * const getByKey = pd.get(2)  // { id: 2, name: "Banana", price: 10, category: "Fruit" }
     * 
     * @param {T[Key]} key key to get data by
     */
    get(key: T[Key]): T | undefined {
        return this.keyMap.get(key)
    }

    /**
     * @param clone
     * clone the returning rows (don't modify values if pass clone as false)
     * default `true`
     * @example
     * const allData = pd.data() // [{ id: 1, name: "Apple", price: 10, category: "Fruit" }, ...]
    */
    data(clone = true): T[] {
        const d = [...this.keyMap.values()]
        return clone ? d.map(i => deepClone(i)) : d
    }

    get indexNames(): (keyof T)[] {
        return Object.keys(this.indexes)
    }

    /**
     * to close/quit/terminate the database
     * @param silent true to not emit events default false
    */
    close(silent = false): void {
        this.keyMap.clear()
        Object.keys(this.indexes).forEach(i => {
            if (hasOwn(this.indexes, i)) this.indexes[i].clear()
        })
        if (!silent)
            this.emit("Q")
    }

    /**
     * return JSON of all data without cloning, key and index names
     * @example
     * const json = pd.toJSON() // { key: "id", indexes: ["price", "category"], data: [{ id: 1, name: "Apple", price: 10, category: "Fruit" }, ...] }
    */
    toJSON() {
        return { key: this.key, indexes: this.indexNames, data: this.data() }
    }
}
