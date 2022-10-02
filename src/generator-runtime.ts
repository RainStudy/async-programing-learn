export default {
    wrap: <T>(gen: CompliedGeneratorFunc<T>): Generator<T> => {
        const context: Context = {
            next: 0,
            prev: 0,
            done: false,
            stop() {
                this.done = true
            },
        }
        return {
            next(): IteratorResult<T> {
                return {
                    value: context.done ? undefined : gen(context),
                    done: context.done
                }
            },
        }
    }
}

type CompliedGeneratorFunc<T> = (context: Context) => T

interface Context {
    next: number | "end"
    prev: number | "end"
    done: boolean
    stop(): void
}

interface Generator<T> {
    next(): IteratorResult<T>
}

interface IteratorResult<T> {
    value?: T,
    done: boolean
}