# Java 异步编程 / NIO

## Future & 线程池

那么Java有没有跟js中promise一样的东西呢？当然有，那就是Future！而且它并不像Promise的实现那样简单，事实上，Java Future是个接口，有多个形式的实现。

我们先来看看Future接口的内容

~~~java
public interface Future<V> {
    boolean cancel(boolean var1);

    boolean isCancelled();

    boolean isDone();

    V get() throws InterruptedException, ExecutionException;

    V get(long var1, TimeUnit var3) throws InterruptedException, ExecutionException, TimeoutException;
}
~~~

发现它与Promise的不同之处了吗？它实际上定义了取消的接口，而取消一个微任务并不是Promise的职责。

事实上取消一个任务并不是那么容易的，事实上它需要任务本身的配合，我们来看一段例子。

~~~kotlin
fun main() {
    val t = thread {
        while (!Thread.currentThread().isInterrupted) {
            println("歪比巴卜")
        }
    }
    Thread.sleep(2000)
    t.interrupt()
    Thread.sleep(2000)
}
~~~

像这样我们才能取消掉一个线程里的任务，就算不是跑在单独线程里的任务也是同理，我们取消任务是依靠向任务发送取消任务的信号，至于是否响应这个信号由任务本身决定。

那么我们可能会有疑惑，像js中那种setTimeout为什么就可以随时取消？实际上都是一样的，只不过V8引擎帮我们在主线程的事件循环中做了封装，java通过线程池自然也可以做到同样的事情。

~~~kotlin
fun main() {
    val executorService = Executors.newScheduledThreadPool(1)
    executorService.schedule({
        println("战争即和平")
    }, 1, TimeUnit.SECONDS)
    val scheduledFuture = executorService.schedule({
        println("自由即奴役")
    }, 2, TimeUnit.SECONDS)
    executorService.scheduleWithFixedDelay({
        println("无知即力量")
    }, 2, 1, TimeUnit.SECONDS)
    Thread.sleep(1000)
    scheduledFuture.cancel(true)
    Thread.sleep(5000)
    executorService.shutdown()
}
~~~

这里 自由即奴役 并没有被打印出来，如你所见，它被取消了。为什么可以这么做？因为线程池对任务的取消做了适配，一旦一个任务尚未开始执行就被取消，那么这个任务就不会被执行。

### 线程池实现

在js部分，我们讲过事件循环的概念。那么我们便可以套用这个概念来描述线程池——线程池就是由一个或多个线程共用一个任务队列，形成一个事件循环。

