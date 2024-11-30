export class PDBError<N extends PDBErrorType> extends Error {
    name: `${PDBErrorType}Error`
    constructor(name: N, msg?: string) {
        super(msg)
        this.name = `${name}Error`
    }
}

type PDBErrorType = 'Property' | 'Value' | 'Type' | 'Event' | 'Action' | 'Filter'
