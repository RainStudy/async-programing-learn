import MyPromise from "./promise";

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

function* suspendFunc() {
    
}

interface Continuation {
    value: any

}