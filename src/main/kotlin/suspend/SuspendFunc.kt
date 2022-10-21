package suspend

import kotlinx.coroutines.*
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.coroutines.*

private val scheduler = Executors.newScheduledThreadPool(1) {
    Thread(it).apply { isDaemon = true }
}

fun main() = runBlocking {
    delay(1000)
    delay(1000)
    delay(1000)
    println(test())
}

suspend fun test() = suspendCoroutine {
    scheduler.schedule({ it.resumeWith(Result.success("Hello World")) }, 1, TimeUnit.SECONDS)
}