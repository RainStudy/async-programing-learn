import MyPromise from "./promise";
import generatorRuntime from "./generator-runtime";

// new MyPromise<number>((resolve, reject) => {
//     setTimeout(() => resolve(1), 5000)
// })
// .then((value) => console.log(value))
// .then(() => {
//     throw new Error("end")
// })
// .then(() => {}, (e) => {
//     console.log(e)
// })

// function* generate() {
//     console.log("hello generator")
//     yield 1
//     console.log("hello world")
//     yield 2
//     console.log("hello js")
//     yield 3
//     console.log("hello ts")
// }

// const gen = generate()
// let result = gen.next()

// while (!result.done) {
//     console.log(result.value)
//     result = gen.next()
// }

// const SUSPEND_COROUTINE = 1

// function* suspendFunc(continuation: Continuation) {
//     console.log(1)
//     // 假设这里调用了一个挂起函数，在这里挂起，并返回一个挂起标志
//     yield SUSPEND_COROUTINE
//     // 恢复执行，并拿到挂起函数的返回值
//     console.log(continuation.value)
// }

// interface Continuation {
//     value?: any
// }

// const continuation: Continuation = {}

// const gen = suspendFunc(continuation)

// // 这里挂起
// gen.next()
// // 在其他线程/协程执行完毕挂起函数并恢复当前挂起函数，将挂起函数返回值放入状态机
// continuation.value = "一眼丁真 鉴定为挂起函数"
// gen.next()
let word: string;
const gen = generatorRuntime.wrap((context) => {
    while (1) {
        switch ((context.prev = context.next)) {
          case 0:
            word = "hello world";
            context.next = 3;
            return "result1";
  
          case 3:
            console.log(word);
            context.next = 6;
            return "result2";
  
          case 6:
            context.next = 8;
            return "result3";
  
          case 8:
          case "end":
            return context.stop();
        }
      }
})

let res = gen.next()

while (!res.done) {
    console.log(res.value)
    res = gen.next()
}