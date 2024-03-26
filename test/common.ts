import { OrderBy, SortOptions } from "../src/types";
import { isArray, isNullOrUndefined } from "../src/utils";

export function filtedSortedProducts(sortOptions: SortOptions<Product>, fields: Array<keyof Product>) {
    const opt = sortOptions.map<OrderBy<Product>>(o => isArray(o) && o.length === 2 ? o : [o, "asc"])
    const len = opt.length;
    return products.filter(p => p.category === "Fruit" && p.price >= 10).slice(3, 6).sort((a, b) => {
        let comparison = 0;

        for (let i = 0; i < len; i++) {
            const op = opt[i]
            const priority = len - i

            // [key: keyof T, order: "asc" | "desc"]
            const [key, order] = op

            const val1 = (isNullOrUndefined(a[key]) ? 0 : a[key]) as any
            const val2 = (isNullOrUndefined(b[key]) ? 0 : b[key]) as any

            let cmp = val1 === val2 ? 0 : (
                val1 < val2 ? -1 : 1
            )
            cmp *= priority;
            if (order === "desc") cmp *= -1

            comparison += cmp

        }
        return comparison;
    }).map(p => {
        const data = {} as Product
        fields.forEach(f => {
            (data[f] as Product[typeof f]) = p[f]
        })
        return data
    })
}

export type Product = {
    id: number;
    name: string;
    price: number;
    category: string;
    fav?: boolean
}


// Example usage
export const products: Product[] = [
    { id: 1, name: "Apple", price: 512, category: "Fruit", fav: true },
    { id: 2, name: "Banana", price: 112, category: "Fruit" },
    { id: 3, name: "Grapes", price: 612, category: "Fruit" },
    { id: 4, name: "Orange", price: 812, category: "Fruit" },
    { id: 5, name: "Potato", price: 118, category: "Vegetable", fav: true },
    { id: 6, name: "Milk", price: 712, category: "Dairy" },
    { id: 7, name: "Apple", price: 512, category: "Fruit" },
    { id: 8, name: "Banana", price: 612, category: "Fruit" },
    { id: 9, name: "Grapes", price: 612, category: "Fruit", fav: true },
    { id: 10, name: "Orange", price: 812, category: "Fruit" },
    { id: 11, name: "Potato", price: 119, category: "Vegetable" },
    { id: 16, name: "Milk", price: 112, category: "Dairy" },
    { id: 19, name: "Apple", price: 512, category: "Fruit" },
    { id: 20, name: "Banana", price: 512, category: "Fruit" },
    { id: 21, name: "Grapes", price: 612, category: "Fruit" },
    { id: 22, name: "Orange", price: 812, category: "Fruit" },
    { id: 23, name: "Potato", price: 120, category: "Vegetable" },
    { id: 24, name: "Milk", price: 812, category: "Dairy" },
    { id: 25, name: "Apple", price: 512, category: "Fruit" },
    { id: 26, name: "Banana", price: 112, category: "Fruit" },
    { id: 27, name: "Grapes", price: 612, category: "Fruit" },
    { id: 28, name: "Orange", price: 812, category: "Fruit" },
    { id: 29, name: "Potato", price: 121, category: "Vegetable" },
    { id: 30, name: "Milk", price: 712, category: "Dairy" },
    { id: 31, name: "Apple", price: 512, category: "Fruit" },
    { id: 32, name: "Banana", price: 112, category: "Fruit" },
    { id: 33, name: "Grapes", price: 612, category: "Fruit" },
    { id: 34, name: "Orange", price: 812, category: "Fruit" },
    { id: 35, name: "Potato", price: 112, category: "Vegetable" },
    { id: 36, name: "Milk", price: 712, category: "Dairy" },
    { id: 37, name: "Apple", price: 512, category: "Fruit" },
    { id: 38, name: "Banana", price: 112, category: "Fruit" },
    { id: 39, name: "Grapes", price: 612, category: "Fruit" },
    { id: 40, name: "Orange", price: 812, category: "Fruit" },
    { id: 41, name: "Potato", price: 612, category: "Vegetable" },
    { id: 42, name: "Milk", price: 812, category: "Dairy" },
    { id: 43, name: "Apple", price: 512, category: "Fruit" },
    { id: 44, name: "Banana", price: 112, category: "Fruit" },
    { id: 45, name: "Grapes", price: 612, category: "Fruit" },
    { id: 46, name: "Orange", price: 812, category: "Fruit" },
    { id: 47, name: "Potato", price: 512, category: "Vegetable" },
    { id: 48, name: "Milk", price: 712, category: "Dairy" },
];
