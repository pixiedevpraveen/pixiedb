import type { BinaryIndex } from "./BinaryIndex";

export type FilterOption = "eq" | "neq" | "gt" | "gte" | "lt" | "lte"

export type FQ<T, K extends keyof T> =
    [op: FilterOption, K: K, V: T[K]]
    | [op: "in" | "nin", K: K, V: Set<T[K]>]
    | [op: "btw", K: K, V1: T[K], V2: T[K]]
    | [op: "nbtw", K: K, V1: T[K], V2: T[K]]

export type OrderBy<T> = [key: keyof T, order: "asc" | "desc"]
export type SortOptions<T> = ((keyof T) | OrderBy<T>)[]

export type Index<T, Key extends keyof T> = { [K in keyof T]: BinaryIndex<T[K], Set<T[Key]> | T[Key]> }

export type DBEvent<T> =
    {
        /**
         * "L" alias of load. fires when data loaded
        */
        type: "L"
    }
    | {
        /**
         * "C" alias of change. fires on any changes happened like (insert/update/delete) after some time (debounced)
        */
        type: "C"
    }
    | {
        /**
         * "I" fires on row/record insert
        */
        type: "I", payload: [T]
    }
    | {
        /**
         * "U" fires on row/record update
        */
        type: "U", payload: [doc: T, oldDoc: T]
    }
    | {
        /**
         * "D" fires on row/record delete
        */
        type: "D", payload: [T]
    }
    | {
        /**
         * "Q" alias of Quit. fires on database clone
         */
        type: "Q"
    }


export type Pretify<T> = {
    [K in keyof T]: T[K]
} & unknown

export type Maybe<T> = T | undefined | null

export type MaybePartial<T> = T | Partial<T>


export type BaseQueryBuilder<T extends Record<any, any>, SecondaryBuilder> = {
    /**
     * return rows where field value is eqaul to given value
     * @example
     * pd.select().eq("name", "Apple").data()
    */
    eq: <K extends keyof T>(field: K, value: T[K]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is in array of values
     * @throws if values are not in array
     * @example
     * pd.select().nin("category", ["Fruit", "Vegetable"]).data()
    */
    in: <K extends keyof T>(field: K, values: T[K][]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is not in array of values
     * @throws if values are not in array
     * @example
     * pd.select().nin("name", ["Apple", "Banana"]).data()
    */
    nin: <K extends keyof T>(field: K, values: T[K][]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * field value is between of 2 value, within a given range
     * @throws if values are not in array and the array is not length of 2
     * @example
     * pd.select().between("price", [140, 200]).data()
    */
    between: <K extends keyof T>(field: K, values: [T[K], T[K]]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * field value is not between of 2 value, not within a given range
     * @throws if values are not in array and the array is not length of 2
     * @example
     * pd.select().nbetween("price", [120, 400]).data()
    */
    nbetween: <K extends keyof T>(field: K, values: [T[K], T[K]]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is not eqaul to given value
     * @example
     * pd.select().neq("name", "Apple").data()
    */
    neq: <K extends keyof T>(field: K, value: T[K]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is greater than to given value
     * @example
     * pd.select().gt("price", 150).data()
    */
    gt: <K extends keyof T>(field: K, value: T[K]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is greater than and eqaul to given value.
     * rows are order by the given field in ascending order
     * @example
     * pd.select().gte("price", 100).data()
    */
    gte: <K extends keyof T>(field: K, value: T[K]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is lower than to given value
     * @example
     * pd.select().lt("price", 120).data()
    */
    lt: <K extends keyof T>(field: K, value: T[K]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>

    /**
     * return rows where field value is lower than and eqaul to given value.
     * rows are order by the given field in ascending order
     * @example
     * pd.select().lte("price", 120).data()
    */
    lte: <K extends keyof T>(field: K, value: T[K]) => SecondaryBuilder & BaseQueryBuilder<T, SecondaryBuilder>
}

export type QueryBuilder<T extends Record<any, any>, SecondaryBuilder> = {

    /**
     * used to tell the starting point and length to return rows from a result set
     * @example
     * pd.select().range(2, 10).data()
    */
    range: (offset: number, count?: number) => SecondaryBuilder & Omit<QueryBuilder<T, SecondaryBuilder>, "range">

    /**
     * used to sort data with single or multiple keys
     * 
     * @example
     * pd.select().orderBy("name", "price").data()
     * pd.select().orderBy("name", ["price", "desc"]).data()
    */
    orderBy: (opt: SortOptions<T>) => SecondaryBuilder & Omit<QueryBuilder<T, SecondaryBuilder>, "orderBy">
}

type SelectBaseQueryBuilder<T extends Record<any, any>, Fields extends readonly (keyof T)[] | []> = {
    /**
     * returns the first filtered row
     * @example
     * pd.select().eq("id", 2).single()
     * pd.select("name", "price").in("id", [2, 3, 8]).single()
    */
    single: () => Pretify<Fields extends [] ? T : Pretify<Pick<T, Fields[number]>>>

    /**
     * returns all the filtered rows
     * @example
     * pd.select("name", "price").in("id", [2, 3, 8]).data()
    */
    data: () => Pretify<Fields extends [] ? T[] : Pretify<Pick<T, Fields[number]>[]>>

    /**
     * count of the filtered rows/docs/records
     * @example
     * pd.select().between("price", [8, 12]).count()
    */
    count: () => number
}

export type SelectQueryBuilder<T extends Record<any, any>, Fields extends readonly (keyof T)[] | []> = SelectBaseQueryBuilder<T, Fields> & BaseQueryBuilder<T, SelectBaseQueryBuilder<T, Fields> & QueryBuilder<T, SelectBaseQueryBuilder<T, Fields>>> & QueryBuilder<T, SelectBaseQueryBuilder<T, Fields>> & {
}

type WhereBaseQueryBuilder<T extends Record<any, any>> = {
    /**
     * update all the docs with the given doc keys
     * @returns all updated docs if passed true as the param
     * @example
     * pd.where().in("id", [2, 3, 8]).update({ price: 113 })
    */
    update: (data: MaybePartial<T>) => T[]

    /**
     * delete all the filtered docs/rows
     * @returns all removed docs
      * @example
      * pd.where().between("id", [8, 10]).delete()
     */
    delete: () => T[]
}

export type WhereQueryBuilder<T extends Record<any, any>> = WhereBaseQueryBuilder<T> & BaseQueryBuilder<T, WhereBaseQueryBuilder<T>> & {
}
