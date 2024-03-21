import { PDBError } from "./error"
import { PixieDb } from "./index"
import type { FQ, Index, MaybePartial, Pretify, SortOptions, OrderBy } from "./types"
import { deepClone, hasOwn, isArray, isNullOrUndefined } from "./utils"

export class ResultSet<T extends Record<any, any>, Fields extends readonly (keyof T)[] | [], Key extends keyof T> {
    /**
     * fields Queries to filter rows
    */
    private fieldsQuery: FQ<T, keyof T>[] = []
    /**
     * Filtered rows
    */
    private filteredrows: T[] = []
    /**
     * Filtered status
    */
    private filtered = false
    /**
     * Sorted status
    */
    private sorted = false
    /**
     * From index
    */
    private from = 0
    /**
     * Limit index
    */
    private max = -1

    /**
     * Clone status
    */
    private clone = true

    /**
      * Action to perform "select" | "where"
      * @type {"select" | "where"}
     */
    private action: "select" | "where"

    /**
     * primary key or unique key for the database
    */
    private key: Key

    /**
     * keyMap is a map of key and data
    */
    private kmp

    /**
      * indexes is a map of index name and map of index value and set of keys
    */
    private idx

    /**
     * fields to return mapped object with select
    */
    private readonly fields: readonly (keyof T)[]

    private sortOptions: OrderBy<T>[] = []
    // /**
    //  * F: "filter"
    //  * S: "sort"
    //  * O: "offset"
    //  * L: "limit"
    // */
    private opStack: ("F" | "S" | "O" | "L")[] = []

    /**
     * @param db PixieDb instance
    */
    private readonly db: PixieDb<T, Key>

    constructor(db: PixieDb<T, Key>, key: Key, kmp: Map<T[Key], T>, idx: Index<T, Key>, fields?: Fields, action: "select" | "where" = "select") {
        this.db = db
        this.key = key
        this.kmp = kmp
        this.idx = idx
        this.action = action
        this.fields = fields ?? []
    }

    /**
     * Get data by index
     * @param name index name
     * @param value index value
    */
    private getByIndex<K extends keyof T>(name: K, value: T[K]): T[] {
        const res: T[] = []
        const ks = this.idx[name]?.get(value)

        if (ks)
            ks.forEach(k => {
                const v = this.kmp.get(k)
                if (v) res.push(v)
            })
        return res
    }

    /**
     * Used to clone document
    */
    private clonedDoc(doc: T, force?: boolean) {
        if (!this.clone && !force) return doc

        return deepClone(doc)
    }

    /**
     * Pick fields from document
    */
    private pick(doc: T) {
        if (!this.fields.length) return doc
        const data = {} as T;
        this.fields.forEach(k => data[k] = doc[k])
        return data
    }

    /**
     * Filter data using fieldsQuery
     * if data already filtered then return
     * if fieldsQuery is empty then return all data
     * if fieldsQuery is not empty then filter data and return
     * if fieldsQuery is not empty and data is already filtered then filter data and return
     * also perform limit and from/offset action
    */
    private filter() {
        if (this.filtered) return
        let started = false
        // console.log(this.from, this.max);
        const fq = this.fieldsQuery[0];
        if (!fq) {
            if (this.from === 0 && this.max === 1)
                this.filteredrows = [this.kmp.values().next().value]
            else
                this.setSliced()
            this.filtered = true
            return
        }

        if (fq[0] === "eq") {

            if (fq[1] === this.key) {
                const v = this.kmp.get(fq[2] as T[Key])
                if (v)
                    this.filteredrows.push(v)

                started = true
            } else if (hasOwn(this.idx, fq[1])) {
                const vs = this.getByIndex(fq[1], fq[2])
                this.filteredrows.push(...vs)
                started = true
            }
        }

        else if (fq[0] === "in") {
            if (fq[1] === this.key) {
                fq[2].forEach(val => {
                    const v = this.kmp.get(val as T[Key])
                    if (v)
                        this.filteredrows.push(v)
                })
                started = true
            } else if (hasOwn(this.idx, fq[1])) {
                fq[2].forEach(val => {
                    const vs = this.getByIndex(fq[1], val)
                    this.filteredrows.push(...vs)
                })
                started = true
            }
        }
        if (started)
            this.fieldsQuery.shift()

        if (!this.fieldsQuery.length) {
            if (!started)
                this.filteredrows = this.setSliced()
            this.filtered = true
            return
        }



        const data = started ? this.filteredrows : this.kmp.values()

        this.filteredrows = []

        for (const d of data) {
            const add = !this.fieldsQuery.some(([op, field, val1, val2]) => {
                // return opposite
                switch (op) {
                    case "eq":
                        return d[field] !== val1
                    case "gt":
                        return d[field] <= val1
                    case "in":
                        return !val1.has(d[field])
                    case "lt":
                        return d[field] >= val1
                    case "neq":
                        return d[field] === val1
                    case "lte":
                        return d[field] > val1
                    case "gte":
                        return d[field] < val1
                    case "nin":
                        return val1.has(d[field])
                    case "btw":
                        return !(d[field] >= val1 && d[field] <= val2)
                    case "nbtw":
                        return d[field] >= val1 && d[field] <= val2
                    default:
                        throw new PDBError("Filter", "Unsupported filter: " + op)
                }
            })
            if (add && --this.from < 0) {
                this.filteredrows.push(d)
                if (this.max !== -1) {
                    if (--this.max <= 0) break
                }
            }
        }
        this.filtered = true
        this.from = 0
        this.max = -1
    }

    /**
     * perform update delete task here to reduce bundle size or in filter method
    */
    private performUD(docs: T[], data?: MaybePartial<T>) {
        this.validateAction("where")

        const r: T[] = []
        let st: Set<any> | undefined
        const ix = this.idx
        let ikeys = Object.keys(ix) as (keyof typeof data)[]

        if (data)
            ikeys = ikeys.filter(i => hasOwn(data, i))

        docs.forEach(d => {
            ikeys.forEach(i => {

                st = ix[i].get(d[i])
                if (st) {
                    st.delete(d[this.key])
                    if (!st.size)
                        ix[i].delete(d[i])
                }

                if (data) {
                    st = ix[i].get(data[i])
                    if (!st) {
                        st = new Set();
                        ix[i].set(data[i], st);
                    }
                    st.add(d[this.key])
                } else {
                    this.kmp.delete(d[this.key])
                    this.db.emit("D", d)
                }
            })

            let c = d
            if (data) {
                Object.assign(d, data)
                const o = this.clonedDoc(c)
                c = this.clonedDoc(d, true)
                this.db.emit("U", c, o)
            }

            r.push(c)
        })
        return r
    }

    /**
     * Delete filtered data
    */
    delete(): T[] {
        this.validateAction("where")
        this.clone = false
        this.filter()
        return this.performUD(this.filteredrows)
    }

    /**
     * Update filtered data
     * @param doc document to update
    */
    update(doc: T | Partial<T>): T[] {
        if (hasOwn(doc, this.key)) delete doc[this.key]

        this.validateAction("where")
        this.filter()
        return this.performUD(this.filteredrows, doc)
    }

    /**
     * Returns filtered list of shallow copied doc
    */
    data() {
        this.validateAction("select")
        this.filter()
        // console.log(this.from, this.max);
        this.setSliced(this.filteredrows)
        return this.filteredrows.map(r => this.clonedDoc(this.pick(r))) as Fields extends [] ? T[] : Pick<Pretify<T>, Fields[number]>[]
    }

    /**
     * Returns filtered single shallow copied doc
    */
    single() {
        this.validateAction("select")
        this.filter()
        this.setSliced(this.filteredrows)
        return this.clonedDoc(this.pick(this.filteredrows[0])) as Fields extends [] ? T : Pick<Pretify<T>, Fields[number]>
    }

    /**
     * @throws error if action don't match
    */
    private validateAction(act: "select" | "where"): void {
        if (this.action !== act) throw new PDBError("Action", "unable to perform this action in " + act)
    }

    /**
     * Set from/offset index and limit index
    */
    range(from = 0, count = -1) {
        // TODO: throw error for from < 0
        if (from >= 0)
            this.from = from
        if (count >= 0)
            this.max = count
        this.opStack.push("O")
        return this
    }

    private setSliced(data: T[] = [...this.kmp.values()]): T[] {
        this.filteredrows = this.from !== 0 || this.max !== -1 ? data.slice(this.from, this.max === -1 ? undefined : this.from + this.max) : data
        this.from = 0
        this.max = -1
        return this.filteredrows
    }

    /**
     * Count of the filted data
    */
    count(): number {
        this.clone = false
        if (!this.fieldsQuery.length) return this.kmp.size
        this.filter()
        return this.filteredrows.length
    }

    /**
     * Sort data using keys
    */
    orderBy(opt: SortOptions<T>) {
        this.sortOptions = opt.map<OrderBy<T>>(o => isArray(o) && o.length === 2 ? o : [o, "asc"])
        this.opStack.push("S")
        this.filter()
        this.sort()
        return this
    }

    /**
     * Sort data using keys
     * @param opt sort options
    */
    private sort() {
        if (!this.sortOptions.length) return
        // if (this.sorted) throw new PDBError("Action", "Already sorted")
        this.validateAction("select")
        let len = this.sortOptions.length

        this.filteredrows.sort((a, b) => {
            let comparison = 0;

            for (let i = 0; i < len; i++) {
                const op = this.sortOptions[i]
                const priority = len - i

                const [key, order] = op

                const v1 = isNullOrUndefined(a[key]) ? 0 : a[key];
                const v2 = isNullOrUndefined(b[key]) ? 0 : b[key];

                let cmp = v1 === v2 ? 0 : (
                    v1 < v2 ? -1 : 1
                )
                cmp *= priority;
                if (order === "desc") cmp *= -1

                comparison += cmp

            }
            return comparison;
        });
        this.sorted = true
    }

    eq<K extends keyof T>(field: K, value: T[K]) {
        return this.fAdd("eq", field, value)
    }

    in<K extends keyof T>(field: K, values: T[K][]) {
        if (!isArray(values)) throw new PDBError("Value", "Invalid values")
        const st = new Set<any>(values)
        return this.fAdd("in", field, st)
    }
    nin<K extends keyof T>(field: K, values: T[K][]) {
        if (!isArray(values)) throw new PDBError("Value", "Invalid values")
        const st = new Set<any>(values)
        return this.fAdd("nin", field, st)
    }

    between<K extends keyof T>(field: K, values: [T[K], T[K]]) {
        if (!isArray(values) || values.length !== 2) throw new PDBError("Value", "Invalid values")

        return this.fAdd("btw", field, values[0], values[1])
    }

    nbetween<K extends keyof T>(field: K, values: [T[K], T[K]]) {
        if (!isArray(values) || values.length !== 2) throw new PDBError("Value", "Invalid values")

        return this.fAdd("nbtw", field, values[0], values[1])
    }

    neq<K extends keyof T>(field: K, value: T[K]) {
        return this.fAdd("neq", field, value)
    }

    gt<K extends keyof T>(field: K, value: T[K]) {
        return this.fAdd("gt", field, value)
    }

    gte<K extends keyof T>(field: K, value: T[K]) {
        return this.fAdd("gte", field, value)
    }

    lt<K extends keyof T>(field: K, value: T[K]) {
        return this.fAdd("lt", field, value)
    }

    lte<K extends keyof T>(field: K, value: T[K]) {
        return this.fAdd("lte", field, value)
    }

    /**
     * push action field and values to fieldsQuery
    */
    private fAdd(...v: FQ<T, keyof T>) {
        // if (this.opStack.length < 1)
        // this.opAdd("F")
        const prev = this.opStack.at(-1)
        if (prev && prev !== "F") throw new PDBError("Action", "Unable to add filter")
        // if (this.sorted) throw new PDBError("Action", "Unable to add filter after sort")
        this.fieldsQuery.push(v)
        return this
    }
    private opAdd(op: typeof this.opStack[number]) {
        const prev = this.opStack.at(-1)

        if (!prev) {
            this.opStack.push(op)
            return
        }
        switch (op) {
            case "F":
                if (prev !== "F") throw new PDBError("Action", "Unable to add filter")
                break;

            default:
                break;
        }
    }

    toJSON(clone = false) {
        this.validateAction("select")
        this.clone = clone
        return this.data()
    }
}
