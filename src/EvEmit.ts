import { DBEvent } from "./types"
import { freeze, hasOwn, toArray, throttle } from "./utils"
import { remove } from "@antfu/utils";

export class EvEmit<T> {
    /**
     * Events listners
    */
    private events: Events<DBEvent<T>, T> = freeze({ L: [], C: [], Q: [], I: [], U: [], D: [] })
    /**
     * used to emit change event after a fixed time of last change event
    */
    private cEv

    constructor(cTime: number) {
        this.cEv = throttle(() => {
            this.emit("C")
        }, cTime)
    }

    /**
     * add event listner to the given event
     * @param ev event name
     * @param fn Listner/Handler 
     * @example
     * pd.on("I", (ev, doc) => { console.log(ev, doc) }) // "I", { id: 3, name: "Orange", price: 20, category: "Fruit" } // on insert event
     * pd.on("C", (evs)=>{}) // on change event with list of changes
     * pd.on("L", (ev)=>{ console.log("database loaded") }) // on load event
     * pd.on("Q", (ev)=>{}) // on quit event
    */
    on<Type extends DBEvent<T>['type'] | DBEvent<T>['type'][], Ev extends Type extends any[] ? Type[number] : Type>(event: Type, fn: ((...args: Extract<DBEvent<T>, { type: Ev }> extends { payload: infer Payload } ? [event: Ev, data: Payload extends any[] ? Payload : [Payload]] : [event: Ev]) => void)) {
        toArray(event).forEach(e => {
            if (hasOwn(this.events, e))
                this.events[e].push(fn)
        })
        return fn
    }

    /**
     * remove event listner from the given event
     * @param ev event name
     * @param fn Listner/Handler 
     * @example
     * pd.off("Q", (ev)=>{})
    */
    off<Type extends DBEvent<T>['type'] | DBEvent<T>['type'][], Ev extends Type extends any[] ? Type[number] : Type>(event: Type, fn: ((...args: Extract<DBEvent<T>, { type: Ev }> extends { payload: infer Payload } ? [event: Ev, data: Payload extends any[] ? Payload : [Payload]] : [event: Ev]) => void)) {
        toArray(event).forEach(e => {
            if (hasOwn(this.events, e))
                remove(this.events[e], fn)
        })
        return fn
    }

    /**
     * emit events
     * @param ev event name
     * @param data data payload to emit
     * @example
     * pd.emit("I", { id: 3, name: "Orange", price: 20, category: "Fruit" }) // emit insert event
     * pd.emit("C", "I", "U", "D") // emit change event with list of changes
     * pd.emit("L") // emit load event
     * pd.emit("Q") // emit quit event
    */
    emit<Type extends DBEvent<T>['type']>(...args: Extract<DBEvent<T>, { type: Type }> extends { payload: infer Payload } ? [event: Type, ...data: Payload extends any[] ? Payload : [Payload]] : [event: Type]) {
        const [ev, ...data] = args
        if (hasOwn(this.events, ev))
            setTimeout(() => this.events[ev].forEach(fn => fn(ev, data)), 10)

        if ("IUD".includes(ev)) {
            this.cEv()
        }
    }
}

type Events<Evs extends DBEvent<T>, T> = { [Type in Evs['type']]: (Function/* (ev: Type, ...args: any[]) => void */)[] }
