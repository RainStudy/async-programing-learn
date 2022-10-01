# Javascript异步 promise & generator & async await

## EventLoop

基本是一切异步编程语言/框架的基础，现代异步程序开发离不开的一个概念 —— **事件循环**

其实很好理解，我们简单写一段代码

~~~ts
// 用户逻辑
function mainFunc() {
    // ...
}

// 内部逻辑
// 任务队列
const taskQueue: (() => void)[] = [mainFunc]

while(taskQueue.length) {
    taskQueue.shift()?.call()
}
~~~

这就是最简单的一个事件循环模型。像setTimeout/setInterval这些schedule task的操作本质上不过是向taskQueue提交任务罢了，在taskQueue为空时则代表所有任务都已经执行完毕，则退出程序。

这个设计无论在客户端一侧还是服务端一侧都大量使用，例如Android app开发中的Handler体系，Kotlin协程的底层实现，再比如golang中goroutine的底层实现

nodejs与浏览器使用的V8 javascript引擎都有管理mirco task的能力。换句话说，就是在运行脚本时先在js引擎线程拉起了一个事件循环，并将解释执行目标脚本文件作为taskQueue中的第一个任务。这也是很多较新语言的做法(golang, dart, rust, kotlin中的suspend main函数...)，这样便使得语言本身拥有了强大的异步编程支持 。

如果你了解过java或其他语言中池化线程的做法，也许会发现事件循环与线程池的实现原理区别不大。我的看法是，事件循环的本质事实上是池化了主线程（或者说第一条用户线程），让主线程成为了一个单线程池。

## Promise

> Promise顾名思义就是一个承诺，在未来的某个时间兑现的承诺
>
> 至于这个承诺什么时候兑现？不知道，也有可能永远都不会兑现

如果有其他某些语言的基础（java/dart/rust...），你可以把Promise看作对应语言中的Future，它们本质上没有区别

至于基本用法这里就不阐述了，不会的话可以看看 [web前端第六节课：异步编程](https://www.yuque.com/gyxffu/cxtv2c/ukicmg#f0d6cc6d)

直接上硬货 [Promise的简单实现](./src/promise.ts)

## Generator

> ES6 为js带来了Generator语法解决异步编程中的痛点，可惜不久后就有了更好用的async await :D

其他很多语言中也有这个特性，例如Python和早期的rust(rust最早的async await与js一样，底层由generator实现)

Python中的Generator在《深入理解Kotlin协程》一书中被霍老师看作一种典型的无栈协程的实现

> Python 3.5之后也有了 async/await. 在大部分情况，开发者们都不再需要与generator打交道了。

在这里贴一个js中generator语法的实际范例

~~~ts
function* generate() {
    console.log("hello generator")
    yield 1
    console.log("hello world")
    yield 2
    console.log("hello js")
    yield 3
    console.log("hello ts")
}

const gen = generate()
let result = gen.next()

while (!result.done) {
    console.log(result.value)
    result = gen.next()
}
~~~

~~~
hello generator
1
hello world
2
hello js
3
hello ts
~~~

是不是很神奇?每次调用生成器的next方法都会在下一个yield处返回，yield顾名思义就是让出控制权，让出当前函数调用的控制权。而返回的这个值是不是可以理解为该生成器的当前执行状态？

写到这里发现它与Kotlin挂起函数的实现有异曲同工之妙，kotlin协程的底层（至少在jvm平台）实现也是通过返回一个值来让出控制权，而这个值标识了这个函数的执行状态，它可能是最终的返回值，也有可能是该挂起函数的状态机，状态机中保存了当前函数上一次挂起是在哪里，恢复所需要的值等，挂起函数通过传入的状态机来决定从哪里开始执行。一旦返回值不为状态机，这个挂起函数就如同普通函数一样返回。

写到这里发现自己Kotlin协程的基础实现还掌握的不是很牢固，再去看了 [蔷神的笔记](https://github.com/False-Mask/KotlinCoroutine) 复习了下

纸上得来终觉浅，绝知此事要躬行，来段代码

~~~ts
~~~

