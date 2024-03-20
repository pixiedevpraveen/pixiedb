export function freeze<T = any>(o: T): Readonly<T> {
    return Object.freeze(o)
}

type HasProperty<T> = {
    [K in keyof T]: T[K]
}

export function isNullOrUndefined(o: unknown): o is null | undefined {
    return o === null || o === undefined
}

export function isArray<T extends any = any>(o: T | T[]): o is T[] {
    return Array.isArray(o)
}

export function toArray<T extends any = any>(o: T | T[]): T[] {
    return Array.isArray(o) ? o : [o]
}

export function hasOwn<T>(o: T, k: PropertyKey): o is HasProperty<T> {
    return Object.hasOwnProperty.call(o, k)
}

export function deepClone<T>(o: T): T {
    try {
        return structuredClone ? structuredClone(o) : JSON.parse(JSON.stringify(o)) as T
    } catch (er) {
        console.log(er);
    }
    return o
}

export function throttle<T extends any[]>(fn: (...arg: T) => void, delay = 1000, ...arg: T) {
    let timer: ReturnType<typeof setTimeout> | undefined
    return function () {
        clearTimeout(timer)
        timer = setTimeout((...arg) => { fn(...arg); timer = undefined }, delay, ...arg)
    }
}
