export class MoneyValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MoneyValidationError";
    }
}
