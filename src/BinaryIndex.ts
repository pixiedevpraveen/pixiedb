export class BinaryIndex<K extends any, V> {
    private root: Node<K, V> | null = null
    /**
     * min node
    */
    private mn: Node<K, V> | null = null
    /**
     * max node
    */
    private mx: Node<K, V> | null = null

    /**
     * set key and value in the tree and return true if set else false.
     * if found the key then update the value.
    */
    set(key: K, val: V, upsert = true): boolean {
        /**
         * new node from provided key-value
        */
        const n = new Node(key, val)

        /**
         * current node to traverse
        */
        let cn = this.root
        if (cn) {
            while (true) {
                if (key === cn.key) {
                    if (upsert) {
                        cn.value = val
                        break
                    }
                    return false
                }
                else if (key < cn.key) {
                    if (!cn.left) {
                        cn.left = n
                        n.parent = cn
                        break
                    } else
                        cn = cn.left
                } else {
                    if (!cn.right) {
                        cn.right = n
                        n.parent = cn
                        break
                    } else
                        cn = cn.right
                }
            }
            this.fixTree(n)
        } else {
            this.root = n
            this.root.isRed = false
        }
        this.setMinMax(n)
        return true
    }

    private setMinMax(n: Node<K, V>) {
        if (!this.mx || this.mx.key < n.key)
            this.mx = n
        if (!this.mn || this.mn.key > n.key)
            this.mn = n
    }

    /**
     * get the value using the provided key
     * @param key key to find
    */
    get(key: K): V | undefined {
        return this.getNode(key)?.value
    }

    /**
     * Get all key value pair where key is between lb (lower bound) and ub (upper bound) values
     * @param lb lower bound
     * @param ub upper bound
    */
    btw(lb: K, ub: K): V[] {
        let cn = this.root
        if (!cn) return []
        const res: V[] = [];
        let st: Node<K, V>[] = []; // Initialize stack with root node

        while (true) {
            if (cn) {
                st.push(cn)
                cn = cn.left
            } else if (st.length) {
                cn = st.pop()!
                if (cn.key >= lb && cn.key <= ub)
                    res.push(cn.value) // Process current node
                else if (cn.key > ub)
                    break // Stop processing nodes in right subtree 
                cn = cn.right // Process right subtree
            } else {
                break // Stack is empty and current node is null, so we're done 
            }
        }

        return res;
    }

    /**
     * Return array of key value pair respect to provided keys
     * @param keys array of keys to find values
    */
    in(keys: K[]): V[] {
        const r: V[] = []
        for (const key of keys) {
            const n = this.getNode(key)
            if (n) r.push(n.value)
        }
        return r
    }

    /**
     * @param cmp comparator function which accept key and value and return -1 for left, 1 for right and 0 to exit/return.
    */
    trav(cmp: (key: K, val: V) => number): void {
        let cn = this.root
        let res: number | undefined
        while (cn) {
            res = cmp(cn.key, cn.value)
            if (res > 0)
                cn = cn.right
            else if (res < 0)
                cn = cn.left
            else
                return
        }
    }

    /**
     * @param ub upper bound
     * @returns array of pair of key and value less than or equal to
    */
    lt(ub: K, eq?: boolean): V[] {
        /**
         * result array
        */
        const r: V[] = []

        /**
         * Stack of nodes
        */
        const st: Node<K, V>[] = []
        /**
         * current node to traverse
        */
        let cn = this.root

        while (cn) {
            if (cn.key < ub || (eq && cn.key === ub)) {
                st.push(cn)
                cn = cn.right
            } else
                cn = cn.left
        }

        while (st.length > 0) {
            cn = st.shift()!
            r.push(cn.value)
            cn = cn.left
            while (cn) {
                st.push(cn)
                cn = cn.right
            }
        }

        return r
    }

    /**
     * @param lb lower bound
     * @returns array of pair of key and value greater than or equal to
    */
    gt(lb: K, eq?: boolean): V[] {
        const r: V[] = []
        let cn = this.root
        // Handle empty tree or invalid range
        if (!cn || lb >= this.maxNode()!.key) return r

        const st: Node<K, V>[] = []

        while (cn) {
            if (cn.key > lb || (eq && cn.key === lb)) {
                st.push(cn)
                cn = cn.left
            } else
                cn = cn.right
        }

        while (st.length > 0) {
            cn = st.pop()!

            r.push(cn.value)
            cn = cn.right
            while (cn) {
                st.push(cn)
                cn = cn.left
            }
        }

        return r
    }

    /**
     * delete from the tree
     * @param key Key to find and delete the node
    */
    delete(key: K): V | undefined {
        const n = this.getNode(key)
        if (!n) return
        this.deleteNode(n)
        return n.value
    }

    /**
     * @param n node to fix the tree
    */
    private fixTree(n: Node<K, V>): void {
        // Red-Black Tree insertion balancing rules
        while (n && n.parent && n.parent.isRed) {
            /**
             * uncle Node
            */
            let un: Node<K, V> | null
            if (n.parent === n.parent!.parent!.left)
                un = n.parent!.parent!.right
            else
                un = n.parent!.parent!.left

            if (un && un.isRed) {
                // Case 1: Recolor
                n.parent.isRed = false
                un.isRed = false
                n = n.parent.parent!
            } else {
                if (n === n.parent!.right && n.parent === n.parent!.parent!.left) {
                    // Case 2: Left rotation
                    n = n.parent
                    this.leftRotate(n)
                } else if (n === n.parent!.left && n.parent === n.parent!.parent!.right) {
                    // Case 3: Right rotation
                    n = n.parent
                    this.rightRotate(n)
                }

                // Case 4: Recolor and rotate (parent becomes black)
                n.parent!.isRed = false
                /**
                 * Grand parent
                */
                const gp = n.parent!.parent // Store grandparent (might be null)
                if (gp) { // Check for null grandparent before accessing properties
                    gp.isRed = true
                    if (n === n.parent!.left)
                        this.rightRotate(gp)
                    else
                        this.leftRotate(gp)
                }
            }
        }

        this.root!.isRed = false; // Ensure root is always black
    }

    /**
     * @param n node to rotate
    */
    private leftRotate(n: Node<K, V>): void {
        /**
         * Right child
        */
        const rc = n.right!
        n.right = rc.left
        if (rc.left)
            rc.left.parent = n
        rc.parent = n.parent

        if (!n.parent)
            this.root = rc
        else if (n === n.parent.left)
            n.parent.left = rc
        else
            n.parent.right = rc

        rc.left = n
        n.parent = rc
    }

    /**
     * @param n node to rotate
    */
    private rightRotate(n: Node<K, V>): void {
        /**
         * left child
        */
        const lc = n.left!
        n.left = lc.right

        if (lc.right)
            lc.right.parent = n

        lc.parent = n.parent

        if (!n.parent)
            this.root = lc
        else if (n === n.parent.left)
            n.parent.left = lc
        else
            n.parent.right = lc


        lc.right = n
        n.parent = lc
    }

    /**
     * find node using the key
    */
    getNode(key: K): Node<K, V> | undefined {
        /**
         * current node to traverse
        */
        let cn = this.mn

        // checking if the key is min then return min and if lower than min then return undefined (means key is not in tree)
        if (cn) {
            if (cn.key === key) return cn
            if (cn.key > key) return
        }
        cn = this.mx
        // checking if the key is max then return max and if greater than max then return undefined (means key is not in tree)
        if (cn) {
            if (cn.key === key) return cn
            if (cn.key < key) return
        }

        cn = this.root
        while (cn) {
            if (key === cn.key)
                return cn
            else if (key < cn.key)
                cn = cn.left
            else
                cn = cn.right
        }
    }

    /**
     * @param n node from where to find min Node
    */
    minFrom(n: Node<K, V>): Node<K, V> {
        let cn = n
        while (cn.left)
            cn = cn.left

        return cn
    }

    /**
     * find max Node
    */
    maxNode(): Node<K, V> | null {
        if (this.mx) return this.mx

        /**
         * current node to traverse
        */
        let cn = this.root
        while (cn && cn.right)
            cn = cn.right

        return this.mx = cn
    }

    /**
     * find min Node
    */
    minNode(): Node<K, V> | null {
        if (this.mn) return this.mn
        return this.root ? this.mn = this.minFrom(this.root) : null
    }

    /**
     * find min key value pair
    */
    min(): [K, V] | undefined {
        const n = this.minNode()
        if (n)
            return [n?.key, n?.value]
    }

    /**
     * find max key value pair
    */
    max(): [K, V] | undefined {
        const n = this.maxNode()
        if (n)
            return [n?.key, n?.value]
    }

    /**
     * delete node from the tree
     * @param n node to delete from the tree
    */
    deleteNode(n: Node<K, V>): void {
        /**
         * moved up node
        */
        let un: Node<K, V> | null = null

        /**
         * replacement node
        */
        let rn: Node<K, V> | null = null

        if (!n.left)
            rn = n.right
        else if (!n.right)
            rn = n.left
        else {
            rn = this.minFrom(n.right)
            if (rn !== n.right) {
                un = rn
                this.transplant(rn, rn.right)
                rn.right = n.right
                rn.right.parent = rn
            }
            this.transplant(n, rn)
            rn.left = n.left
            rn.left.parent = rn
            rn.isRed = n.isRed
        }

        if (n === this.root)
            this.root = rn
        else {
            if (un)
                un.parent = n.parent
            else
                this.transplant(n, rn)
        }

        if (!n.isRed)
            this.fixDeletion(rn === null ? n : rn)

        // TODO: assign min max from left, right or parent
        if (this.mx === n)
            this.mx = null
        if (this.mn === n)
            this.mn = null
    }

    /**
     * @param on oldNode
     * @param n newNode
    */
    private transplant(on: Node<K, V>, n: Node<K, V> | null): void {
        if (!on.parent)
            this.root = n
        else if (on === on.parent.left)
            on.parent.left = n
        else
            on.parent.right = n

        if (n)
            n.parent = on.parent

    }

    /**
     * Fix the tree around node after node deletion
     * @param n node which deleted by deleteNode
    */
    private fixDeletion(n: Node<K, V> | null): void {
        while (n !== this.root && n && !n.isRed) {
            if (n === n.parent?.left) {
                /**
                 * sibling node
                */
                let sn = n.parent.right
                if (sn?.isRed) {
                    sn.isRed = false
                    n.parent.isRed = true
                    this.leftRotate(n.parent)
                    sn = n.parent.right
                }
                if (sn) {
                    if ((!sn.left || !sn.left.isRed) &&
                        (!sn.right || !sn.right.isRed)) {
                        sn.isRed = true
                        n = n.parent
                    } else {
                        if (!sn.right || !sn.right.isRed) {
                            sn.left!.isRed = false
                            sn.isRed = true
                            this.rightRotate(sn)
                            sn = n.parent.right!
                        }
                        sn.isRed = n.parent.isRed
                        n.parent.isRed = false
                        sn.right!.isRed = false
                        this.leftRotate(n.parent)
                        n = this.root
                    }
                } else
                    n = n.parent
            } else {
                /**
                 * sibling node
                */
                let sn = n.parent?.left
                if (sn?.isRed) {
                    sn.isRed = false
                    n.parent!.isRed = true
                    this.rightRotate(n.parent!)
                    sn = n.parent?.left
                }
                if (sn) {
                    if ((!sn.left || !sn.left.isRed) &&
                        (!sn.right || !sn.right.isRed)) {
                        sn.isRed = true
                        n = n.parent!
                    } else {
                        if (!sn.left || !sn.left.isRed) {
                            sn.right!.isRed = false
                            sn.isRed = true
                            this.leftRotate(sn)
                            sn = n.parent?.left!
                        }
                        sn.isRed = n.parent!.isRed
                        n.parent!.isRed = false
                        sn.left!.isRed = false
                        this.rightRotate(n.parent!)
                        n = this.root
                    }
                } else
                    n = n.parent!
            }
        }
        if (n) n.isRed = false
    }

    /**
     * method to clear the tree.
     */
    clear(): void {
        this.root = this.mx = this.mn = null
    }
}

class Node<K extends any, V> {
    /**
     * Key to compare
    */
    key: K

    /**
     * value to store
    */
    value: V

    /**
     * color of the node
     * true='red',
     * false='black'
    */
    isRed: boolean

    /**
     * left node
    */
    left: Node<K, V> | null

    /**
     * right node
    */
    right: Node<K, V> | null

    /**
     * top/parent node
    */
    parent: Node<K, V> | null

    /**
     * create new node and set left, right and parent to null
     * @param key key of the node to compare
     * @param val value/data to store in the node
     * @param [clr='R'] color of the node
    */
    constructor(key: K, val: V, clr = true) {
        this.key = key
        this.value = val
        this.isRed = clr
        this.left = this.right = this.parent = null
    }
}
