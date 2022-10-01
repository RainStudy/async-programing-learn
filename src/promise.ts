type ResolveFunc<T> = (val: T) => void
type RejectFunc = (reason?: any) => void

type ThenResolveFunc<T, R> = (val: T) => R
type ThenRejectFunc = (reason?: any) => any

/**
 * 根据Promise/A+规范
 * 
 * Promise本质是一个状态机，且状态只能为以下三种：Pending（等待态）、Fulfilled（执行态）、Rejected（拒绝态）
 * ，状态的变更是单向的，只能从Pending -> Fulfilled 或 Pending -> Rejected，状态变更不可逆
 * then方法接收两个可选参数，分别对应状态改变时触发的回调。then方法返回一个promise。then 方法可以被同一个 promise 调用多次。
 */
export default class MyPromise<T> {

    private resolveQueue: ThenResolveFunc<any, any>[] = []
    private rejectQueue: ThenRejectFunc[] = []
    private status: Status = Status.PENDING
    private value?: T

    constructor(executor: (resolve: ResolveFunc<T>, reject: RejectFunc) => void) {
        const resolve = (val: T) => {
            // 这里使用setTimeout将其放入微任务队列，兼容executor为同步代码的情况
            const run = () => {
                if (this.status !== Status.PENDING) return
                this.status = Status.FULFILLED
                this.value = val

                while (this.resolveQueue.length) {
                    this.resolveQueue.shift()?.call(undefined, val)
                }
            }
            setTimeout(run)
        }
        const reject = (reason?: any) => {
            const run = () => {
                if (this.status !== Status.PENDING) return
                this.status = Status.REJECTED
                while (this.rejectQueue.length) {
                    this.rejectQueue.shift()?.call(undefined, reason)
                }
            }
            setTimeout(run)
        }
        executor(resolve, reject)
    }

    then<N>(resolveFn?: ThenResolveFunc<T, N>, rejectFn: ThenRejectFunc = () => { }): MyPromise<N> {
        // 根据规范，如果then的参数不是function，则我们需要忽略它, 让链式调用继续往下执行
        typeof resolveFn !== 'function' ? resolveFn = value => value as unknown as N : null
        typeof rejectFn !== 'function' ? rejectFn = reason => {
            throw new Error(reason instanceof Error ? reason.message : reason);
        } : null

        return new MyPromise((resolve, reject) => {
            //把resolveFn重新包装一下,再push进resolve执行队列,这是为了能够获取回调的返回值进行分类讨论
            const fulfilledFn = (value: T) => {
                try {
                    //执行第一个(当前的)Promise的成功回调,并获取返回值
                    let x = resolveFn!(value)
                    //分类讨论返回值,如果是Promise,那么等待Promise状态变更,否则直接resolve
                    //这里resolve之后，就能被下一个.then()的回调获取到返回值，从而实现链式调用
                    x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
                } catch (error) {
                    reject(error)
                }
            }
            //把后续then收集的依赖都push进当前Promise的成功回调队列中(rejectQueue), 这是为了保证顺序调用
            this.resolveQueue.push(fulfilledFn)

            //reject同理
            const rejectedFn = (error?: any) => {
                try {
                    let x = rejectFn(error)
                    x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
                } catch (error) {
                    reject(error)
                }
            }
            this.rejectQueue.push(rejectedFn)

            switch (this.status) {
                // 当状态为pending时,把then回调push进resolve/reject执行队列,等待执行
                case Status.PENDING:
                    this.resolveQueue.push(fulfilledFn)
                    this.rejectQueue.push(rejectedFn)
                    break
                // 当状态已经变为resolve/reject时,直接执行then回调
                case Status.FULFILLED:
                    fulfilledFn(this.value!)    // this.value是上一个then回调return的值(见完整版代码)
                    break
                case Status.REJECTED:
                    rejectedFn(this.value)
                    break
            }
        })
    }

    catch(rejectFn: ThenRejectFunc): MyPromise<T> {
        return this.then(undefined, rejectFn)
    }

    finally(callback: () => void) {
        return this.then(
            value => MyPromise.resolve(callback()).then(() => value),             // MyPromise.resolve执行回调,并在then中return结果传递给后面的Promise
            reason => MyPromise.resolve(callback()).then(() => { throw reason })  // reject同理
        )
    }

    static resolve<T>(value: T): MyPromise<T> {
        if (value instanceof MyPromise) return value // 根据规范, 如果参数是Promise实例, 直接return这个实例
        return new MyPromise(resolve => resolve(value))
    }

    static reject<T>(err?: any): MyPromise<T> {
        return new MyPromise((resolve, reject) => reject(err))
    }

    static all<T>(promiseArr: MyPromise<T>[]) {
        let index = 0
        let result: MyPromise<T>[] = []
        return new MyPromise((resolve, reject) => {
            promiseArr.forEach((p, i) => {
                //Promise.resolve(p)用于处理传入值不为Promise的情况
                MyPromise.resolve(p).then(
                    val => {
                        index++
                        result[i] = val
                        //所有then执行后, resolve结果
                        if (index === promiseArr.length) {
                            resolve(result)
                        }
                    },
                    err => {
                        //有一个Promise被reject时，MyPromise的状态变为reject
                        reject(err)
                    }
                )
            })
        })
    }

    static race<T>(promiseArr: MyPromise<T>[]) {
        return new MyPromise((resolve, reject) => {
            //同时执行Promise,如果有一个Promise的状态发生改变,就变更新MyPromise的状态
            for (let p of promiseArr) {
                MyPromise.resolve(p).then(  //Promise.resolve(p)用于处理传入值不为Promise的情况
                    value => {
                        resolve(value)        //注意这个resolve是上边new MyPromise的
                    },
                    err => {
                        reject(err)
                    }
                )
            }
        })
    }


}

enum Status {
    PENDING, FULFILLED, REJECTED
}