import { PDBError } from './error'
import { PixieDb } from './index'
import type { FQ, Index, MaybePartial, Pretify, SortOptions, OrderBy } from './types'
import { hasOwn, isArray, isNullOrUndefined, valArr, valPair } from './utils'

export class ResultSet<T extends Record<any, any>, Fields extends Readonly<Array<keyof T>>, Key extends keyof T> {
    /**
     * fields Queries to filter rows
    */
    #query: FQ<T, keyof T>[] = []
    /**
     * Filtered rows
    */
    #filteredrows: T[] = []
    /**
     * Filtered status
    */
    #filtered = false
    /**
     * From index
    */
    #from = 0
    /**
     * Limit index
    */
    #max = -1

    /**
     * Clone status
    */
    #clone = true

    /**
      * Action to perform 'select' | 'where'
      * @type {'select' | 'where'}
     */
    #action: 'select' | 'where'

    /**
     * primary key or unique key for the database
    */
    readonly #key: Key

    /**
     * keyMap is a map of key and data
    */
    #kmp

    /**
      * indexes is a map of index name and map of index value and set of keys
    */
    #idx

    /**
     * fields to return mapped object with select
    */
    #fields: Readonly<(keyof T)[]>

    #sortOptions: OrderBy<T>[] = []
    /**
     * F: 'filter'
     * S: 'sort'
     * R: 'Range slice (offset and limit)'
    */
    #opStack: ('F' | 'S' | 'R')[] = []

    /**
     * @param db PixieDb instance
    */
    readonly #db: PixieDb<T, Key>

    constructor(db: PixieDb<T, Key>, key: Key, kmp: Map<T[Key], T>, idx: Index<T, Key>, fields?: Fields, action: 'select' | 'where' = 'select') {
        this.#db = db
        this.#key = key
        this.#kmp = kmp
        this.#idx = idx
        this.#action = action
        this.#fields = fields ?? []
    }

    /**
     * Get data by index
     * @param name index name
     * @param value index value
     * @param val2 index value 2
     * @param op operation on index
    */
    #setByIndex<K extends keyof T>(name: K, value: T[K], op: FQ<T, keyof T>[0] = 'eq', val2?: T[K]) {
        let ks: Set<T[Key]> | T[Key][] | undefined, t: (Set<T[Key]> | T[Key])[] | undefined

        switch (op) {
            case 'eq':
                ks = this.#idx[name].get(value)
                break;
            case 'in':
                t = this.#idx[name].in(value)
                break;
            case 'btw':
                if (val2 === undefined)
                    break;
                t = this.#idx[name].btw(value, val2)
                break;
            case 'gt':
            case 'lt':
            case 'gte':
            case 'lte':
                const gt = /^gt/.test(op)
                t = this.#idx[name][gt ? 'gt' : 'lt'](value, /e$/.test(op));
                gt || t.reverse()
                break;
        }

        if (t)
            this.#db.isUniqIdx(name) ? ks = t as T[Key][] : t.forEach(s => s instanceof Set && s.forEach(k => this.#setByKey(k)))

        ks?.forEach(k => this.#setByKey(k))
    }

    /**
     * Add key to filtered rows if the key is in the cache
     * @param k key to check and add
     */
    #setByKey(k: T[Key]) {
        const v = this.#kmp.get(k)
        /**
         * Add document to the filtered rows
         * @type {T} cloned document if clone is true else the original document
        */
        v && this.#filteredrows.push(this.#clonedDoc(v))
    }

    /**
     * Clone the document if clone or force is true
     * @param doc Document to clone
     * @param force Force cloning, by default cloning will be skipped if clone is false
     * @returns Cloned document
     */
    #clonedDoc(doc: T, force?: boolean): T {
        return this.#clone || force ? this.#db.cloneMethod(doc) : doc
    }

    /**
     * Return shallow copied object with only fields specified in fields query
     * If fields query is empty then return whole document
     * @param doc Document to pick fields from
     */
    #pick(doc: T): T {
        if (!this.#fields.length)
            return doc;
        const r = {} as T;
        this.#fields.forEach(k => r[k] = doc[k]);
        return r;
    }

    /**
     * Filter data using fieldsQuery
     * if data already filtered then return
     * if fieldsQuery is empty then return all data
     * if fieldsQuery is not empty then filter data and return
     * if fieldsQuery is not empty and data is already filtered then filter data and return
     * also perform limit and from/offset action
    */
    #filter() {
        if (this.#filtered)
            return
        let started = false // flag that indicates whether some filter queries were applied
        let from = this.#from, max = this.#max

        const qs = this.#query, fq = qs[0] // first filter query
        if (!fq) { // if there are no filter queries at all
            if (from === 0 && max === 1) { // return first element
                const v = this.#kmp.values().next().value
                this.#filteredrows = v ? [v] : []
            } else { // return slice of all elements
                this.#setSliced()
            }
            this.#filtered = true // mark as filtered
            return
        }

        if (fq[1] === this.#key && /^(eq|in)/.test(fq[0])) { // handle filter query that uses index
            // (fq[2] instanceof Set ? fq[2] : [fq[2]]).forEach(k => this.#setByKey(k as T[Key]))
            (fq[2] instanceof Set ? fq[2] : [fq[2]]).forEach(k => this.#setByKey(k as T[Key])) // get values to check and add all values to the filtered rows
            started = true // mark as started
        }

        // handles 'btw', 'nbtw', 'gt', 'gte', 'lt', 'lte', and ('in', 'eq' for indexes only)
        else if (hasOwn(this.#idx, fq[1]) && /btw|^(eq|gt|in|lt)/.test(fq[0])) {
            if (fq[0] === 'nbtw') { // handle 'nbtw'
                // in this if we are getting docs which are less than value1
                this.#setByIndex(fq[1], fq[2] as T[typeof fq[1]], 'lt') // set values using '<' operator

                // now making the query to append docs which are greater than value2
                fq[2] = fq[3] // replace value1 with value2
                fq[0] = 'gt' as 'nbtw' // change operator to '>'
            }
            this.#setByIndex(fq[1], fq[2] as T[typeof fq[1]], fq[0], fq[3]) // set values using specified operator
            started = true // mark as started
        }

        if (started)
            qs.shift() // remove applied filter query

        if (!qs.length) { // if there are no more filter queries
            if (!started)
                this.#filteredrows = this.#setSliced() // return slice of all elements
            this.#filtered = true // mark as filtered
            return // end function
        }

        const data = started ? this.#filteredrows : this.#kmp.values() // get data to iterate over

        this.#filteredrows = [] // reset filtered rows
        let add: boolean

        for (const d of data) { // iterate over data
            // flag that indicates whether document should be added to filtered rows
            add = !qs.some(([op, k, v, v2]) => {
                // iterate over filter queries
                // return opposite
                switch (op) {
                    case 'btw': // between operator
                        return !(d[k] >= v && d[k] <= v2)
                    case 'eq': // equal operator
                        return d[k] !== v
                    case 'gt': // greater than operator
                        return d[k] <= v
                    case 'gte': // greater than or equal operator
                        return d[k] < v
                    case 'in': // in operator (for indexes only)
                        return !v.has(d[k])
                    case 'lt': // less than operator
                        return d[k] >= v
                    case 'lte': // less than or equal operator
                        return d[k] > v
                    case 'nbtw': // not between operator
                        return d[k] >= v && d[k] <= v2
                    case 'neq':
                        return d[k] === v
                    case 'nin':
                        return v.has(d[k])
                    default:
                        throw new PDBError('Filter', 'Unsupported filter: ' + op)
                }
            })
            if (add && --from < 0) {
                this.#filteredrows.push(d)
                if (max !== -1) {
                    if (--max <= 0)
                        break
                }
            }
        }

        this.#filtered = true
        this.#from = 0
        this.#max = -1
    }

    /**
     * Perform update and delete operations on documents in filtered rows and also update indexes.
     * @param data data to update
    */
    #performUD(data?: MaybePartial<T>) {
        this.#valAction('where')

        const r: T[] = []
        let st: Set<any> | undefined
        const ix = this.#idx
        const pk = this.#key
        let isUniq: boolean
        let ikeys = Object.keys(ix) as (keyof typeof data)[]

        if (data)
            ikeys = ikeys.filter(i => hasOwn(data, i))

        this.#filteredrows.forEach(d => {
            ikeys.forEach(i => {
                isUniq = this.#db.isUniqIdx(i)

                if (data) {
                    if (d[i] === data[i]) return

                    if (isUniq) {
                        ix[i].set(data[i], d[pk])
                        return
                    }
                    st = ix[i].get(data[i])
                    if (!st)
                        ix[i].set(data[i], st = new Set());
                    st.add(d[pk])
                }

                if (isUniq)
                    ix[i].delete(d[i])
                else {
                    const n = ix[i].getNode(d[i])

                    if (n && n.value instanceof Set) {
                        st = n.value
                        st.delete(d[pk])
                        if (!st.size)
                            ix[i].deleteNode(n)
                    }
                }

            })

            let c = d
            if (data) {
                // console.log(Object.assign(d, data));

                Object.assign(d, data)
                this.#kmp.set(d[pk], d)

                const o = this.#clonedDoc(c)
                c = this.#clonedDoc(d, true)
                this.#db.emit('U', c, o)
                // console.log(o);
            } else {
                this.#kmp.delete(d[pk])
                this.#db.emit('D', d)
            }

            r.push(c)
        })
        return r
    }

    /**
     * Delete filtered data
    */
    delete(): T[] {
        this.#valAction('where')
        this.#clone = false
        this.#filter()
        return this.#performUD()
    }

    /**
     * Update filtered data
     * @param doc document to update
    */
    update(doc: T | Partial<T>): T[] {
        if (hasOwn(doc, this.#key))
            delete doc[this.#key]

        this.#valAction('where')
        this.#filter()
        return this.#performUD(doc)
    }

    /**
     * Returns filtered list of shallow copied doc
    */
    data() {
        this.#valAction('select')
        this.#filter()
        // console.log(this.#from, this.#max);
        this.#setSliced(this.#filteredrows)
        return this.#filteredrows.map(r => this.#clonedDoc(this.#pick(r))) as Fields extends [] ? T[] : Pick<Pretify<T>, Fields[number]>[]
    }

    /**
     * Returns filtered single shallow copied doc
    */
    single() {
        this.#valAction('select')
        this.#filter()
        this.#setSliced(this.#filteredrows)
        return this.#clonedDoc(this.#pick(this.#filteredrows[0])) as Fields extends [] ? T : Pick<Pretify<T>, Fields[number]>
    }

    /**
     * Validate current action
     * @param act action name
     * @throws {PDBError} if action is not valid
     */
    #valAction(act: 'select' | 'where'): void {
        if (this.#action !== act)
            throw new PDBError('Action', `unable to perform this action in "${act}"`);
    }

    /**
     * Set from/offset index and limit index
    */
    range(from = 0, count = -1) {
        // TODO: throw error for from < 0
        if (from >= 0)
            this.#from = from
        if (count >= 0)
            this.#max = count
        this.#opStack.push('R')
        return this
    }

    #setSliced(data: T[] = [...this.#kmp.values()]): T[] {
        this.#filteredrows = this.#from !== 0 || this.#max !== -1 ? data.slice(this.#from, this.#max === -1 ? undefined : this.#from + this.#max) : data
        this.#from = 0
        this.#max = -1
        return this.#filteredrows
    }

    /**
     * Count of the filted data
    */
    count(): number {
        this.#clone = false
        if (!this.#query.length)
            return this.#kmp.size
        this.#filter()
        return this.#filteredrows.length
    }

    /**
     * Sort data using keys
    */
    orderBy(opt: SortOptions<T>) {
        valArr(opt)
        this.#sortOptions = opt.map<OrderBy<T>>(o => {
            let s: OrderBy<T> = isArray(o) ? o : [o, 'asc']
            if (s.length !== 2 || typeof s[0] !== 'string' || !['asc', 'desc'].includes(s[1]))
                throw new PDBError('Value', 'Incorrect values for orderBy')
            return s
        })
        this.#opStack.push('S')
        this.#filter()
        this.#sort()
        return this
    }

    /**
     * Sort data using keys
     * @param opt sort options
    */
    #sort() {
        let len = this.#sortOptions.length
        if (!len)
            return
        // if (this.#sorted) throw new PDBError('Action', 'Already sorted')
        this.#valAction('select')

        this.#filteredrows.sort((a, b) => {
            let comparison = 0;

            for (let i = 0; i < len; i++) {
                const op = this.#sortOptions[i]
                const priority = len - i

                const [key, order] = op

                const v1 = isNullOrUndefined(a[key]) ? 0 : a[key];
                const v2 = isNullOrUndefined(b[key]) ? 0 : b[key];

                let cmp = v1 === v2 ? 0 : (
                    v1 < v2 ? -1 : 1
                )
                cmp *= priority;
                if (order === 'desc')
                    cmp *= -1

                comparison += cmp

            }
            return comparison;
        });
        this.#sortOptions = []
    }

    eq<K extends keyof T>(field: K, value: T[K]) {
        return this.#fAdd('eq', field, value)
    }

    in<K extends keyof T>(field: K, values: T[K][]) {
        valArr(values)
        const st = new Set<any>(values)
        return this.#fAdd('in', field, st)
    }
    nin<K extends keyof T>(field: K, values: T[K][]) {
        valArr(values)
        const st = new Set<any>(values)
        return this.#fAdd('nin', field, st)
    }

    between<K extends keyof T>(field: K, values: [T[K], T[K]]) {
        valPair(values)

        return this.#fAdd('btw', field, values[0], values[1])
    }

    nbetween<K extends keyof T>(field: K, values: [T[K], T[K]]) {
        valPair(values)

        return this.#fAdd('nbtw', field, values[0], values[1])
    }

    neq<K extends keyof T>(field: K, value: T[K]) {
        return this.#fAdd('neq', field, value)
    }

    gt<K extends keyof T>(field: K, value: T[K]) {
        return this.#fAdd('gt', field, value)
    }

    gte<K extends keyof T>(field: K, value: T[K]) {
        return this.#fAdd('gte', field, value)
    }

    lt<K extends keyof T>(field: K, value: T[K]) {
        return this.#fAdd('lt', field, value)
    }

    lte<K extends keyof T>(field: K, value: T[K]) {
        return this.#fAdd('lte', field, value)
    }

    /**
     * push action field and values to fieldsQuery
    */
    #fAdd(...v: FQ<T, keyof T>) {
        // if (this.#opStack.length < 1)
        // this.#opAdd('F')
        const prev = this.#opStack.at(-1)
        if (prev && prev !== 'F')
            throw new PDBError('Action', 'Unable to add filter')
        // if (this.#sorted) throw new PDBError('Action', 'Unable to add filter after sort')
        this.#query.push(v)
        return this
    }
    // #opAdd(op: 'F' | 'S' | 'O' | 'L') {
    //     const prev = this.#opStack.at(-1)

    //     if (!prev) {
    //         this.#opStack.push(op)
    //         return
    //     }
    //     switch (op) {
    //         case 'F':
    //             if (prev !== 'F') throw new PDBError('Action', 'Unable to add filter')
    //             break;

    //         default:
    //             break;
    //     }
    // }

    toJSON(clone = false) {
        this.#valAction('select')
        this.#clone = clone
        return this.data()
    }
}
