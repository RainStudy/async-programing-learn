# kotlin-coroutine

> 这我们可得给他翻个底朝天才行

本文章假定读者已经懂得了kotlin协程的基本使用方式与概念，如挂起恢复，切换线程，转换回调为挂起函数等基本操作

## 什么是协程？

我们先来给协程下个定义，只要我们可以控制一段逻辑在尚未执行完成时让出控制权，让其他逻辑得到控制权，这个东西就可以称作协程。这么说，你是不是想到了什么？Java的线程提供了一个方法让出当前线程所占有的时间分片（也就是控制权）`Thread#yield()`，说实话我很少用到它，它一般用来实现高效的多线程抢占式调度。所以我们也可以把java的线程看作一种协程的实现。

那么要如何让出？在何时何地可以让出？让出了之后要怎么恢复（如何调度）？于是根据这三个问题便区分出了有栈/无栈协程，对称/非对称协程的概念。

### 有栈协程 stackful coroutine

> 每一个协程都有自己的调用栈，有点类似于线程的调用栈，这种情况下的协程实现其实很大程度上接近线程，主要的不同体现在调度上。

线程有线程栈，协程也有协程栈，那么要让出调度权就很简单了，既然有栈保存执行状态，协程可以在任意位置挂起。跟线程的上下文切换一样，协程也可以实现上下文切换。这一点最典型的实现就是golang的协程goroutine，它直接在语言层面把协程封装成如java线程一样开箱即用的api，也有上下文切换，唯一的区别就是它用起来比java的线程要轻量得多，大多数时候不用考虑池化复用的做法。

### 无栈协程 stackless coroutine

> 协程没有自己的调用栈，挂起点的状态通过状态机或者闭包等语法来实现

由于没有调用栈，这类协程不能在任意位置，在任意情况下挂起，也就没法实现上下文切换。一般这类协程主动提供给用户yield/resume的api来让用户手动控制调度权转移，或者做一些封装。例如Generator语法，async/await，这些都是典型的无栈协程实现。之前我们在js异步篇已经详细分析过它们的实现原理，故不再赘述。

> kotlin协程一般看作一种无栈协程的实现，**它的控制流转依靠对协程体本身编译生成的状态机的状态流转来实现，变量保存也是通过闭包语法实现的**。不过，Kotlin的协程可以在挂起函数范围内的任意调用层次挂起（也就是说，如果所有调用都是挂起函数，就可以在任意时刻，任意位置挂起），换句话说，我们启动一个Kotlin协程，可以在其中嵌套suspend函数，而这恰恰又是有栈协程的重要特性之一。

### 对称协程 symmetric coroutine

根据调度方式分类，协程可以分为对称协程与非对称协程两种。对称与否主要是看多个协程之间通讯的情况下每个协程的地位是否对等。

> 任何一个协程都是相互独立且平等的，调度权可以在任意协程之间转移。

对称协程实际上已经非常接近线程了，甚至说线程也可以算对称协程的一种实现，比如通过阻塞队列进行线程之间的基于生产-消费者模型的所谓调度权转移： 一条线程作为生产者，向队列中提交任务。一条线程作为消费者，取出并执行队列中的任务，这样便实现了一段逻辑在两条线程之间的调度权转移。而在协程中这对应着什么呢？没错，就是Channel。Channel的缓冲区大小对应着阻塞队列的大小，在溢出的情况下，阻塞队列会阻塞到有空位为止，而Channel则是将当前线程挂起到有空位为止。所以说想必大家都想到了，goroutine就是一种经典的对称协程实现，而Kotlin协程中也存在Channel API，并且封装了很多基于Channel API的API，比如Flow。所以kotlin协程也是可以进行对称性的协程调度的。

### 非对称协程 asymmetric coroutine

> 协程让出调度权的目标只能是它的调用者，即协程之间存在调用和被调用关系

光听上面这句话多少有点抽象了，那我们用js的await/async举个例子:

~~~js
async function delay(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), time)
    })
}

async function main() {
    console.log(1)
    await delay(1000)
    console.log(2)
}

main()
~~~

仔细分析上面的代码，首先我们进入main函数，执行到`await delay(1000)`这里，main函数让出调度权，交给delay。delay则在1000ms后将调度权归还给main函数。这里我们可以发现，无论如何，delay最终只能选择把调度权交还给main函数，而不能交给其他的异步函数，所以main与delay这两个异步函数，也就是协程，关系是不对等的。这就是**协程让出调度权的目标只能是它的调用者，即协程之间存在调用和被调用关系**，言简意骇。

那么我们是不是可以自然的联想到Kotlin协程的suspend function？

~~~kotlin
val scheduler = Executors.newScheduledThreadPoolExecutor()

suspend fun delay(time: Long) = suspendCancelableCoroutine {
    scheduler.schedule({
        it.resumeWith(Result.success(Unit))
    }, time)
}

suspend fun main() {
    println(1)
    delay(1000)
    println(2)
}
~~~

简直一模一样，所以我们几乎可以断定kotlin的挂起函数机制是非对称协程的一种实现。

但我们就可以这样给Kotlin协程下定义为非对称协程吗？那当然不能。

注意一下我们上面这个范例，在这里我们可以把main函数看作一个协程，delay函数看作一个调用者是main函数的协程。但我们发现这不对吧？如果挂起函数本身就是协程，那我们用`CoroutineScope#launch`启动的那个又叫什么？它当然也是协程，只不过它是对称意义上的协程，这launch的协程之间是可以通过Channel进行对称性调度的。而且你要说他对称他倒也不完全对称，我们知道，Kotlin协程实现了结构化并发，也就是说存在父协程和子协程的概念，父协程一旦取消，由父协程launch的子协程也会跟着取消，也就是说虽然可以以对称协程的形式转移调度权，协程之间的地位并不完全平等（不像Goroutine），不过至少在调度权控制这一点上他们是平等的。

### Kotlin协程是哪种协程

> 是什么不重要

是的，不重要。因为你要怎么说他都能找到一种合理的解释。你要说他是无栈协程，他当然是无栈协程，suspend函数底层就是通过状态机的状态流转，闭包语法实现，它也没有保存协程栈，也不能在非挂起函数调用时挂起。你要说他是有栈协程，也可以这么说，因为我们使用launch启动的协程中可以在其中任意嵌套suspend函数，也就是可以在任意挂起点挂起，这又是有栈协程的重要特性之一。而对称与非对称协程更是不必多说，我的评价是两者皆有。只要能通晓它的底层实现，便不用垢泥于片面的文字定义。

## 源码分析

> 话不多说，直接开冲

### Suspend Function & Suspend Lambda

我们都知道suspend函数在编译期其实是被动了些手脚的，我们先来观察一下一个空的挂起函数被编译成了什么样子

~~~kotlin
suspend fun test() {}
~~~

反编译后得到

~~~java
@Nullable
public static final Object test(@NotNull Continuation<? super Unit> $completion) {
     return Unit.INSTANCE;
}
~~~

我们可以观察到，函数的返回值变为了Object，并且入参数时多了一个Continuation的参数。由于我们什么都没有写，函数直接返回了一个Unit。

> ## CPS (continuation-passing-style) 变换
>
> 翻译为中文就是续体传递风格
>
> 每次调用函数就将一个Continuation作为参数传入，函数调用的结果不通过返回值传出，而是交给续体来回调
>
> ~~~kotlin
> fun interface Continuation<T> {
>  	fun next(result: T)
> }
> 
> fun cps(continuation: Continuation) {
>  	// do some operation
>  	val result = doSometing()
>  	continuation.next(result)
> }
> ~~~
>
> 这样做函数执行结果可以通过续体回调传递到外部，并且可以传递多次。
>
> 协程里通过在CPS的Continuation回调里结合状态机(CoroutineContext)流转，来实现协程挂起-恢复的功能.

> ## 关于Unit的编译器优化
>
> 其实这里返回Unit也是有说法的，Kotlin编译期并不会把所有`Unit`都翻译为`Unit.INSTANCE`这个Object。我们知道Kotlin万物皆对象，根本不需要像java一样考虑基本类型拆箱装箱的问题。Kotlin中Unit是一个单例，同时他的类型也被当作java中void的替代使用。但java中的void是没有办法像基础类型一样进行装箱拆箱的，换句话说，它根本不是，也不能转化为一个Object。当我们在Kotlin中会遇到需要将Unit作为泛型参数/单例对象的情况，这个时候Kotlin就会老老实实将其编译为Unit类型/Unit.INSTANCE单例。所以在Kotlin里，Unit是Any的子类。但在Unit单纯发挥了void职能的情况下，Kotlin为性能考虑会直接返回void，这样也能少几行字节。
>
> 例如下面的例子
>
> ~~~kotlin
> fun main() {
> 
> }
> ~~~
>
> ~~~java
> public static final void main() {}
> ~~~
>
> main函数的返回值类型为Unit，但Kotlin把它编译为了java的void，因为它只发挥了java void的职能，编译器就把它优化了。
>
> 而我们上面返回值类型为Unit的挂起函数编译来的java静态方法由于挂起函数的特性被编译为一个返回值为Object的函数，那么这时我们想要返回void就办不到了，因为void不是Object，但Unit是，所以返回了Unit.INSTANCE.
>
> 好耶，又顺便学到了一个新知识！

再看看我们的挂起函数闭包

~~~kotlin
fun test() {
    suspend {
        println("hello coroutine")
    }()
}
~~~

首先搞清楚一点，suspend {  } 这种挂起闭包的写法其实并不是suspend关键字本身的用法，suspend关键字其实只能修饰高阶函数类型和函数声明，这个写法实际上是调用了一个高阶函数

~~~kotlin
public inline fun <R> suspend(noinline block: suspend () -> R): suspend () -> R = block
~~~

它会被编译为什么呢？

~~~java
    @Nullable
    public static final Object test(@NotNull Continuation<? super Unit> $completion) {
        Object object = ((Function1)new Object(null){
            {
                test.2 v0 = this;
                throw new UnsupportedOperationException();
            }
        }).invoke($completion);
        if (object == IntrinsicsKt.getCOROUTINE_SUSPENDED()) {
            return object;
        }
        return Unit.INSTANCE;
    }
~~~

虽然反编译出来的代码有点畸形，但依稀可以辨认我们创建了一个`Function1<Cotinuation<? super Unit>, Object>`的匿名类，然后使用调用者的Continuation invoke了它，如果返回值为挂起标志的话就从调用者返回这个挂起标志。其实这个闭包的挂起函数的调用也和正常的挂起函数调用如出一辙。

~~~kotlin
suspend fun main() {
    test()
    test()
    test()
    test()
}

suspend fun test() {
    delay(1000)
}
~~~

~~~java
@Nullable
   public static final Object main(@NotNull Continuation var0) {
      Object $continuation;
      label47: {
         if (var0 instanceof <undefinedtype>) {
            $continuation = (<undefinedtype>)var0;
            if ((((<undefinedtype>)$continuation).label & Integer.MIN_VALUE) != 0) {
               ((<undefinedtype>)$continuation).label -= Integer.MIN_VALUE;
               break label47;
            }
         }

         $continuation = new ContinuationImpl(var0) {
            // $FF: synthetic field
            Object result;
            int label;

            @Nullable
            public final Object invokeSuspend(@NotNull Object $result) {
               this.result = $result;
               this.label |= Integer.MIN_VALUE;
               return SuspendFuncKt.main((Continuation)this);
            }
         };
      }

      Object var3;
      label39: {
         label38: {
            Object $result = ((<undefinedtype>)$continuation).result;
            var3 = IntrinsicsKt.getCOROUTINE_SUSPENDED();
            switch (((<undefinedtype>)$continuation).label) {
               case 0:
                  ResultKt.throwOnFailure($result);
                  ((<undefinedtype>)$continuation).label = 1;
                  if (test((Continuation)$continuation) == var3) {
                     return var3;
                  }
                  break;
               case 1:
                  ResultKt.throwOnFailure($result);
                  break;
               case 2:
                  ResultKt.throwOnFailure($result);
                  break label38;
               case 3:
                  ResultKt.throwOnFailure($result);
                  break label39;
               case 4:
                  ResultKt.throwOnFailure($result);
                  return Unit.INSTANCE;
               default:
                  throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
            }

            ((<undefinedtype>)$continuation).label = 2;
            if (test((Continuation)$continuation) == var3) {
               return var3;
            }
         }

         ((<undefinedtype>)$continuation).label = 3;
         if (test((Continuation)$continuation) == var3) {
            return var3;
         }
      }

      ((<undefinedtype>)$continuation).label = 4;
      if (test((Continuation)$continuation) == var3) {
         return var3;
      } else {
         return Unit.INSTANCE;
      }
   }

   @Nullable
   public static final Object test(@NotNull Continuation $completion) {
      Object var10000 = DelayKt.delay(1000L, $completion);
      return var10000 == IntrinsicsKt.getCOROUTINE_SUSPENDED() ? var10000 : Unit.INSTANCE;
   }
~~~

先从最开始这段Continuation的初始化开始分析

#### Continuation的初始化分析

~~~kotlin
Object $continuation;
      label47: {
         if (var0 instanceof <undefinedtype>) {
            $continuation = (<undefinedtype>)var0;
            if ((((<undefinedtype>)$continuation).label & Integer.MIN_VALUE) != 0) {
               ((<undefinedtype>)$continuation).label -= Integer.MIN_VALUE;
               break label47;
            }
         }

         $continuation = new ContinuationImpl(var0) {
            // $FF: synthetic field
            Object result;
            int label;

            @Nullable
            public final Object invokeSuspend(@NotNull Object $result) {
               this.result = $result;
               this.label |= Integer.MIN_VALUE;
               return SuspendFuncKt.main((Continuation)this);
            }
         };
      }
~~~

有了之前分析js generator的经验，我们可以猜到label是用来保存当前函数执行的状态的，通过下方的switch语句来执行对应的分段逻辑，事实也果真如此。

这里的`var0 instanceof <undefinedtype>` 直接给我整不会了，但先别急，我们发现下面$continuation被赋了一个匿名类的对象，我们勇敢猜测这里的`<undefinedtype>`就是这个匿名类的类型。那么为什么要做这个判断呢？我们知道挂起函数的挂起就是直接返回，恢复的本质就是再次调用挂起函数。一个挂起函数可能被挂起/恢复多次，所以这个函数可能会调用多次，所以需要这样一段逻辑来判断是否是第一次调用。如果是第一次调用，var0传入的则是调用者（也是一个挂起函数）的Continuation，以这个Continuation为构造参数，我们初始化了这个挂起函数的Continuation。如果不是第一次调用，对label做一些边界条件判断就可以直接退出这段逻辑了。

然后我们好好研究下这个ContinuationImpl

首先它持有一个label，保存本挂起函数的执行状态。还保存了一个result，从下面的代码我们可以看出，result可能是Result类型，保存挂起函数的执行结果。可以先透露一下，在我们使用`suspendCoroutine`函数将回调转为挂起函数时调用的`Continuation#resumeWith(Result)`其实就是调用了这个方法，换句话说，这个result其实就是`resumeWith`传入的Result对象。

#### 挂起函数体分析

是不是感觉有一段有些眼熟？

~~~java
Object var3;
      label39: {
         label38: {
            Object $result = ((<undefinedtype>)$continuation).result;
            var3 = IntrinsicsKt.getCOROUTINE_SUSPENDED();
            switch (((<undefinedtype>)$continuation).label) {
               case 0:
                  ResultKt.throwOnFailure($result);
                  ((<undefinedtype>)$continuation).label = 1;
                  if (test((Continuation)$continuation) == var3) {
                     return var3;
                  }
                  break;
               case 1:
                  ResultKt.throwOnFailure($result);
                  break;
               case 2:
                  ResultKt.throwOnFailure($result);
                  break label38;
               case 3:
                  ResultKt.throwOnFailure($result);
                  break label39;
               case 4:
                  ResultKt.throwOnFailure($result);
                  return Unit.INSTANCE;
               default:
                  throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
            }

            ((<undefinedtype>)$continuation).label = 2;
            if (test((Continuation)$continuation) == var3) {
               return var3;
            }
         }

         ((<undefinedtype>)$continuation).label = 3;
         if (test((Continuation)$continuation) == var3) {
            return var3;
         }
      }

      ((<undefinedtype>)$continuation).label = 4;
      if (test((Continuation)$continuation) == var3) {
         return var3;
      } else {
         return Unit.INSTANCE;
      }
~~~

这里至少可以看出 挂起函数的实现原理其实与js的generator是大同小异的。将所有挂起点用switch语句分开，如果有四个挂起点，那所有非挂起函数调用代码就能分成5个case语句。区别就在于它使用java的label从用于从指定的逻辑块跳出。我们可以发现他们从不同的代码块中break出去都会更新continuation的label，并再次调用该函数(尝试继续执行该函数)，如果返回了挂起标志便说明该函数在该挂起点被挂起，便直接返回挂起标志。从这里我们可以看出，挂起函数在运行到挂起点时并不一定会挂起。

#### 总结

Kotlin协程的挂起本质上是直接返回，而恢复的本质上则是再次执行，由Continuation作为状态机来保存当前挂起函数执行状态。

到这里我们便基本上分析完了kotlin编译器为挂起函数提供的支持，接下来我们将开始分析kotlin协程库的源码，也就是框架层的内容。（终于可以告别丑陋的反编译代码了）

### suspend main

不知道读者看到上面我们分析挂起函数的Continuation的初始化分析时有没有产生一个疑惑，既然每个挂起函数都需要传入一个Continuation去调用，那么遇到类似suspend main/runBlocking/scope#launch这些上层没有挂起函数调用者的情况下是如何运行的呢？我们先从最简单的suspend main开始分析

~~~java
@Nullable
   public static final Object main(@NotNull Continuation $completion) {
      return Unit.INSTANCE;
   }

   // $FF: synthetic method
   public static void main(String[] var0) {
      RunSuspendKt.runSuspend(new SuspendFuncKt$$$main(var0));
   }
~~~

通过之前反编译的源码可以发现，suspend main实际上是执行了`RunSuspendKt.runSuspend()`并将生成的SuspendLambda匿名类对象传入。

看了这么久的反编译代码，终于可以看点框架层的代码了！那么我们先看看runSuspend函数的源码

~~~kotlin
/**
 * Wrapper for `suspend fun main` and `@Test suspend fun testXXX` functions.
 */
@SinceKotlin("1.3")
internal fun runSuspend(block: suspend () -> Unit) {
    val run = RunSuspend()
    block.startCoroutine(run)
    run.await()
}
~~~

就三行，注释里也说了，它只是一个Wrapper，那么具体实现逻辑应该在`RunSuspend`这个类里面

~~~kotlin
private class RunSuspend : Continuation<Unit> {
    override val context: CoroutineContext
        get() = EmptyCoroutineContext

    var result: Result<Unit>? = null

    override fun resumeWith(result: Result<Unit>) = synchronized(this) {
        this.result = result
        @Suppress("PLATFORM_CLASS_MAPPED_TO_KOTLIN") (this as Object).notifyAll()
    }

    fun await() = synchronized(this) {
        while (true) {
            when (val result = this.result) {
                null -> @Suppress("PLATFORM_CLASS_MAPPED_TO_KOTLIN") (this as Object).wait()
                else -> {
                    result.getOrThrow() // throw up failure
                    return
                }
            }
        }
    }
}
~~~

原来这个RunSuspend是一个Continuation的实现，那么我们就是用这个Continuation开启了一个协程。原来挂起函数的顶级调用底层实现都是`Continuation#startCoroutine`，而所谓的`suspend main` `runBlocking` `scope#launch`就是对其不同形式的封装罢了。我们接着看，它在内部保存了一个result变量，resumeWith就直接赋值给变量，也没有像我们之前说的一样再次调用某个挂起函数，因为他的上层已经没有挂起函数了。但是它调用了一个`Object#notifyAll()`，说实话以前很少用到这个方法，它的作用是唤醒这个对象的对象观察器上的所有线程。既然有唤醒，那就有睡眠，可以看到我们下面的await函数拉起了一段死循环，当result还没有resume时调用`Object#wait()`，让当前线程进入等待状态。而这些都必须在一个有对象观察器的对象上调用，同时也必须保证这段逻辑只在一条线程上执行，所以我们要给他上把锁。而一旦resume了就会唤醒这段逻辑，并且在result为failure时抛出异常，然后退出逻辑。

这样RunSuspend这个Continuation我们就分析得差不多了,但上面还有一行逻辑我们没有分析`Continuation#startCoroutine`。

#### startCoroutine

~~~kotlin
/**
 * Starts a coroutine without a receiver and with result type [T].
 * This function creates and starts a new, fresh instance of suspendable computation every time it is invoked.
 * The [completion] continuation is invoked when the coroutine completes with a result or an exception.
 */
@SinceKotlin("1.3")
@Suppress("UNCHECKED_CAST")
public fun <T> (suspend () -> T).startCoroutine(
    completion: Continuation<T>
) {
    createCoroutineUnintercepted(completion).intercepted().resume(Unit)
}
~~~

创建一个没有被拦截的Continuation，然后拦截，然后立刻resume

我们来看看createCoroutineUnintercepted这葫芦里卖的什么药

~~~kotlin
/**
 * Creates unintercepted coroutine without receiver and with result type [T].
 * This function creates a new, fresh instance of suspendable computation every time it is invoked.
 *
 * To start executing the created coroutine, invoke `resume(Unit)` on the returned [Continuation] instance.
 * The [completion] continuation is invoked when coroutine completes with result or exception.
 *
 * This function returns unintercepted continuation.
 * Invocation of `resume(Unit)` starts coroutine immediately in the invoker's call stack without going through the
 * [ContinuationInterceptor] that might be present in the completion's [CoroutineContext].
 * It is the invoker's responsibility to ensure that a proper invocation context is established.
 * Note that [completion] of this function may get invoked in an arbitrary context.
 *
 * [Continuation.intercepted] can be used to acquire the intercepted continuation.
 * Invocation of `resume(Unit)` on intercepted continuation guarantees that execution of
 * both the coroutine and [completion] happens in the invocation context established by
 * [ContinuationInterceptor].
 *
 * Repeated invocation of any resume function on the resulting continuation corrupts the
 * state machine of the coroutine and may result in arbitrary behaviour or exception.
 */
@SinceKotlin("1.3")
public actual fun <T> (suspend () -> T).createCoroutineUnintercepted(
    completion: Continuation<T>
): Continuation<Unit> {
    val probeCompletion = probeCoroutineCreated(completion)
    return if (this is BaseContinuationImpl)
        create(probeCompletion)
    else
        createCoroutineFromSuspendFunction(probeCompletion) {
            (this as Function1<Continuation<T>, Any?>).invoke(it)
        }
}
~~~

probeCoroutineCreated是提供给debugger的hook点，正常情况下会直接返回传入的completion

```kotlin
internal fun <T> probeCoroutineCreated(completion: Continuation<T>): Continuation<T> {
    /** implementation of this function is replaced by debugger */
    return completion
}
```

首先判断是否是BaseContinuation，如果是就create，这个create是由编译器生成的。如果不是那就调用`createCoroutineFromSuspendFunction`

~~~kotlin
/**
 * This function is used when [createCoroutineUnintercepted] encounters suspending lambda that does not extend BaseContinuationImpl.
 *
 * It happens in two cases:
 *   1. Callable reference to suspending function,
 *   2. Suspending function reference implemented by Java code.
 *
 * We must wrap it into an instance that extends [BaseContinuationImpl], because that is an expectation of all coroutines machinery.
 * As an optimization we use lighter-weight [RestrictedContinuationImpl] base class (it has less fields) if the context is
 * [EmptyCoroutineContext], and a full-blown [ContinuationImpl] class otherwise.
 *
 * The instance of [BaseContinuationImpl] is passed to the [block] so that it can be passed to the corresponding invocation.
 */
@SinceKotlin("1.3")
private inline fun <T> createCoroutineFromSuspendFunction(
    completion: Continuation<T>,
    crossinline block: (Continuation<T>) -> Any?
): Continuation<Unit> {
    val context = completion.context
    // label == 0 when coroutine is not started yet (initially) or label == 1 when it was
    return if (context === EmptyCoroutineContext)
        object : RestrictedContinuationImpl(completion as Continuation<Any?>) {
            private var label = 0

            override fun invokeSuspend(result: Result<Any?>): Any? =
                when (label) {
                    0 -> {
                        label = 1
                        result.getOrThrow() // Rethrow exception if trying to start with exception (will be caught by BaseContinuationImpl.resumeWith
                        block(this) // run the block, may return or suspend
                    }
                    1 -> {
                        label = 2
                        result.getOrThrow() // this is the result if the block had suspended
                    }
                    else -> error("This coroutine had already completed")
                }
        }
    else
        object : ContinuationImpl(completion as Continuation<Any?>, context) {
            private var label = 0

            override fun invokeSuspend(result: Result<Any?>): Any? =
                when (label) {
                    0 -> {
                        label = 1
                        result.getOrThrow() // Rethrow exception if trying to start with exception (will be caught by BaseContinuationImpl.resumeWith
                        block(this) // run the block, may return or suspend
                    }
                    1 -> {
                        label = 2
                        result.getOrThrow() // this is the result if the block had suspended
                    }
                    else -> error("This coroutine had already completed")
                }
        }
}
~~~

既然有注释，那为啥不先读了再往下分析呢？

>  当 [createCoroutineUnintercepted] 遇到不扩展 BaseContinuationImpl 的挂起 lambda 时使用此函数。
>   
>   它发生在两种情况下：
>   
>    1. 挂起函数的可调用引用
>   
>   2. Java 代码实现的挂起函数引用。
>   
>  我们必须将它包装到一个扩展 [BaseContinuationImpl] 的实例中，因为这是所有协程机制的期望。
>   
>  作为一种优化，如果上下文为[EmptyCoroutineContext]，我们使用相对轻量的 [RestrictedContinuationImpl]，否则是一个完全的 [ContinuationImpl] 类。
>   
> [BaseContinuationImpl] 的实例被传递给 [block] 以便它可以传递给相应的调用。

对的，这个函数是为了将传入的这个continuation再套了一层包装成一个BaseContinuation。至于是否使用`RestrictContinuationImpl`进行优化看context是不是`EmptyContext`，如果是的话就优化，不是的话就不优化。估计这个`RestrictContinuationImpl`就是少一个context。

看起来就是简单模拟了一下由编译器生成的逻辑，在第一次invoke时执行block，再看看我们上面的block写了什么

~~~kotlin
(this as Function1<Continuation<T>, Any?>).invoke(it)
~~~

用这个continuation去执行了要执行的suspend function，suspend function将其视为调用者的continuation。这个suspend function可能会挂起，也可能直接返回。

那么问题是它在哪里执行了invoke呢？我猜在resume里，由于我们并没有重写BaseContinuationImpl的resumeWith方法，它应该就是执行的默认实现

~~~kotlin
public final override fun resumeWith(result: Result<Any?>) {
        // This loop unrolls recursion in current.resumeWith(param) to make saner and shorter stack traces on resume
        var current = this
        var param = result
        while (true) {
            // Invoke "resume" debug probe on every resumed continuation, so that a debugging library infrastructure
            // can precisely track what part of suspended callstack was already resumed
            probeCoroutineResumed(current)
            with(current) {
                val completion = completion!! // fail fast when trying to resume continuation without completion
                val outcome: Result<Any?> =
                    try {
                        val outcome = invokeSuspend(param)
                        if (outcome === COROUTINE_SUSPENDED) return
                        Result.success(outcome)
                    } catch (exception: Throwable) {
                        Result.failure(exception)
                    }
                releaseIntercepted() // this state machine instance is terminating
                if (completion is BaseContinuationImpl) {
                    // unrolling recursion via loop
                    current = completion
                    param = outcome
                } else {
                    // top-level completion reached -- invoke and return
                    completion.resumeWith(outcome)
                    return
                }
            }
        }
    }
~~~

completion就是上层Continuation，我们看到它首先调用了自身的invokeSuspend，再对completion做判断，如果是BaseContinuationImpl的话说明还没有遍历到最外层，就再走一遍循环，如果不是的话说明已经走到最外层，就给他resume然后return。这个方法就是用来遍历整个挂起函数调用链的，挨个调用invokeSuspend，如果还在挂起就return。如果能到达在最外层resume。

多说无益，我们来仔细分析一段挂起函数的调用流程，我们先标记一下每个挂起函数对应的Continuation

~~~kotlin
suspend fun main() {
    // 当前函数持有continuation: BaseContinuationImpl包了个RunSuspend (c0)
    
    println("1")
    test1()
    println("2")
    test2()
    println("3")
    test3()
    println("4")
    test4()
}

suspend fun test1() {
    // ContinuationImpl (c1)
    delay(1000)
}

suspend fun test2() {
    // ContinuationImpl (c2)
    delay(1000)
}

suspend fun test3() {
    // ContinuationImpl (c3)
    delay(1000)
}

suspend fun test4() {
    // ContinuationImpl (c4)
    delay(1000)
}
~~~

先简要总结一下suspend main

> 首先suspend main是通过调用`runSuspend`开启的协程，它使用一个`RunSuspend`实例作为Continuation实现传入`startCoroutine`，然后`startCoroutine`调用`createCoroutineUnintercepted`，由于`RunSuspend`不是一个`BaseContinuationImpl`，调用`createCoroutineFromSuspendFunction`包一层`BaseContinuationImpl`，这个continuation的`invokeSuspend`第一次调用时会invoke这个suspend main，在函数挂起的情况下再次被resume就会调用第二次invokeSuspend。

首先startCoroutine中创建的Continuation创建后立刻就resume了，resume了自然就对c0执行了第一次invokeSuspend，然后我们进到test1，初始化了c1并调用了delay，delay向调度器提交一个延时1000ms恢复test1的continuation的任务并返回一个挂起标志，这个挂起标志又被test1返回给了main，main函数返回。

但真实的main函数并没有退出，而是正在等待(`Object#wait()`)，等待这个挂起函数resume时执行`Object#notifyAll()`唤醒它。

~~~kotlin
fun await() = synchronized(this) {
        while (true) {
            when (val result = this.result) {
                null -> @Suppress("PLATFORM_CLASS_MAPPED_TO_KOTLIN") (this as Object).wait()
                else -> {
                    result.getOrThrow() // throw up failure
                    return
                }
            }
        }
    }
~~~

注意，这里第一次挂起之后，所有逻辑不在主线程上执行了，而是交给了协程调度器——本质上是一个线程池，我们来验证一下

```kotlin
suspend fun main() {
    println(Thread.currentThread().name)
    delay(1000)
    println(Thread.currentThread().name)
}
```

> main
>
> kotlinx.coroutines.DefaultExecutor

事实也果真如此

1000ms后调度器resume了delay函数内部的continuation，test1的invokeSuspend被再次执行，由于接下来已经没有挂起点了，所以invokeSuspend没有返回挂起标志，它的返回值被包装为了一个result。

~~~kotlin
val outcome: Result<Any?> =
                    try {
                        val outcome = invokeSuspend(param)
                        if (outcome === COROUTINE_SUSPENDED) return
                        Result.success(outcome)
                    } catch (exception: Throwable) {
                        Result.failure(exception)
                    }
~~~

然后进入了当前continuation的completion是否到达顶层的判断，如果没有到达顶层，就把当前continuation更新为completion，再走一遍刚才invokeSuspend的逻辑，如果到达就resume。

~~~kotlin
               	if (completion is BaseContinuationImpl) {
                    // unrolling recursion via loop
                    current = completion
                    param = outcome
                } else {
                    // top-level completion reached -- invoke and return
                    completion.resumeWith(outcome)
                    return
                }
~~~

我们先到达了test1的continuation，再次invoke了一次，由于test1除了delay也没调用别的挂起函数，所以也直接返回了，然后我们走到更上层，invoke main的continuation，main函数invoke之后打印2并进入调用test2，剩下的逻辑以此类推...

直到main的continuation执行完成，终于进到了resume RunSuspend的逻辑，我们来看看RunSuspend的resumeWith实现

~~~kotlin
override fun resumeWith(result: Result<Unit>) = synchronized(this) {
        this.result = result
        @Suppress("PLATFORM_CLASS_MAPPED_TO_KOTLIN") (this as Object).notifyAll()
    }

~~~

notify了我们之前wait的主线程，控制权回到主线程，这时java的main函数才算真正执行完成，程序退出。

到这里我们的startCoroutine就算分析得差不多了，至少我是理解了。

好像还有个intercept没分析，之后再说吧。

### runBlocking

