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
const SUSPEND_COROUTINE = 1

function* suspendFunc(continuation: Continuation) {
    console.log(1)
    // 假设这里调用了一个挂起函数，在这里挂起，并返回一个挂起标志
    yield SUSPEND_COROUTINE
    // 恢复执行，并拿到挂起函数的返回值
    console.log(continuation.value)
}

interface Continuation {
    value?: any
}

const continuation: Continuation = {}

const gen = suspendFunc(continuation)

// 这里挂起
gen.next()
// 在其他线程/协程执行完毕挂起函数并恢复当前挂起函数，将挂起函数返回值放入状态机
continuation.value = "一眼丁真 鉴定为挂起函数"
gen.next()
~~~

如此便用generator简单的实现了Kotlin挂起函数的挂起，不过恢复执行并没有实现

接下来我们来看看generator是如何实现的。仔细想想也能知道，要实现这种魔法一般的特性运行时特性就显得有些无力了，想必需要在编译期动一些手脚。我们使用babel将一段generator代码转换到低版本，看看babel是怎么做的。

源代码

~~~js
function* foo() {
  let word = "hello world"
  yield 'result1'
  console.log(word)
  yield 'result2'
  yield 'result3'
}
  
const gen = foo()
console.log(gen.next().value)
console.log(gen.next().value)
console.log(gen.next().value)
~~~

经过babel转译后的代码

~~~js
// ...

var _marked = /*#__PURE__*/ _regeneratorRuntime().mark(foo);

function foo() {
  var word;
  return _regeneratorRuntime().wrap(function foo$(_context) {
    while (1) {
      switch ((_context.prev = _context.next)) {
        case 0:
          word = "hello world";
          _context.next = 3;
          return "result1";

        case 3:
          console.log(word);
          _context.next = 6;
          return "result2";

        case 6:
          _context.next = 8;
          return "result3";

        case 8:
        case "end":
          return _context.stop();
      }
    }
  }, _marked);
}

var gen = foo();
console.log(gen.next().value);
console.log(gen.next().value);
console.log(gen.next().value);
~~~

其中regeneratorRuntime来自facebook的regenerator-runtime模块，源码在 [runtime.js](https://github.com/facebook/regenerator/blob/main/packages/runtime/runtime.js)。源码我就不看了，我们简单实现一个丐版的就好。

我们先来分析`foo$`这段代码，一个死循环，使用switch语句来区分每个yield点，通过context这个状态机中保存的状态来决定从哪里开始执行，很好理解，跟使用label/break实现的kotlin的挂起函数有异曲同工之妙。代码中的所有变量都被提到函数外面，这样便能在任意位置访问。

有了编译器的加持，相信大家应该都差不多知道该怎么实现一个简单的generator了，直接上源码 [generator-runtime](./src/generator-runtime.ts)

再来测试一下

~~~ts
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
~~~

输出结果

~~~
result1
hello world
result2
result3
~~~

完美！

## async & await

我们已经翻过了generator这座大山，那么async await就相当简单了。async await说白了就是对generator和promise的组合封装而已，这两者实际上都是依靠状态机保存状态，所以async await的实现原理也是靠状态机。

async await其实就是一个自动执行的，yield和返回值都是promise的generator。

让我们先看看手动执行是怎么做的

~~~js
function* myGenerator() {
  console.log(yield Promise.resolve(1))   //1
  console.log(yield Promise.resolve(2))   //2
  console.log(yield Promise.resolve(3))   //3
}

// 手动执行迭代器
const gen = myGenerator()
gen.next().value.then(val => {
  // console.log(val)
  gen.next(val).value.then(val => {
    // console.log(val)
    gen.next(val).value.then(val => {
      // console.log(val)
      gen.next(val)
    })
  })
})
~~~

这样做十分麻烦，而且产生了回调地狱

那么我们手动封装一下？

~~~js
function run(gen) {
  var g = gen()                     //由于每次gen()获取到的都是最新的迭代器,因此获取迭代器操作要放在_next()之前,否则会进入死循环

  function _next(val) {             //封装一个方法, 递归执行g.next()
    var res = g.next(val)           //获取迭代器对象，并返回resolve的值
    if(res.done) return res.value   //递归终止条件
    res.value.then(val => {         //Promise的then方法是实现自动迭代的前提
      _next(val)                    //等待Promise完成就自动执行下一个next，并传入resolve的值
    })
  }
  _next()  //第一次执行
}

function* myGenerator() {
  console.log(yield Promise.resolve(1))   //1
  console.log(yield Promise.resolve(2))   //2
  console.log(yield Promise.resolve(3))   //3
}

run(myGenerator)
~~~

这样就达到了async await的效果
