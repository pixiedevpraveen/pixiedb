/**-----------------------------------------------------
 * A tiny javascript in memory database with indexing and filters.
 *
 * @author Praveen yadav
 * @see https://github.com/pixiedevpraveen/pixiedb/tree/master/docs/index.md
 * ---
 * @example
 * const pd = new PixieDb('id', ["price", "category"], products) // data is optional can be load after using the load method
 * const byId = pd.select().eq("id", 2).single() // { id: 2, name: "Banana", price: 10, category: "Fruit" }
 * const allByName = pd.select().eq("name", "Apple").orderBy(["name", ["price", "desc"]]).data() // [{ id: 1, name: "Apple", price: 10, category: "Fruit" }, ...]
 * console.log(byId, allByName);
 */
export class PixieDb<T extends Record<any, any>, Key extends keyof T> {
}
